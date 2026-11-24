-- Kouture Life OS — core: schemas, roles, owner profile, audit log, approvals.
--
-- Security model
--   * Exactly one human user (the owner). A trigger on auth.users refuses a
--     second sign-up even if sign-ups are accidentally left enabled.
--   * Every row carries owner_id; RLS allows access only when owner_id = auth.uid().
--   * Data lives in three schemas: core (shared plumbing), life (personal),
--     kouture (business). AI agents connect as dedicated Postgres roles that are
--     granted one domain only: kouture_agent can never read life, and
--     life_assistant can never read kouture. This is enforced by GRANTs, so a
--     prompt-injected agent cannot cross domains even with a crafted query.
--   * The audit log is append-only for every role, including service_role.

create extension if not exists pgcrypto;

create schema if not exists core;
create schema if not exists life;
create schema if not exists kouture;

-- ── Roles ────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'kouture_agent') then
    create role kouture_agent nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'life_assistant') then
    create role life_assistant nologin noinherit;
  end if;
end $$;

-- PostgREST switches into these roles from the JWT "role" claim.
grant kouture_agent to authenticator;
grant life_assistant to authenticator;

revoke all on schema core, life, kouture from public, anon;
grant usage on schema core to authenticated, kouture_agent, life_assistant, service_role;
grant usage on schema life to authenticated, life_assistant, service_role;
grant usage on schema kouture to authenticated, kouture_agent, service_role;

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function core.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Who is acting, for audit rows. Derived from the database role PostgREST
-- switched into (from the signed JWT), never from anything the caller can set:
-- current_setting('role') survives SECURITY DEFINER, unlike current_user.
create or replace function core.jwt_claim(p_key text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> p_key, '')
$$;

create or replace function core.current_actor_type()
returns text
language sql
stable
set search_path = ''
as $$
  select case current_setting('role', true)
    when 'kouture_agent'  then 'agent'
    when 'life_assistant' then 'assistant'
    else case when auth.uid() is not null then 'owner' else 'system' end
  end
$$;

create or replace function core.current_actor_id()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when current_setting('role', true) in ('kouture_agent', 'life_assistant')
      then coalesce(core.jwt_claim('agent_key'), 'unknown-agent')
    else coalesce(auth.uid()::text, 'system')
  end
$$;

-- ── Owner profile ────────────────────────────────────────────────────────────
create table core.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Owner',
  business_name text not null default 'Kouture Nail Bar',
  timezone     text not null default 'America/New_York',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table core.profiles enable row level security;

create policy profiles_owner_select on core.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_owner_update on core.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select, update (display_name, business_name, timezone) on core.profiles to authenticated;
grant select on core.profiles to kouture_agent, life_assistant;
create policy profiles_agent_select on core.profiles
  for select to kouture_agent, life_assistant using (id = auth.uid());

create trigger profiles_updated_at before update on core.profiles
  for each row execute function core.set_updated_at();

create or replace function core.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from core.profiles) then
    raise exception 'Kouture Life OS is single-owner: an owner account already exists'
      using errcode = 'insufficient_privilege';
  end if;
  insert into core.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Owner'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function core.handle_new_user();

-- ── Audit log (append-only) ──────────────────────────────────────────────────
create table core.audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  actor_type  text not null default core.current_actor_type()
              check (actor_type in ('owner', 'agent', 'assistant', 'system')),
  actor_id    text not null default core.current_actor_id(),
  domain      text not null check (domain in ('core', 'life', 'kouture')),
  action      text not null,
  entity_type text,
  entity_id   text,
  summary     text not null,
  metadata    jsonb not null default '{}'::jsonb
);

create index audit_log_owner_time on core.audit_log (owner_id, occurred_at desc);
create index audit_log_domain_time on core.audit_log (owner_id, domain, occurred_at desc);

alter table core.audit_log enable row level security;

create policy audit_owner_select on core.audit_log
  for select to authenticated using (owner_id = auth.uid());
create policy audit_owner_insert on core.audit_log
  for insert to authenticated with check (owner_id = auth.uid());
create policy audit_agent_insert on core.audit_log
  for insert to kouture_agent, life_assistant with check (owner_id = auth.uid());

grant select, insert on core.audit_log to authenticated;
grant insert on core.audit_log to kouture_agent, life_assistant;
revoke update, delete, truncate on core.audit_log from authenticated, kouture_agent, life_assistant, service_role;

create or replace function core.audit_log_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'core.audit_log is append-only (attempted %)', tg_op
    using errcode = 'insufficient_privilege';
