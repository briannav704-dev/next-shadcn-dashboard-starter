-- Personal assistant: life-only, written through life.assistant_file, attributed.
\set ON_ERROR_STOP on
set client_min_messages = warning;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);

do $$
declare t uuid; t2 uuid;
begin
  t := life.assistant_file('task', '{"sourceKey":"life:overdue","title":"2 overdue tasks","severity":"attention","href":"/life/tasks"}');
  t2 := life.assistant_file('task', '{"sourceKey":"life:overdue","title":"3 overdue tasks","severity":"attention"}');
  if t is distinct from t2 then raise exception 'FAIL: duplicate assistant task'; end if;
  perform life.assistant_file('resolve', '{"sourceKey":"life:overdue"}');
  if (select status from life.assistant_tasks where id = t) <> 'done' then
    raise exception 'FAIL: assistant task not resolved';
  end if;
  perform life.assistant_file('message', '{"kind":"briefing","body":"Good morning"}');
  if not exists (select 1 from core.audit_log where entity_type = 'assistant_tasks'
                 and actor_type = 'assistant' and actor_id = 'life_assistant') then
    raise exception 'FAIL: assistant work not attributed to the assistant';
  end if;
  begin
    insert into life.assistant_messages (author, body) values ('assistant', 'forged');
    raise exception 'FAIL: owner session posted as the assistant';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: assistant files, dedupes, resolves and is attributed through assistant_file';

-- Business agents can't see or touch the assistant's personal notes.
reset role;
set role kouture_agent;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"kouture_agent","agent_key":"ceo"}', false);
do $$ begin
  begin
    perform 1 from life.assistant_messages;
    raise exception 'FAIL: kouture_agent read assistant messages';
  exception when insufficient_privilege then null;
  end;
  begin
    perform life.assistant_file('message', '{"body":"x"}');
    raise exception 'FAIL: kouture_agent called assistant_file';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: business agents are kept out of the assistant';

reset role;
set role life_assistant;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"life_assistant"}', false);
do $$ begin
  if (select count(*) from life.assistant_tasks) < 1 then
    raise exception 'FAIL: life_assistant cannot read its tasks';
  end if;
  begin
    perform 1 from kouture.agent_tasks;
    raise exception 'FAIL: life_assistant read the business team';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ok: life_assistant reads its own work, never the business team';
reset role;
