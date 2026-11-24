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
