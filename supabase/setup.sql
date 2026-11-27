-- ============================================================================
-- Kouture Life OS — complete database setup
-- GENERATED from supabase/migrations by scripts/build-setup-sql.mjs. Do not edit.
--
-- How to use: Supabase → SQL Editor → New query → paste this whole file → Run.
-- Run it ONCE on a new, empty project. Expected result: "Success. No rows returned".
-- ============================================================================

-- ─── 20261124000001_core.sql ───────────────────────────────────────────────

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

-- ─── 20261124000002_life.sql ───────────────────────────────────────────────

-- Kouture Life OS — My Life (personal). Never granted to kouture_agent.
-- Phase 2 creates the tables the home dashboard reads; Phase 3 adds the rest
-- (budget, savings, fitness, meals, travel, self-care, journal).

create table life.tasks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  title        text not null check (length(title) between 1 and 300),
  notes        text,
  due_on       date,
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status       text not null default 'open' check (status in ('open', 'done', 'archived')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index life_tasks_owner_due on life.tasks (owner_id, status, due_on);

create table life.habits (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name        text not null check (length(name) between 1 and 120),
  icon        text,
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  sort_order  smallint not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table life.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  habit_id   uuid not null references life.habits (id) on delete cascade,
  logged_on  date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, logged_on)
);
create index life_habit_logs_owner_day on life.habit_logs (owner_id, logged_on);

create table life.events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  title       text not null check (length(title) between 1 and 200),
  category    text not null default 'personal'
              check (category in ('personal', 'self_care', 'fitness', 'travel', 'social', 'other')),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  location    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index life_events_owner_start on life.events (owner_id, starts_at);

