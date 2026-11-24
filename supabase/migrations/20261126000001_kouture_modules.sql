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
