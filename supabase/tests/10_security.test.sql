-- Security tests. Each block raises on failure; the runner stops at the first.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Owner signs up; a second sign-up must be refused.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'owner@example.com');
do $$ begin
  begin
    insert into auth.users (email) values ('intruder@example.com');
    raise exception 'FAIL: second user was allowed to sign up';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: single-owner sign-up enforced';

-- Act as the owner.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);

insert into life.tasks (title) values ('Book brow appointment');
insert into life.habits (name) values ('Drink water');
insert into kouture.clients (full_name, phone) values ('Ava Client', '555-0100');
insert into kouture.services (name, duration_minutes, price_cents, deposit_cents)
  values ('Gel-X Full Set', 120, 8500, 2500);
select 'ok: owner can write life and kouture';

do $$ begin
  if (select count(*) from core.audit_log where domain in ('life','kouture')) < 4 then
    raise exception 'FAIL: writes were not audited';
  end if;
  if exists (select 1 from core.audit_log where actor_type <> 'owner') then
    raise exception 'FAIL: owner writes attributed to wrong actor';
  end if;
end $$;
select 'ok: every write is in the audit log as owner';

-- Audit log is append-only, even for the owner.
do $$ begin
  begin
    update core.audit_log set summary = 'tampered';
    raise exception 'FAIL: owner updated audit log';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from core.audit_log;
    raise exception 'FAIL: owner deleted audit log';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role service_role;
do $$ begin
  begin
    delete from core.audit_log;
    raise exception 'FAIL: service_role deleted audit log';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: audit log is append-only for owner and service_role';

-- Business agent: sees kouture, never life.
reset role;
set role kouture_agent;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"kouture_agent","agent_key":"client_relations"}', false);
do $$ begin
  if (select count(*) from kouture.clients) <> 1 then
    raise exception 'FAIL: kouture_agent cannot read clients';
  end if;
  begin
    perform 1 from life.tasks;
    raise exception 'FAIL: kouture_agent read life.tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from kouture.clients;
    raise exception 'FAIL: kouture_agent deleted clients';
  exception when insufficient_privilege then null;
  end;
  begin
    update kouture.clients set phone = '555-9999';
    raise exception 'FAIL: kouture_agent changed client phone';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into core.approvals (domain, requested_by, action_type, title, summary)
    values ('life', 'marketing', 'send_message', 'x', 'x');
    raise exception 'FAIL: kouture_agent filed a life approval';
  exception when insufficient_privilege then null;
  end;
end $$;
update kouture.clients set notes = 'Prefers almond shape';
insert into core.approvals (domain, requested_by, action_type, title, summary, payload)
values ('kouture', 'marketing', 'send_message', 'Win-back text', 'Text 12 lapsed clients',
        '{"channel":"sms","body":"We miss you!"}');
do $$ begin
  begin
    update core.approvals set status = 'approved';
    raise exception 'FAIL: agent approved its own request';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from core.audit_log;
    raise exception 'FAIL: agent read the audit log';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: kouture_agent scoped to kouture, cannot self-approve or read the audit log';

-- Personal assistant: sees life, never kouture.
reset role;
set role life_assistant;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$ begin
  if (select count(*) from life.tasks) <> 1 then
    raise exception 'FAIL: life_assistant cannot read tasks';
  end if;
  begin
    perform 1 from kouture.clients;
    raise exception 'FAIL: life_assistant read kouture.clients';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from life.tasks;
    raise exception 'FAIL: life_assistant deleted tasks';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: life_assistant scoped to life';

-- Anonymous visitors see nothing.
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$ begin
  begin
    perform 1 from kouture.clients;
    raise exception 'FAIL: anon read kouture';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: anon has no access';

-- Owner decides approvals; contents are frozen; transitions are enforced.
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$
declare a uuid;
begin
  select id into a from core.approvals limit 1;
  begin
    update core.approvals set payload = '{"body":"switched"}' where id = a;
    raise exception 'FAIL: approval payload was editable';
  exception when insufficient_privilege then null;
  end;
  update core.approvals set status = 'approved', decision_note = 'Looks lovely' where id = a;
  if (select decided_at from core.approvals where id = a) is null then
    raise exception 'FAIL: decided_at not stamped';
  end if;
  begin
    update core.approvals set status = 'pending' where id = a;
    raise exception 'FAIL: approval moved back to pending';
  exception when raise_exception then null;
  end;
end $$;
select 'ok: approvals immutable, owner-decided, one-way';

do $$ begin
  if not exists (select 1 from core.audit_log where actor_id = 'client_relations' and actor_type = 'agent'
                 and entity_type = 'clients') then
    raise exception 'FAIL: agent write not attributed to agent';
  end if;
  if not exists (select 1 from core.audit_log where entity_type = 'approvals' and action = 'update'
                 and actor_type = 'owner') then
    raise exception 'FAIL: approval decision not audited';
  end if;
end $$;
select 'ok: agent writes and approval decisions attributed in audit log';

-- A different signed-in identity sees none of the owner's rows.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', false);
do $$ begin
  if exists (select 1 from life.tasks) or exists (select 1 from kouture.clients)
     or exists (select 1 from core.audit_log) then
    raise exception 'FAIL: other identity can see owner data';
  end if;
end $$;
select 'ok: rows isolated by owner_id';
