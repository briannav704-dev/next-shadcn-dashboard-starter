-- Kouture Life OS — Phase 5: the AI management team.
-- Agents keep task lists and a chat thread with the owner, and file approval
-- requests. They write only through kouture.agent_file(), which records each
-- change in the audit log under the agent's name. Outward actions are never
-- taken here: they stay pending in core.approvals until the owner decides.

create table kouture.agent_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  agent_key   text not null check (agent_key in (
                'ceo', 'marketing_director', 'finance_manager', 'operations_manager',
                'client_relations', 'inventory_manager', 'business_analyst')),
  -- Stable identity of the condition that raised the task, so re-runs update
  -- it instead of piling up duplicates, and it closes when the condition clears.
  source_key  text not null check (length(source_key) between 1 and 200),
  title       text not null check (length(title) between 1 and 200),
  detail      text check (length(detail) <= 2000),
  severity    text not null default 'attention' check (severity in ('info', 'attention', 'urgent')),
  href        text check (href ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  status      text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, source_key)
);
create index kouture_agent_tasks_open on kouture.agent_tasks (owner_id, status, agent_key);

create table kouture.agent_messages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  agent_key  text not null check (agent_key in (
               'ceo', 'marketing_director', 'finance_manager', 'operations_manager',
               'client_relations', 'inventory_manager', 'business_analyst')),
  author     text not null check (author in ('agent', 'owner')),
  kind       text not null default 'note' check (kind in ('briefing', 'note', 'reply')),
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kouture_agent_messages_thread on kouture.agent_messages (owner_id, agent_key, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['agent_tasks', 'agent_messages'] loop
    execute format('alter table kouture.%I enable row level security', t);
    execute format(
      'create policy %I on kouture.%I for select to authenticated, kouture_agent
         using (owner_id = auth.uid())', t || '_owner_select', t);
    execute format('grant select on kouture.%I to authenticated, kouture_agent', t);
    execute format(
      'create trigger %I after insert or update or delete on kouture.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    execute format(
      'create trigger %I before update on kouture.%I
         for each row execute function core.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- The owner can close or dismiss a task, and write to an agent's thread as herself.
create policy agent_tasks_owner_close on kouture.agent_tasks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant update (status, resolved_at) on kouture.agent_tasks to authenticated;
create policy agent_messages_owner_write on kouture.agent_messages for insert to authenticated
  with check (owner_id = auth.uid() and author = 'owner');
grant insert on kouture.agent_messages to authenticated;

-- ── Agent attribution ───────────────────────────────────────────────────────
-- kouture.agent_file() marks its transaction with the acting agent, so the
-- audit log records the agent, not the person whose session ran it.
create or replace function core.current_actor_type()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when nullif(current_setting('kouture.acting_agent', true), '') is not null then 'agent'
    else case current_setting('role', true)
      when 'kouture_agent'  then 'agent'
      when 'life_assistant' then 'assistant'
      else case when auth.uid() is not null then 'owner' else 'system' end
    end
  end
$$;

create or replace function core.current_actor_id()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when nullif(current_setting('kouture.acting_agent', true), '') is not null
      then current_setting('kouture.acting_agent', true)
    when current_setting('role', true) in ('kouture_agent', 'life_assistant')
      then coalesce(core.jwt_claim('agent_key'), 'unknown-agent')
    else coalesce(auth.uid()::text, 'system')
  end
$$;

-- The only way agents write. Kinds:
--   task     upsert a task by source_key (a dismissed task stays dismissed)
--   resolve  close an open task whose condition has cleared
--   message  post to the agent's thread
--   approval file a pending approval request, once per payload.sourceKey
create or replace function kouture.agent_file(p_agent_key text, p_kind text, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid;
  v_source text := p_data ->> 'sourceKey';
begin
  if v_owner is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_agent_key not in ('ceo', 'marketing_director', 'finance_manager', 'operations_manager',
                         'client_relations', 'inventory_manager', 'business_analyst') then
    raise exception 'unknown agent %', p_agent_key using errcode = '22023';
  end if;
  -- An agent connecting directly may only act as itself.
  if current_setting('role', true) = 'kouture_agent'
     and core.jwt_claim('agent_key') is distinct from p_agent_key then
    raise exception 'agents may only act as themselves' using errcode = '42501';
  end if;
  perform set_config('kouture.acting_agent', p_agent_key, true);

  if p_kind = 'task' then
    insert into kouture.agent_tasks (owner_id, agent_key, source_key, title, detail, severity, href)
    values (v_owner, p_agent_key, v_source, p_data ->> 'title', p_data ->> 'detail',
            coalesce(p_data ->> 'severity', 'attention'), p_data ->> 'href')
    on conflict (owner_id, source_key) do update
      set title = excluded.title,
          detail = excluded.detail,
          severity = excluded.severity,
          href = excluded.href,
          status = case when kouture.agent_tasks.status = 'dismissed' then 'dismissed' else 'open' end,
          resolved_at = case when kouture.agent_tasks.status = 'dismissed'
                             then kouture.agent_tasks.resolved_at end
      where (kouture.agent_tasks.title, kouture.agent_tasks.detail, kouture.agent_tasks.severity,
             kouture.agent_tasks.href, kouture.agent_tasks.status)
            is distinct from
            (excluded.title, excluded.detail, excluded.severity, excluded.href,
             case when kouture.agent_tasks.status = 'dismissed' then 'dismissed' else 'open' end)
    returning id into v_id;
    if v_id is null then
      select id into v_id from kouture.agent_tasks where owner_id = v_owner and source_key = v_source;
    end if;

  elsif p_kind = 'resolve' then
    update kouture.agent_tasks
       set status = 'done', resolved_at = now()
     where owner_id = v_owner and source_key = v_source and status = 'open'
           and agent_key = p_agent_key
    returning id into v_id;

  elsif p_kind = 'message' then
    insert into kouture.agent_messages (owner_id, agent_key, author, kind, body)
    values (v_owner, p_agent_key, 'agent', coalesce(p_data ->> 'kind', 'note'), p_data ->> 'body')
    returning id into v_id;

  elsif p_kind = 'approval' then
    -- Once per source key, whatever the owner decided: a declined request is
    -- not filed again (keys that should recur carry their week or month).
    select id into v_id from core.approvals
     where owner_id = v_owner and payload ->> 'sourceKey' = v_source
     order by created_at desc limit 1;
    if v_id is null then
      insert into core.approvals (owner_id, domain, requested_by, action_type, title, summary, payload, risk)
      values (v_owner, 'kouture', p_agent_key, p_data ->> 'actionType', p_data ->> 'title',
              p_data ->> 'summary', coalesce(p_data -> 'payload', '{}'::jsonb) || jsonb_build_object('sourceKey', v_source),
              coalesce(p_data ->> 'risk', 'medium'))
      returning id into v_id;
    end if;

  else
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  perform set_config('kouture.acting_agent', '', true);
  return v_id;
end $$;

revoke all on function kouture.agent_file(text, text, jsonb) from public, anon;
grant execute on function kouture.agent_file(text, text, jsonb) to authenticated, kouture_agent;
