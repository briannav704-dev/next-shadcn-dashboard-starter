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