end $$;

create trigger audit_log_no_update before update or delete on core.audit_log
  for each row execute function core.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on core.audit_log
  for each statement execute function core.audit_log_immutable();

-- Generic row-change auditor attached to every data table.
create or replace function core.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec   jsonb;
  label text;
begin
  rec := to_jsonb(coalesce(new, old));
  label := coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'full_name', rec ->> 'id');
  insert into core.audit_log (owner_id, domain, action, entity_type, entity_id, summary, metadata)
  values (
    (rec ->> 'owner_id')::uuid,
    tg_table_schema,
    lower(tg_op),
    tg_table_name,
    rec ->> 'id',
    format('%s %s: %s', initcap(lower(tg_op)), replace(tg_table_name, '_', ' '), coalesce(label, '')),
    case when tg_op = 'UPDATE'
      then jsonb_build_object('changed', (
        select coalesce(jsonb_agg(key), '[]'::jsonb)
        from jsonb_each(to_jsonb(new)) n
        where n.value is distinct from (to_jsonb(old) -> n.key)
          and n.key not in ('updated_at')
      ))
      else '{}'::jsonb
    end
  );
  return coalesce(new, old);
end $$;

-- ── Approvals ────────────────────────────────────────────────────────────────
-- Anything an agent wants to do outside the app is queued here. The payload is
-- frozen at creation so what you approve is exactly what runs.
create table core.approvals (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  domain           text not null check (domain in ('life', 'kouture')),
  requested_by     text not null,
  action_type      text not null check (action_type in (
                     'send_message', 'publish_content', 'change_appointment', 'issue_refund',
                     'make_purchase', 'external_financial_access', 'irreversible')),
  title            text not null,
  summary          text not null,
  payload          jsonb not null default '{}'::jsonb,
  risk             text not null default 'medium' check (risk in ('low', 'medium', 'high')),
  status           text not null default 'pending' check (status in (
                     'pending', 'approved', 'rejected', 'executed', 'failed', 'expired')),
  decision_note    text,
  decided_at       timestamptz,
  executed_at      timestamptz,
  execution_result jsonb,
  expires_at       timestamptz not null default now() + interval '7 days',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index approvals_owner_status on core.approvals (owner_id, status, created_at desc);

alter table core.approvals enable row level security;

create policy approvals_owner_select on core.approvals
  for select to authenticated using (owner_id = auth.uid());
create policy approvals_owner_decide on core.approvals
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy approvals_kouture_agent_insert on core.approvals
  for insert to kouture_agent with check (owner_id = auth.uid() and domain = 'kouture' and status = 'pending');
create policy approvals_kouture_agent_select on core.approvals
  for select to kouture_agent using (owner_id = auth.uid() and domain = 'kouture');
create policy approvals_life_assistant_insert on core.approvals
  for insert to life_assistant with check (owner_id = auth.uid() and domain = 'life' and status = 'pending');
create policy approvals_life_assistant_select on core.approvals
  for select to life_assistant using (owner_id = auth.uid() and domain = 'life');

grant select, update (status, decision_note) on core.approvals to authenticated;
grant select, insert on core.approvals to kouture_agent, life_assistant;

create or replace function core.approvals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payload is distinct from old.payload
     or new.action_type is distinct from old.action_type
     or new.requested_by is distinct from old.requested_by
     or new.domain is distinct from old.domain then
    raise exception 'approval request contents are immutable once created';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending'  and new.status in ('approved', 'rejected', 'expired')) or
      (old.status = 'approved' and new.status in ('executed', 'failed'))
    ) then
      raise exception 'invalid approval transition % -> %', old.status, new.status;
    end if;
    -- Only the owner may approve or reject; only the executor (service role) may
    -- mark executed/failed.
    if new.status in ('approved', 'rejected') and core.current_actor_type() <> 'owner' then
      raise exception 'only the owner can decide an approval';
    end if;
    if new.status = 'approved' and old.expires_at < now() then
      raise exception 'approval request has expired';
    end if;
    if new.status in ('approved', 'rejected') then new.decided_at := now(); end if;
    if new.status in ('executed', 'failed') then new.executed_at := now(); end if;
  end if;
  return new;
end $$;

create trigger approvals_guard before update on core.approvals
  for each row execute function core.approvals_guard();
create trigger approvals_updated_at before update on core.approvals
  for each row execute function core.set_updated_at();
create trigger approvals_audit after insert or update on core.approvals
  for each row execute function core.audit_row_change();
