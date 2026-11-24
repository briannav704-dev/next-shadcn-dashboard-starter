-- Catalog-wide guarantees: these cover every table, including ones added later.
\set ON_ERROR_STOP on
set client_min_messages = warning;
reset role;

do $$
declare r record;
begin
  for r in
    select c.relname, n.nspname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('core', 'life', 'kouture') and c.relkind = 'r'
  loop
    if not (select relrowsecurity from pg_class where relname = r.relname
            and relnamespace = r.nspname::regnamespace) then
      raise exception 'FAIL: %.% has RLS disabled', r.nspname, r.relname;
    end if;
    if r.nspname = 'life' and has_table_privilege('kouture_agent', format('%I.%I', r.nspname, r.relname), 'select') then
      raise exception 'FAIL: kouture_agent can read life.%', r.relname;
    end if;
    if r.nspname = 'kouture' and has_table_privilege('life_assistant', format('%I.%I', r.nspname, r.relname), 'select') then
      raise exception 'FAIL: life_assistant can read kouture.%', r.relname;
    end if;
    if has_table_privilege('anon', format('%I.%I', r.nspname, r.relname), 'select') then
      raise exception 'FAIL: anon can read %.%', r.nspname, r.relname;
    end if;
    if r.nspname in ('life', 'kouture') and not exists (
      select 1 from pg_trigger t
      where t.tgrelid = format('%I.%I', r.nspname, r.relname)::regclass
        and t.tgfoid = 'core.audit_row_change'::regproc
    ) then
      raise exception 'FAIL: %.% is not audited', r.nspname, r.relname;
    end if;
  end loop;
end $$;
select 'ok: every table has RLS, domain-separated grants, no anon access, and auditing';

-- Journal text never lands in the audit log.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
insert into life.journal_entries (entry_on, mood, title, body)
values ('2026-11-24', 4, 'Secret title', 'Very private thoughts');
do $$ begin
  if exists (select 1 from core.audit_log where summary ilike '%private%' or summary ilike '%secret%') then
    raise exception 'FAIL: journal content leaked into the audit log';
  end if;
  if not exists (select 1 from core.audit_log where entity_type = 'journal_entries') then
    raise exception 'FAIL: journal change not audited';
  end if;
end $$;
select 'ok: journal changes audited without their contents';

-- Personal-module constraints hold.
do $$ begin
  begin
    insert into life.day_plans (day, priorities) values ('2026-11-24', array['a', 'b', 'c', 'd']);
    raise exception 'FAIL: more than three priorities accepted';
  exception when check_violation then null;
  end;
  begin
    insert into life.trips (name, destination, starts_on, ends_on) values ('x', 'y', '2026-12-10', '2026-12-01');
    raise exception 'FAIL: trip ending before it starts accepted';
  exception when check_violation then null;
  end;
end $$;
select 'ok: module constraints enforced';
reset role;

-- Kouture modules: sync history is append-only, note text stays out of the log,
-- and agents can read but not change stock.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
insert into kouture.sync_runs (source, ok, added) values ('nailzy_calendar', true, 3);
insert into kouture.client_notes (client_id, body)
  select id, 'Confidential: allergic to HEMA' from kouture.clients limit 1;
insert into kouture.inventory_items (name, on_hand, reorder_at) values ('Builder gel', 4, 2);
do $$ begin
  begin
    update kouture.sync_runs set added = 99;
    raise exception 'FAIL: sync history was rewritten';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from core.audit_log where summary ilike '%HEMA%') then
    raise exception 'FAIL: client note text leaked into the audit log';
  end if;
  begin
    insert into kouture.inventory_items (name, on_hand) values ('Bad', -1);
    raise exception 'FAIL: negative stock accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
set role kouture_agent;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"kouture_agent","agent_key":"inventory_manager"}', false);
do $$ begin
  if (select count(*) from kouture.inventory_items) <> 1 then
    raise exception 'FAIL: kouture_agent cannot read inventory';
  end if;
  begin
    update kouture.inventory_items set on_hand = 0;
    raise exception 'FAIL: kouture_agent changed stock';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: kouture modules: sync log append-only, notes private, agents read-only on stock';
reset role;
