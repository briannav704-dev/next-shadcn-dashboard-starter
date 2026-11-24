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
