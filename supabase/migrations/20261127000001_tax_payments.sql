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