create table life.goals (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  title        text not null check (length(title) between 1 and 200),
  area         text not null default 'personal'
               check (area in ('personal', 'health', 'money', 'beauty', 'growth', 'travel')),
  target_value numeric(12, 2) not null check (target_value > 0),
  current_value numeric(12, 2) not null default 0 check (current_value >= 0),
  unit         text,
  target_date  date,
  status       text not null default 'active' check (status in ('active', 'achieved', 'paused')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS, grants, triggers for every life table
do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'habits', 'habit_logs', 'events', 'goals'] loop
    execute format('alter table life.%I enable row level security', t);
    execute format(
      'create policy %I on life.%I for all to authenticated, life_assistant
         using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t || '_owner_only', t);
    execute format('grant select, insert, update, delete on life.%I to authenticated', t);
    execute format('grant select on life.%I to life_assistant', t);
    execute format(
      'create trigger %I after insert or update or delete on life.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    if t <> 'habit_logs' then
      execute format(
        'create trigger %I before update on life.%I
           for each row execute function core.set_updated_at()', t || '_updated_at', t);
    end if;
  end loop;
end $$;

-- The assistant may organise tasks (internal action) but not delete anything.
grant insert, update (title, notes, due_on, priority, status, completed_at) on life.tasks to life_assistant;

-- ─── 20261124000003_kouture.sql ────────────────────────────────────────────

-- Kouture Life OS — Kouture Nail Bar (business). Never granted to life_assistant.
-- Money is stored as integer cents. Phase 2 creates the tables the business
-- dashboard reads; Phase 4 adds inventory, marketing, policies and the rest.

create table kouture.clients (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  full_name        text not null check (length(full_name) between 1 and 160),
  phone            text,
  email            text,
  birthday         date,
  notes            text,
  -- TCPA / CAN-SPAM: marketing only to clients with recorded consent
  sms_marketing_consent_at   timestamptz,
  email_marketing_consent_at timestamptz,
  sms_opted_out_at           timestamptz,
  email_opted_out_at         timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index kouture_clients_owner_name on kouture.clients (owner_id, full_name);

create table kouture.services (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name             text not null check (length(name) between 1 and 120),
  category         text not null default 'manicure',
  duration_minutes smallint not null check (duration_minutes between 5 and 600),
  price_cents      integer not null check (price_cents >= 0),
  deposit_cents    integer not null default 0 check (deposit_cents >= 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table kouture.appointments (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  client_id      uuid references kouture.clients (id) on delete set null,
  service_id     uuid references kouture.services (id) on delete set null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         text not null default 'booked'
                 check (status in ('booked', 'confirmed', 'completed', 'no_show', 'cancelled')),
  price_cents    integer not null check (price_cents >= 0),
  deposit_cents  integer not null default 0 check (deposit_cents >= 0),
  source         text not null default 'nailzy' check (source in ('nailzy', 'manual', 'import')),
  external_ref   text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (owner_id, source, external_ref)
);
create index kouture_appts_owner_start on kouture.appointments (owner_id, starts_at);

-- Deposits arrive via Stripe; balances are collected in cash.
create table kouture.payments (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  appointment_id uuid references kouture.appointments (id) on delete set null,
  client_id      uuid references kouture.clients (id) on delete set null,
  kind           text not null check (kind in ('deposit', 'balance', 'tip', 'refund')),
  method         text not null check (method in ('stripe', 'cash', 'other')),
  amount_cents   integer not null check (amount_cents > 0),
  received_at    timestamptz not null default now(),
  stripe_payment_intent text unique,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index kouture_payments_owner_time on kouture.payments (owner_id, received_at);

create table kouture.expenses (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  category     text not null check (category in (
                 'supplies', 'rent', 'marketing', 'software', 'education', 'equipment',
                 'fees', 'other')),
  vendor       text,
  description  text,
  amount_cents integer not null check (amount_cents > 0),
  spent_on     date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index kouture_expenses_owner_day on kouture.expenses (owner_id, spent_on);

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'services', 'appointments', 'payments', 'expenses'] loop
    execute format('alter table kouture.%I enable row level security', t);
    execute format(
      'create policy %I on kouture.%I for all to authenticated, kouture_agent
         using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t || '_owner_only', t);
    execute format('grant select, insert, update, delete on kouture.%I to authenticated', t);
    -- Agents read business data. Every outward or irreversible change goes
    -- through core.approvals; per-agent table scopes are enforced in the app.
    execute format('grant select on kouture.%I to kouture_agent', t);
    execute format(
      'create trigger %I after insert or update or delete on kouture.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    execute format(
      'create trigger %I before update on kouture.%I
         for each row execute function core.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Agents may add internal notes on clients (Client Relations), nothing else.
grant update (notes) on kouture.clients to kouture_agent;

-- ─── 20261125000001_life_modules.sql ───────────────────────────────────────

-- Kouture Life OS — Phase 3: the full My Life modules.
-- Same rules as every life table: owner-only RLS, readable by life_assistant,
-- never granted to kouture_agent, and audited.

create table life.day_plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  day         date not null,
  intention   text check (length(intention) <= 280),
  priorities  text[] not null default '{}' check (cardinality(priorities) <= 3),
  notes       text check (length(notes) <= 5000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, day)
);

create table life.budget_categories (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name                text not null check (length(name) between 1 and 80),
  kind                text not null default 'expense' check (kind in ('expense', 'income')),
  monthly_limit_cents integer check (monthly_limit_cents >= 0),
  sort_order          smallint not null default 0,
  archived            boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table life.transactions (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  occurred_on  date not null,
  kind         text not null check (kind in ('expense', 'income')),
  amount_cents integer not null check (amount_cents > 0),
  category_id  uuid references life.budget_categories (id) on delete set null,
  description  text not null check (length(description) between 1 and 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index life_transactions_owner_day on life.transactions (owner_id, occurred_on);

create table life.savings_goals (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name         text not null check (length(name) between 1 and 120),
  target_cents integer not null check (target_cents > 0),
  target_date  date,
  status       text not null default 'active' check (status in ('active', 'achieved', 'paused')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Balance = sum of contributions; withdrawals are negative.
create table life.savings_contributions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  goal_id        uuid not null references life.savings_goals (id) on delete cascade,
  amount_cents   integer not null check (amount_cents <> 0),
  contributed_on date not null,
  note           text check (length(note) <= 200),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table life.workout_logs (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  performed_on     date not null,
  kind             text not null check (kind in ('strength', 'cardio', 'pilates', 'yoga', 'walk', 'dance', 'other')),
  title            text not null check (length(title) between 1 and 120),
  duration_minutes smallint not null check (duration_minutes between 1 and 600),
  intensity        text not null default 'moderate' check (intensity in ('easy', 'moderate', 'hard')),
  notes            text check (length(notes) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index life_workout_logs_owner_day on life.workout_logs (owner_id, performed_on);

create table life.workout_plans (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  weekday          smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  kind             text not null check (kind in ('strength', 'cardio', 'pilates', 'yoga', 'walk', 'dance', 'other')),
  title            text not null check (length(title) between 1 and 120),
  duration_minutes smallint not null check (duration_minutes between 1 and 600),
  exercises        text check (length(exercises) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table life.meals (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  day        date not null,
  slot       text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  title      text not null check (length(title) between 1 and 120),
  notes      text check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index life_meals_owner_day on life.meals (owner_id, day);

create table life.grocery_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name       text not null check (length(name) between 1 and 120),
  quantity   text check (length(quantity) <= 40),
  checked    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table life.trips (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name         text not null check (length(name) between 1 and 120),
  destination  text not null check (length(destination) between 1 and 120),
  starts_on    date not null,
  ends_on      date not null,
  budget_cents integer check (budget_cents >= 0),
  status       text not null default 'planning' check (status in ('planning', 'booked', 'done')),
  notes        text check (length(notes) <= 5000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table life.trip_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  trip_id    uuid not null references life.trips (id) on delete cascade,
  kind       text not null check (kind in ('flight', 'stay', 'activity', 'dining', 'packing')),
  title      text not null check (length(title) between 1 and 160),
  on_day     date,
  cost_cents integer check (cost_cents >= 0),
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table life.selfcare_routines (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name         text not null check (length(name) between 1 and 120),
  category     text not null check (category in ('nails', 'hair', 'skin', 'lashes', 'brows', 'body', 'spa', 'wellness', 'other')),
  every_days   smallint not null check (every_days between 1 and 365),
  last_done_on date,
  provider     text check (length(provider) <= 120),
  notes        text check (length(notes) <= 1000),
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table life.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  entry_on   date not null,
  mood       smallint check (mood between 1 and 5),
  title      text check (length(title) <= 160),
  body       text check (length(body) <= 20000),
  gratitude  text check (length(gratitude) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, entry_on)
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'day_plans', 'budget_categories', 'transactions', 'savings_goals', 'savings_contributions',
    'workout_logs', 'workout_plans', 'meals', 'grocery_items', 'trips', 'trip_items',
    'selfcare_routines', 'journal_entries'
  ] loop
    execute format('alter table life.%I enable row level security', t);
    execute format(
      'create policy %I on life.%I for all to authenticated, life_assistant
         using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t || '_owner_only', t);
    execute format('grant select, insert, update, delete on life.%I to authenticated', t);
    execute format('grant select on life.%I to life_assistant', t);
    execute format(
      'create trigger %I after insert or update or delete on life.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    execute format(
      'create trigger %I before update on life.%I
         for each row execute function core.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Match the (owner_id, …) convention every other "one per day" key uses.
alter table life.habit_logs
  add constraint habit_logs_owner_habit_day unique (owner_id, habit_id, logged_on);

-- Private writing stays out of the audit trail's summary text: log that the
-- journal changed, never what it says.
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
  label := case
    when tg_table_schema = 'life' and tg_table_name = 'journal_entries' then rec ->> 'entry_on'
    else coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'full_name', rec ->> 'description', rec ->> 'id')
  end;
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

-- ─── 20261126000001_kouture_modules.sql ────────────────────────────────────

-- Kouture Life OS — Phase 4: Kouture Nail Bar business modules.
-- Adds client notes, inventory, marketing/social planning, policies and the
-- Nailzy calendar sync log, plus columns the calendar import needs.

-- Nailzy bookings arrive as calendar events: keep the names exactly as booked,
-- even before they are matched to a client record or a service on the menu.
alter table kouture.appointments
  add column client_label  text check (length(client_label) <= 160),
  add column service_label text check (length(service_label) <= 400);

alter table kouture.clients
  add column instagram text check (length(instagram) <= 60),
  add column allergies text check (length(allergies) <= 500),
  add column source    text not null default 'manual' check (source in ('manual', 'nailzy', 'import'));

alter table kouture.services
  add column description text check (length(description) <= 1000);

create table kouture.client_notes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  client_id  uuid not null references kouture.clients (id) on delete cascade,
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kouture_client_notes_client on kouture.client_notes (owner_id, client_id, created_at);

create table kouture.inventory_items (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  name           text not null check (length(name) between 1 and 120),
  category       text not null default 'other' check (category in (
                   'gel', 'acrylic', 'polish', 'tools', 'nail_art', 'disposables',
                   'sanitation', 'retail', 'other')),
  unit           text not null default 'unit' check (length(unit) between 1 and 20),
  on_hand        numeric(10, 2) not null default 0 check (on_hand >= 0),
  reorder_at     numeric(10, 2) not null default 0 check (reorder_at >= 0),
  unit_cost_cents integer check (unit_cost_cents >= 0),
  supplier       text check (length(supplier) <= 120),
  notes          text check (length(notes) <= 1000),
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One calendar for marketing: campaigns, promos, social posts and client messages.
create table kouture.marketing_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  title        text not null check (length(title) between 1 and 160),
  channel      text not null check (channel in (
                 'instagram', 'tiktok', 'facebook', 'sms', 'email', 'in_salon', 'other')),
  kind         text not null check (kind in (
                 'post', 'reel', 'story', 'campaign', 'promo', 'message', 'event')),
  scheduled_on date,
  status       text not null default 'idea' check (status in (
                 'idea', 'drafting', 'ready', 'scheduled', 'published')),
  caption      text check (length(caption) <= 2200),
  notes        text check (length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index kouture_marketing_owner_day on kouture.marketing_items (owner_id, scheduled_on);

create table kouture.policies (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  title      text not null check (length(title) between 1 and 120),
  body       text not null check (length(body) between 1 and 5000),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per calendar sync, so the owner (and the audit log) can see what changed.
create table kouture.sync_runs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  source     text not null check (source in ('nailzy_calendar')),
  ran_at     timestamptz not null default now(),
  ok         boolean not null,
  added      integer not null default 0 check (added >= 0),
  updated    integer not null default 0 check (updated >= 0),
  cancelled  integer not null default 0 check (cancelled >= 0),
  skipped    integer not null default 0 check (skipped >= 0),
  message    text check (length(message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kouture_sync_runs_owner_time on kouture.sync_runs (owner_id, ran_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['client_notes', 'inventory_items', 'marketing_items', 'policies', 'sync_runs'] loop
    execute format('alter table kouture.%I enable row level security', t);
    execute format(
      'create policy %I on kouture.%I for all to authenticated, kouture_agent
         using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t || '_owner_only', t);
    execute format('grant select, insert, update, delete on kouture.%I to authenticated', t);
    execute format('grant select on kouture.%I to kouture_agent', t);
    execute format(
      'create trigger %I after insert or update or delete on kouture.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    execute format(
      'create trigger %I before update on kouture.%I
         for each row execute function core.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- Sync history is a record of what happened: never rewritten.
revoke update, delete on kouture.sync_runs from authenticated;

-- Label appointments by who booked, and keep client note text out of the log.
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
  label := case
    when tg_table_schema = 'life' and tg_table_name = 'journal_entries' then rec ->> 'entry_on'
    when tg_table_schema = 'kouture' and tg_table_name = 'client_notes' then 'note'
    else coalesce(rec ->> 'title', rec ->> 'name', rec ->> 'full_name', rec ->> 'client_label',
                  rec ->> 'description', rec ->> 'id')
  end;
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

-- ─── 20261127000001_tax_payments.sql ───────────────────────────────────────

-- Kouture Life OS — estimated tax payments the owner has made (IRS / state),
-- so the Taxes page can compare what's been paid with what to set aside.

create table kouture.tax_payments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  tax_year     smallint not null check (tax_year between 2000 and 2100),
  quarter      smallint not null check (quarter between 1 and 4),
  jurisdiction text not null default 'federal' check (jurisdiction in ('federal', 'state')),
  amount_cents integer not null check (amount_cents > 0),
  paid_on      date not null,
  note         text check (length(note) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index kouture_tax_payments_owner_year on kouture.tax_payments (owner_id, tax_year);

alter table kouture.tax_payments enable row level security;
create policy tax_payments_owner_only on kouture.tax_payments for all to authenticated, kouture_agent
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on kouture.tax_payments to authenticated;
-- The Finance Manager can read payments to plan; only the owner records them.
grant select on kouture.tax_payments to kouture_agent;
create trigger tax_payments_audit after insert or update or delete on kouture.tax_payments
  for each row execute function core.audit_row_change();
create trigger tax_payments_updated_at before update on kouture.tax_payments
  for each row execute function core.set_updated_at();

-- ─── 20261128000001_ai_team.sql ────────────────────────────────────────────

-- Kouture Life OS — Phase 5: the AI management team.
-- Agents keep task lists and a chat thread with the owner, and file approval
-- requests. They write only through kouture.agent_file(), which records each
-- change in the audit log under the agent's name. Outward actions are never
-- taken here: they stay pending in core.approvals until the owner decides.

create table kouture.agent_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  agent_key   text not null check (agent_key in (
                'ceo', 'marketing_director', 'finance_manager', 'operations_manager',
                'client_relations', 'inventory_manager', 'business_analyst')),
  -- Stable identity of the condition that raised the task, so re-runs update
  -- it instead of piling up duplicates, and it closes when the condition clears.
  source_key  text not null check (length(source_key) between 1 and 200),
  title       text not null check (length(title) between 1 and 200),
  detail      text check (length(detail) <= 2000),
  severity    text not null default 'attention' check (severity in ('info', 'attention', 'urgent')),
  href        text check (href ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  status      text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, source_key)
);
create index kouture_agent_tasks_open on kouture.agent_tasks (owner_id, status, agent_key);

create table kouture.agent_messages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  agent_key  text not null check (agent_key in (
               'ceo', 'marketing_director', 'finance_manager', 'operations_manager',
               'client_relations', 'inventory_manager', 'business_analyst')),
  author     text not null check (author in ('agent', 'owner')),
  kind       text not null default 'note' check (kind in ('briefing', 'note', 'reply')),
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kouture_agent_messages_thread on kouture.agent_messages (owner_id, agent_key, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['agent_tasks', 'agent_messages'] loop
    execute format('alter table kouture.%I enable row level security', t);
    execute format(
      'create policy %I on kouture.%I for select to authenticated, kouture_agent
         using (owner_id = auth.uid())', t || '_owner_select', t);
    execute format('grant select on kouture.%I to authenticated, kouture_agent', t);
    execute format(
      'create trigger %I after insert or update or delete on kouture.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    execute format(
      'create trigger %I before update on kouture.%I
         for each row execute function core.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- The owner can close or dismiss a task, and write to an agent's thread as herself.
create policy agent_tasks_owner_close on kouture.agent_tasks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant update (status, resolved_at) on kouture.agent_tasks to authenticated;
create policy agent_messages_owner_write on kouture.agent_messages for insert to authenticated
  with check (owner_id = auth.uid() and author = 'owner');
grant insert on kouture.agent_messages to authenticated;

-- ── Agent attribution ───────────────────────────────────────────────────────
-- kouture.agent_file() marks its transaction with the acting agent, so the
-- audit log records the agent, not the person whose session ran it.
create or replace function core.current_actor_type()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when nullif(current_setting('kouture.acting_agent', true), '') is not null then 'agent'
    else case current_setting('role', true)
      when 'kouture_agent'  then 'agent'
      when 'life_assistant' then 'assistant'
      else case when auth.uid() is not null then 'owner' else 'system' end
    end
  end
$$;

create or replace function core.current_actor_id()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when nullif(current_setting('kouture.acting_agent', true), '') is not null
      then current_setting('kouture.acting_agent', true)
    when current_setting('role', true) in ('kouture_agent', 'life_assistant')
      then coalesce(core.jwt_claim('agent_key'), 'unknown-agent')
    else coalesce(auth.uid()::text, 'system')
  end
$$;

-- The only way agents write. Kinds:
--   task     upsert a task by source_key (a dismissed task stays dismissed)
--   resolve  close an open task whose condition has cleared
--   message  post to the agent's thread
--   approval file a pending approval request, once per payload.sourceKey
create or replace function kouture.agent_file(p_agent_key text, p_kind text, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid;
  v_source text := p_data ->> 'sourceKey';
begin
  if v_owner is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_agent_key not in ('ceo', 'marketing_director', 'finance_manager', 'operations_manager',
                         'client_relations', 'inventory_manager', 'business_analyst') then
    raise exception 'unknown agent %', p_agent_key using errcode = '22023';
  end if;
  -- An agent connecting directly may only act as itself.
  if current_setting('role', true) = 'kouture_agent'
     and core.jwt_claim('agent_key') is distinct from p_agent_key then
    raise exception 'agents may only act as themselves' using errcode = '42501';
  end if;
  perform set_config('kouture.acting_agent', p_agent_key, true);

  if p_kind = 'task' then
    insert into kouture.agent_tasks (owner_id, agent_key, source_key, title, detail, severity, href)
    values (v_owner, p_agent_key, v_source, p_data ->> 'title', p_data ->> 'detail',
            coalesce(p_data ->> 'severity', 'attention'), p_data ->> 'href')
    on conflict (owner_id, source_key) do update
      set title = excluded.title,
          detail = excluded.detail,
          severity = excluded.severity,
          href = excluded.href,
          status = case when kouture.agent_tasks.status = 'dismissed' then 'dismissed' else 'open' end,
          resolved_at = case when kouture.agent_tasks.status = 'dismissed'
                             then kouture.agent_tasks.resolved_at end
      where (kouture.agent_tasks.title, kouture.agent_tasks.detail, kouture.agent_tasks.severity,
             kouture.agent_tasks.href, kouture.agent_tasks.status)
            is distinct from
            (excluded.title, excluded.detail, excluded.severity, excluded.href,
             case when kouture.agent_tasks.status = 'dismissed' then 'dismissed' else 'open' end)
    returning id into v_id;
    if v_id is null then
      select id into v_id from kouture.agent_tasks where owner_id = v_owner and source_key = v_source;
    end if;

  elsif p_kind = 'resolve' then
    update kouture.agent_tasks
       set status = 'done', resolved_at = now()
     where owner_id = v_owner and source_key = v_source and status = 'open'
           and agent_key = p_agent_key
    returning id into v_id;

  elsif p_kind = 'message' then
    insert into kouture.agent_messages (owner_id, agent_key, author, kind, body)
    values (v_owner, p_agent_key, 'agent', coalesce(p_data ->> 'kind', 'note'), p_data ->> 'body')
    returning id into v_id;

  elsif p_kind = 'approval' then
    -- Once per source key, whatever the owner decided: a declined request is
    -- not filed again (keys that should recur carry their week or month).
    select id into v_id from core.approvals
     where owner_id = v_owner and payload ->> 'sourceKey' = v_source
     order by created_at desc limit 1;
    if v_id is null then
      insert into core.approvals (owner_id, domain, requested_by, action_type, title, summary, payload, risk)
      values (v_owner, 'kouture', p_agent_key, p_data ->> 'actionType', p_data ->> 'title',
              p_data ->> 'summary', coalesce(p_data -> 'payload', '{}'::jsonb) || jsonb_build_object('sourceKey', v_source),
              coalesce(p_data ->> 'risk', 'medium'))
      returning id into v_id;
    end if;

  else
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  perform set_config('kouture.acting_agent', '', true);
  return v_id;
end $$;

revoke all on function kouture.agent_file(text, text, jsonb) from public, anon;
grant execute on function kouture.agent_file(text, text, jsonb) to authenticated, kouture_agent;

-- ─── 20261129000001_personal_assistant.sql ─────────────────────────────────

-- Kouture Life OS — the personal assistant for My Life.
-- Same shape as the Kouture team, kept entirely in the life schema so no
-- business agent can ever read it. Writes go through life.assistant_file(),
-- attributed to the assistant in the audit log.

create table life.assistant_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  source_key  text not null check (length(source_key) between 1 and 200),
  title       text not null check (length(title) between 1 and 200),
  detail      text check (length(detail) <= 2000),
  severity    text not null default 'attention' check (severity in ('info', 'attention', 'urgent')),
  href        text check (href ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  status      text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, source_key)
);
create index life_assistant_tasks_open on life.assistant_tasks (owner_id, status);

create table life.assistant_messages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  author     text not null check (author in ('assistant', 'owner')),
  kind       text not null default 'note' check (kind in ('briefing', 'note', 'reply')),
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index life_assistant_messages_thread on life.assistant_messages (owner_id, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['assistant_tasks', 'assistant_messages'] loop
    execute format('alter table life.%I enable row level security', t);
    execute format(
      'create policy %I on life.%I for select to authenticated, life_assistant
         using (owner_id = auth.uid())', t || '_owner_select', t);
    execute format('grant select on life.%I to authenticated, life_assistant', t);
    execute format(
      'create trigger %I after insert or update or delete on life.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    execute format(
      'create trigger %I before update on life.%I
         for each row execute function core.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

create policy assistant_tasks_owner_close on life.assistant_tasks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant update (status, resolved_at) on life.assistant_tasks to authenticated;
create policy assistant_messages_owner_write on life.assistant_messages for insert to authenticated
  with check (owner_id = auth.uid() and author = 'owner');
grant insert on life.assistant_messages to authenticated;

-- The assistant is attributed as 'assistant'; Kouture agents as 'agent'.
create or replace function core.current_actor_type()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when nullif(current_setting('kouture.acting_agent', true), '') = 'life_assistant' then 'assistant'
    when nullif(current_setting('kouture.acting_agent', true), '') is not null then 'agent'
    else case current_setting('role', true)
      when 'kouture_agent'  then 'agent'
      when 'life_assistant' then 'assistant'
      else case when auth.uid() is not null then 'owner' else 'system' end
    end
  end
$$;

-- Kinds: task (upsert by source key; a dismissed task stays dismissed),
-- resolve (close an open task whose condition cleared), message.
create or replace function life.assistant_file(p_kind text, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid;
  v_source text := p_data ->> 'sourceKey';
begin
  if v_owner is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- Business agents never act in the personal domain.
  if current_setting('role', true) = 'kouture_agent' then
    raise exception 'business agents cannot act in My Life' using errcode = '42501';
  end if;
  perform set_config('kouture.acting_agent', 'life_assistant', true);

  if p_kind = 'task' then
    insert into life.assistant_tasks (owner_id, source_key, title, detail, severity, href)
    values (v_owner, v_source, p_data ->> 'title', p_data ->> 'detail',
            coalesce(p_data ->> 'severity', 'attention'), p_data ->> 'href')
    on conflict (owner_id, source_key) do update
      set title = excluded.title,
          detail = excluded.detail,
          severity = excluded.severity,
          href = excluded.href,
          status = case when life.assistant_tasks.status = 'dismissed' then 'dismissed' else 'open' end,
          resolved_at = case when life.assistant_tasks.status = 'dismissed'
                             then life.assistant_tasks.resolved_at end
      where (life.assistant_tasks.title, life.assistant_tasks.detail, life.assistant_tasks.severity,
             life.assistant_tasks.href, life.assistant_tasks.status)
            is distinct from
            (excluded.title, excluded.detail, excluded.severity, excluded.href,
             case when life.assistant_tasks.status = 'dismissed' then 'dismissed' else 'open' end)
    returning id into v_id;
    if v_id is null then
      select id into v_id from life.assistant_tasks where owner_id = v_owner and source_key = v_source;
    end if;

  elsif p_kind = 'resolve' then
    update life.assistant_tasks
       set status = 'done', resolved_at = now()
     where owner_id = v_owner and source_key = v_source and status = 'open'
    returning id into v_id;

  elsif p_kind = 'message' then
    insert into life.assistant_messages (owner_id, author, kind, body)
    values (v_owner, 'assistant', coalesce(p_data ->> 'kind', 'note'), p_data ->> 'body')
    returning id into v_id;

  else
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  perform set_config('kouture.acting_agent', '', true);
  return v_id;
end $$;

revoke all on function life.assistant_file(text, jsonb) from public, anon;
grant execute on function life.assistant_file(text, jsonb) to authenticated, life_assistant;
