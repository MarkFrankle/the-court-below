-- Setup checklist (/setup). Run after hosts.sql.
-- Hosts (Sarah, Mark) edit everything; helpers join with the setup code and can only tick and untick.

create table setup_secret (id int primary key default 1 check (id = 1), code text not null);  -- RLS on, no policies: unreadable from the app
create table setup_editors (user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 30));
create table setup_sections (id uuid primary key default gen_random_uuid(), key text not null unique, title text not null,
  kind text not null check (kind in ('room', 'shopping', 'day')), position int not null);
create table setup_items (id uuid primary key default gen_random_uuid(), key text not null unique,
  section_id uuid not null references setup_sections on delete cascade,
  text text not null check (char_length(text) <= 200), note text,
  assignee text check (assignee in ('sarah', 'mark', 'hosts')),
  priority text not null default 'should' check (priority in ('must', 'should', 'nice')),
  slot text check (slot in ('fri_shops', 'fri_before_friends', 'fri_evening', 'sat_shops', 'sat_afternoon', 'before_doors')),
  position int not null,
  done_by uuid references setup_editors (user_id) on delete set null, done_at timestamptz,
  updated_at timestamptz not null default now());
create table setup_blockers (
  item_id uuid references setup_items on delete cascade,
  blocked_by_id uuid references setup_items on delete cascade,
  primary key (item_id, blocked_by_id),
  check (item_id <> blocked_by_id));

-- A task can't end up waiting on itself through a chain of blockers.
create function check_blocker_loop() returns trigger language plpgsql as $$
begin
  if exists (
    with recursive chain (id) as (
      select blocked_by_id from setup_blockers where item_id = new.blocked_by_id
      union
      select b.blocked_by_id from setup_blockers b join chain c on b.item_id = c.id)
    select 1 from chain where id = new.item_id)
  then
    raise exception 'blocker loop';
  end if;
  return new;
end $$;
create trigger check_blocker_loop before insert or update on setup_blockers
  for each row execute function check_blocker_loop();

create function is_setup_editor() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from setup_editors where user_id = auth.uid()) or is_host() $$;

-- The code is compared case-insensitively, with runs of spaces and hyphens treated as one hyphen.
create function join_setup(p_code text, p_name text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from setup_secret
    where code = lower(regexp_replace(trim(p_code), '[\s-]+', '-', 'g'))) then return false; end if;
  insert into setup_editors (user_id, name) values (auth.uid(), trim(p_name))
    on conflict (user_id) do update set name = excluded.name;
  return true;
end $$;

-- Hosts sign in by email and get their editor row (and name) from it, without the code.
create function claim_host_editor() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not is_host() then raise exception 'not host'; end if;
  select case lower(email) when 'sarah@frankle.fyi' then 'Sarah' when 'mark@frankle.fyi' then 'Mark' else 'Host' end
    into v_name from auth.users where id = auth.uid();
  insert into setup_editors (user_id, name) values (auth.uid(), v_name)
    on conflict (user_id) do update set name = excluded.name;
  return v_name;
end $$;

-- The only write helpers can make.
create function set_task_done(p_task uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_setup_editor() then raise exception 'not an editor'; end if;
  if is_host() and not exists (select 1 from setup_editors where user_id = auth.uid()) then
    perform claim_host_editor();
  end if;
  update setup_items set
    done_by = case when p_done then auth.uid() end,
    done_at = case when p_done then now() end,
    updated_at = now()
  where id = p_task;
end $$;

alter table setup_secret enable row level security;
alter table setup_editors enable row level security;
alter table setup_sections enable row level security;
alter table setup_items enable row level security;
alter table setup_blockers enable row level security;

create policy editors_read on setup_editors for select to authenticated using (is_setup_editor());
create policy editors_read on setup_sections for select to authenticated using (is_setup_editor());
create policy editors_read on setup_items for select to authenticated using (is_setup_editor());
create policy editors_read on setup_blockers for select to authenticated using (is_setup_editor());

create policy host_insert on setup_sections for insert to authenticated with check (is_host());
create policy host_update on setup_sections for update to authenticated using (is_host()) with check (is_host());
create policy host_delete on setup_sections for delete to authenticated using (is_host());
create policy host_insert on setup_items for insert to authenticated with check (is_host());
create policy host_update on setup_items for update to authenticated using (is_host()) with check (is_host());
create policy host_delete on setup_items for delete to authenticated using (is_host());
create policy host_insert on setup_blockers for insert to authenticated with check (is_host());
create policy host_update on setup_blockers for update to authenticated using (is_host()) with check (is_host());
create policy host_delete on setup_blockers for delete to authenticated using (is_host());

alter publication supabase_realtime add table setup_editors, setup_sections, setup_items, setup_blockers;

insert into setup_secret (code) values ('pain-and-panic');
