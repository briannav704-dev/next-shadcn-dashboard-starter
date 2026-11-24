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
