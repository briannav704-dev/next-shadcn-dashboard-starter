-- Kouture Life OS — email campaigns, sent from the owner's own email app.
-- The app writes the email and picks only clients who agreed to marketing
-- email; the owner sends it herself (BCC). Nothing here sends anything.

create table kouture.email_campaigns (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  title           text not null check (length(title) between 1 and 120),
  subject         text not null check (length(subject) between 1 and 200),
  body            text not null check (length(body) between 1 and 10000),
  audience        text not null default 'all' check (audience in ('all', 'due', 'lapsed', 'birthdays')),
  status          text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at         timestamptz,
  recipient_count integer check (recipient_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index kouture_email_campaigns_owner on kouture.email_campaigns (owner_id, created_at desc);

-- One row per owner: details every marketing email must carry (CAN-SPAM
-- requires a valid postal address in commercial email).
create table kouture.business_profile (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  postal_address text check (length(postal_address) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (owner_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['email_campaigns', 'business_profile'] loop
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
