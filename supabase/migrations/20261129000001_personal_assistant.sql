-- Kouture Life OS — the personal assistant for My Life.
-- Same shape as the Kouture team, kept entirely in the life schema so no
-- business agent can ever read it. Writes go through life.assistant_file(),
-- attributed to the assistant in the audit log.

create table life.assistant_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references core.profiles (id) on delete cascade,
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
create index life_assistant_tasks_open on life.assistant_tasks (owner_id, status);

create table life.assistant_messages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references core.profiles (id) on delete cascade,
  author     text not null check (author in ('assistant', 'owner')),
  kind       text not null default 'note' check (kind in ('briefing', 'note', 'reply')),
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index life_assistant_messages_thread on life.assistant_messages (owner_id, created_at);

do $$
declare
  t text;
begin
  foreach t in array array['assistant_tasks', 'assistant_messages'] loop
    execute format('alter table life.%I enable row level security', t);
    execute format(
      'create policy %I on life.%I for select to authenticated, life_assistant
         using (owner_id = auth.uid())', t || '_owner_select', t);
    execute format('grant select on life.%I to authenticated, life_assistant', t);
    execute format(
      'create trigger %I after insert or update or delete on life.%I
         for each row execute function core.audit_row_change()', t || '_audit', t);
    execute format(
      'create trigger %I before update on life.%I
         for each row execute function core.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

create policy assistant_tasks_owner_close on life.assistant_tasks for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant update (status, resolved_at) on life.assistant_tasks to authenticated;
create policy assistant_messages_owner_write on life.assistant_messages for insert to authenticated
  with check (owner_id = auth.uid() and author = 'owner');
grant insert on life.assistant_messages to authenticated;

-- The assistant is attributed as 'assistant'; Kouture agents as 'agent'.
create or replace function core.current_actor_type()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when nullif(current_setting('kouture.acting_agent', true), '') = 'life_assistant' then 'assistant'
    when nullif(current_setting('kouture.acting_agent', true), '') is not null then 'agent'
    else case current_setting('role', true)
      when 'kouture_agent'  then 'agent'
      when 'life_assistant' then 'assistant'
      else case when auth.uid() is not null then 'owner' else 'system' end
    end
  end
$$;

-- Kinds: task (upsert by source key; a dismissed task stays dismissed),
-- resolve (close an open task whose condition cleared), message.
create or replace function life.assistant_file(p_kind text, p_data jsonb)
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
  -- Business agents never act in the personal domain.
  if current_setting('role', true) = 'kouture_agent' then
    raise exception 'business agents cannot act in My Life' using errcode = '42501';
  end if;
  perform set_config('kouture.acting_agent', 'life_assistant', true);

  if p_kind = 'task' then
    insert into life.assistant_tasks (owner_id, source_key, title, detail, severity, href)
    values (v_owner, v_source, p_data ->> 'title', p_data ->> 'detail',
            coalesce(p_data ->> 'severity', 'attention'), p_data ->> 'href')
    on conflict (owner_id, source_key) do update
      set title = excluded.title,
          detail = excluded.detail,
          severity = excluded.severity,
          href = excluded.href,
          status = case when life.assistant_tasks.status = 'dismissed' then 'dismissed' else 'open' end,
          resolved_at = case when life.assistant_tasks.status = 'dismissed'
                             then life.assistant_tasks.resolved_at end
      where (life.assistant_tasks.title, life.assistant_tasks.detail, life.assistant_tasks.severity,
             life.assistant_tasks.href, life.assistant_tasks.status)
            is distinct from
            (excluded.title, excluded.detail, excluded.severity, excluded.href,
             case when life.assistant_tasks.status = 'dismissed' then 'dismissed' else 'open' end)
    returning id into v_id;
    if v_id is null then
      select id into v_id from life.assistant_tasks where owner_id = v_owner and source_key = v_source;
    end if;

  elsif p_kind = 'resolve' then
    update life.assistant_tasks
       set status = 'done', resolved_at = now()
     where owner_id = v_owner and source_key = v_source and status = 'open'
    returning id into v_id;

  elsif p_kind = 'message' then
    insert into life.assistant_messages (owner_id, author, kind, body)
    values (v_owner, 'assistant', coalesce(p_data ->> 'kind', 'note'), p_data ->> 'body')
    returning id into v_id;

  else
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;

  perform set_config('kouture.acting_agent', '', true);
  return v_id;
end $$;

revoke all on function life.assistant_file(text, jsonb) from public, anon;
grant execute on function life.assistant_file(text, jsonb) to authenticated, life_assistant;
