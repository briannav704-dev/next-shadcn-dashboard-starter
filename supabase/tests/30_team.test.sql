-- AI team: agents write only through kouture.agent_file, attributed to the agent.
\set ON_ERROR_STOP on
set client_min_messages = warning;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);

do $$
declare t uuid; t2 uuid; a uuid; a2 uuid;
begin
  t := kouture.agent_file('operations_manager', 'task',
        '{"sourceKey":"ops:checkout","title":"2 visits to check out","severity":"attention","href":"/kouture/appointments?view=checkout"}');
  t2 := kouture.agent_file('operations_manager', 'task',
        '{"sourceKey":"ops:checkout","title":"3 visits to check out","severity":"attention"}');
  if t is distinct from t2 then raise exception 'FAIL: re-filing a task created a duplicate'; end if;
  if (select title from kouture.agent_tasks where id = t) <> '3 visits to check out' then
    raise exception 'FAIL: task not updated in place';
  end if;

  a := kouture.agent_file('client_relations', 'approval',
        '{"sourceKey":"cr:winback:2026-W48","actionType":"send_message","title":"Win-back texts","summary":"Text 3 clients","payload":{"channel":"sms"}}');
  a2 := kouture.agent_file('client_relations', 'approval',
        '{"sourceKey":"cr:winback:2026-W48","actionType":"send_message","title":"Win-back texts","summary":"Text 3 clients"}');
  if a is distinct from a2 then raise exception 'FAIL: duplicate pending approval filed'; end if;
  update core.approvals set status = 'rejected' where id = a;
  if kouture.agent_file('client_relations', 'approval',
       '{"sourceKey":"cr:winback:2026-W48","actionType":"send_message","title":"x","summary":"x"}') is distinct from a then
    raise exception 'FAIL: a declined request was filed again';
  end if;
  if (select requested_by from core.approvals where id = a) <> 'client_relations' then
    raise exception 'FAIL: approval not attributed to the agent';
  end if;

  perform kouture.agent_file('operations_manager', 'resolve', '{"sourceKey":"ops:checkout"}');
  if (select status from kouture.agent_tasks where id = t) <> 'done' then
    raise exception 'FAIL: task not resolved';
  end if;
  perform kouture.agent_file('ceo', 'message', '{"kind":"briefing","body":"Good morning"}');
end $$;
select 'ok: agents file, update, resolve and dedupe through agent_file';

do $$ begin
  if not exists (select 1 from core.audit_log where entity_type = 'agent_tasks'
                 and actor_type = 'agent' and actor_id = 'operations_manager') then
    raise exception 'FAIL: agent task not attributed to the agent in the audit log';
  end if;
  if not exists (select 1 from core.audit_log where entity_type = 'approvals'
                 and actor_type = 'agent' and actor_id = 'client_relations') then
    raise exception 'FAIL: agent approval not attributed to the agent';
  end if;
  -- Attribution ends with the call: the owner's next write is the owner's.
  insert into kouture.agent_messages (agent_key, author, body) values ('ceo', 'owner', 'Thanks!');
  if (select actor_type from core.audit_log where entity_type = 'agent_messages'
      order by id desc limit 1) <> 'owner' then
    raise exception 'FAIL: agent attribution leaked into the owner''s write';
  end if;
end $$;
select 'ok: agent actions are attributed to the agent, and only for that call';

do $$ begin
  begin
    insert into kouture.agent_tasks (agent_key, source_key, title) values ('ceo', 'x', 'forged');
    raise exception 'FAIL: owner session wrote a task directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into kouture.agent_messages (agent_key, author, body) values ('ceo', 'agent', 'forged');
    raise exception 'FAIL: owner session posted as an agent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform kouture.agent_file('hacker', 'message', '{"body":"x"}');
    raise exception 'FAIL: unknown agent accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
select 'ok: no direct agent writes, no unknown agents';

-- An agent connecting directly can act only as itself and still can't approve.
reset role;
set role kouture_agent;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"kouture_agent","agent_key":"inventory_manager"}', false);
do $$ begin
  perform kouture.agent_file('inventory_manager', 'message', '{"body":"Restock soon"}');
  begin
    perform kouture.agent_file('ceo', 'message', '{"body":"impersonating"}');
    raise exception 'FAIL: agent impersonated another agent';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: agents can only act as themselves';

reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$ begin
  begin
    perform kouture.agent_file('ceo', 'message', '{"body":"x"}');
    raise exception 'FAIL: anon called agent_file';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: anon cannot call agent_file';
reset role;

-- The owner can complete an approved request (approved -> executed), once.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
do $$
declare a uuid;
begin
  a := kouture.agent_file('inventory_manager', 'approval',
        '{"sourceKey":"inv:restock:test-exec","actionType":"make_purchase","title":"Restock","summary":"Gel"}');
  update core.approvals set status = 'approved' where id = a;
  update core.approvals set status = 'executed', decision_note = 'Marked done by you.' where id = a;
  if (select executed_at from core.approvals where id = a) is null then
    raise exception 'FAIL: executed_at not stamped';
  end if;
  begin
    update core.approvals set status = 'failed' where id = a;
    raise exception 'FAIL: completed request changed again';
  exception when raise_exception then null;
  end;
end $$;
select 'ok: approved requests complete once';
reset role;
