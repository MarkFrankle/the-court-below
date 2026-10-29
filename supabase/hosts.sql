-- Host role, shared by /setup and the game.
-- Run this first, before setup.sql and schema.sql.
create table hosts (user_id uuid primary key references auth.users on delete cascade);

create function is_host() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from hosts where user_id = auth.uid()) $$;

alter table hosts enable row level security;
create policy host_read on hosts for select using (user_id = auth.uid());

-- Both host users must exist in Authentication → Users first; re-run this line once Mark's user is created.
insert into hosts select id from auth.users where email in ('sarah@frankle.fyi', 'mark@frankle.fyi')
  on conflict do nothing;
