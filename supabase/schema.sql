-- The Trial of the Shades. Run after hosts.sql; setup.sql is independent.
-- RLS is the security boundary: confessions, Round 2 answers, votes and Round 1 authors
-- are readable only by their writer and the hosts. The host remote copies what the room
-- should see into public tables at the right moment.

-- Game state: one row. Only the host remote changes it.
create table game (
  id int primary key default 1 check (id = 1),
  phase text not null default 'lobby',
  step int not null default 0,
  deadline_at timestamptz,
  updated_at timestamptz not null default now());
insert into game default values;

-- Given from_phase and from_step, it moves only if the game is still there, so two remotes pressing Next
-- at once move it one step, not two. Returns whether it moved.
create function set_phase(p text, s int, seconds int default 0, from_phase text default null, from_step int default null)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_host() then raise exception 'not host'; end if;
  update game set phase = p, step = s, updated_at = now(),
    deadline_at = case when seconds > 0 then now() + make_interval(secs => seconds) end
  where id = 1 and (from_phase is null or (phase = from_phase and step = from_step));
  return found;
end $$;

-- +10 seconds on the remote. Adds to whatever is left, or restarts from now if time is up.
create function add_time(seconds int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_host() then raise exception 'not host'; end if;
  update game set deadline_at = greatest(deadline_at, now()) + make_interval(secs => seconds), updated_at = now()
  where id = 1 and deadline_at is not null;
end $$;

create function server_now() returns timestamptz language sql stable as $$ select now() $$;

create function in_phase(p text) returns boolean language sql stable as $$
  select exists (select 1 from game where phase = p) $$;

-- A vote is open while its item is up, plus 3 seconds of grace for slow phones.
create function vote_open(r smallint, i int) returns boolean language sql stable as $$
  select exists (select 1 from game where phase = 'r' || r || '_vote' and step = i
    and now() < deadline_at + interval '3 seconds') $$;

-- Shades. No foreign key to auth.users, so the remote can seed test shades for a rehearsal.
create table shades (
  id uuid primary key default auth.uid(),
  name text not null check (char_length(name) between 1 and 40),
  guise text check (char_length(guise) <= 60),
  portrait_path text check (char_length(portrait_path) <= 200),
  hidden boolean not null default false,
  realm text check (realm in ('elysium', 'asphodel', 'tartarus')),
  late boolean not null default false,
  test boolean not null default false,
  created_at timestamptz not null default now());

-- Guests cannot change host-owned columns. A shade created after the lobby is late.
create function guard_shade() returns trigger language plpgsql as $$
begin
  if not is_host() then
    new.hidden := coalesce(old.hidden, false);
    new.realm := old.realm;
    new.test := coalesce(old.test, false);
    new.late := coalesce(old.late, not in_phase('lobby'));
  end if;
  return new;
end $$;
create trigger guard_shade before insert or update on shades for each row execute function guard_shade();

create table confessions (
  shade_id uuid primary key default auth.uid() references shades on delete cascade,
  sin text check (char_length(sin) <= 140),
  talent text check (char_length(talent) <= 140),
  bargain text check (char_length(bargain) <= 140));

-- Moderation. ref is '<shade id>:sin|talent|bargain' or '<matchup>:<writer id>'.
create table hidden_items (kind text not null check (kind in ('confession', 'answer')), ref text not null,
  primary key (kind, ref));

-- Round 1: the public item, and its author kept private until the reveal.
create table r1_items (idx int primary key, text text not null, author_id uuid references shades on delete cascade,
  correct int, guessers int);
create table r1_authors (idx int primary key references r1_items on delete cascade,
  author_id uuid not null references shades on delete cascade);

-- Round 2
create table r2_assignments (matchup int, slot char(1) check (slot in ('a', 'b')),
  writer_id uuid not null references shades on delete cascade, primary key (matchup, slot));
create table r2_answers (matchup int, writer_id uuid default auth.uid() references shades on delete cascade,
  text text not null check (char_length(text) between 1 and 80), primary key (matchup, writer_id));
create table r2_matchups (idx int primary key, prompt text not null, note text, subject_id uuid references shades on delete set null,
  opened boolean not null default false, answer_a text, answer_b text,
  writer_a uuid, writer_b uuid, votes_a int, votes_b int);

-- Round 3. The bargain is copied in from the private confession when that shade's judgment opens.
create table r3_items (idx int primary key, shade_id uuid not null references shades on delete cascade,
  opened boolean not null default false, bargain text);

-- Votes: one per voter per item. No foreign key, so the remote can vote for test shades.
create table votes (voter_id uuid default auth.uid(), round smallint check (round in (1, 2, 3)), item int,
  choice text not null check (char_length(choice) <= 40), created_at timestamptz not null default now(),
  primary key (voter_id, round, item));

-- Points ledger. The unique key makes a repeated reveal harmless.
create table obols (id bigserial primary key, shade_id uuid not null references shades on delete cascade,
  amount int not null, round smallint not null, item int not null, reason text not null,
  unique (shade_id, round, item, reason));

-- Counters for the TV: how many, never who.
create function vote_count(r smallint, i int) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from votes where round = r and item = i $$;

create function answer_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from r2_answers $$;

-- Writes all three rounds in one transaction. Two remotes can build at once: the lock on the game row
-- makes the second wait, then find the rounds built and do nothing.
create function build_rounds(r1 jsonb, r2 jsonb, r2_writers jsonb, r3 jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_host() then raise exception 'not host'; end if;
  perform 1 from game where id = 1 for update;
  if exists (select 1 from r3_items) then return; end if;
  insert into r1_items (idx, text) select x.idx, x.text from jsonb_to_recordset(r1) as x(idx int, text text);
  insert into r1_authors (idx, author_id) select x.idx, x.author_id from jsonb_to_recordset(r1) as x(idx int, author_id uuid);
  insert into r2_matchups (idx, prompt, note, subject_id)
    select x.idx, x.prompt, x.note, x.subject_id from jsonb_to_recordset(r2) as x(idx int, prompt text, note text, subject_id uuid);
  insert into r2_assignments (matchup, slot, writer_id)
    select x.matchup, x.slot, x.writer_id from jsonb_to_recordset(r2_writers) as x(matchup int, slot char(1), writer_id uuid);
  insert into r3_items (idx, shade_id) select x.idx, x.shade_id from jsonb_to_recordset(r3) as x(idx int, shade_id uuid);
end $$;

-- Reset game on the remote: clears every game table, keeps hosts and the setup checklist.
create function reset_game() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_host() then raise exception 'not host'; end if;
  truncate votes, obols, r3_items, r2_matchups, r2_answers, r2_assignments, r1_authors, r1_items,
    hidden_items, confessions, shades;
  update game set phase = 'lobby', step = 0, deadline_at = null, updated_at = now() where id = 1;
end $$;

-- RLS
alter table game enable row level security;
alter table shades enable row level security;
alter table confessions enable row level security;
alter table hidden_items enable row level security;
alter table r1_items enable row level security;
alter table r1_authors enable row level security;
alter table r2_assignments enable row level security;
alter table r2_answers enable row level security;
alter table r2_matchups enable row level security;
alter table r3_items enable row level security;
alter table votes enable row level security;
alter table obols enable row level security;

create policy read_all on game for select to authenticated using (true);

create policy read_all on shades for select to authenticated using (true);
create policy own_insert on shades for insert to authenticated with check (
  id = auth.uid() and not in_phase('finale') and not in_phase('after'));
create policy own_update on shades for update to authenticated using (
  id = auth.uid() and (in_phase('lobby') or (late and not in_phase('finale') and not in_phase('after'))));
create policy host_all on shades for all to authenticated using (is_host()) with check (is_host());

create policy own_read on confessions for select to authenticated using (shade_id = auth.uid());
create policy own_insert on confessions for insert to authenticated with check (shade_id = auth.uid() and in_phase('lobby'));
create policy own_update on confessions for update to authenticated using (shade_id = auth.uid() and in_phase('lobby'));
create policy host_all on confessions for all to authenticated using (is_host()) with check (is_host());

create policy host_all on hidden_items for all to authenticated using (is_host()) with check (is_host());

create policy read_all on r1_items for select to authenticated using (true);
create policy read_all on r2_matchups for select to authenticated using (true);
create policy read_all on r3_items for select to authenticated using (true);
create policy read_all on obols for select to authenticated using (true);
create policy host_all on r1_items for all to authenticated using (is_host()) with check (is_host());
create policy host_all on r1_authors for all to authenticated using (is_host()) with check (is_host());
create policy host_all on r2_matchups for all to authenticated using (is_host()) with check (is_host());
create policy host_all on r3_items for all to authenticated using (is_host()) with check (is_host());
create policy host_all on obols for all to authenticated using (is_host()) with check (is_host());

create policy own_read on r2_assignments for select to authenticated using (writer_id = auth.uid());
create policy host_all on r2_assignments for all to authenticated using (is_host()) with check (is_host());

create policy own_read on r2_answers for select to authenticated using (writer_id = auth.uid());
create policy own_insert on r2_answers for insert to authenticated with check (
  writer_id = auth.uid() and in_phase('r2_write')
  and exists (select 1 from r2_assignments a where a.matchup = r2_answers.matchup and a.writer_id = auth.uid()));
create policy own_update on r2_answers for update to authenticated using (writer_id = auth.uid() and in_phase('r2_write'));
create policy host_all on r2_answers for all to authenticated using (is_host()) with check (is_host());

create policy own_read on votes for select to authenticated using (voter_id = auth.uid());
create policy own_insert on votes for insert to authenticated with check (voter_id = auth.uid() and vote_open(round, item));
create policy own_update on votes for update to authenticated using (voter_id = auth.uid() and vote_open(round, item));
create policy host_all on votes for all to authenticated using (is_host()) with check (is_host());

-- Realtime (postgres_changes respects RLS). Votes and answers are counted by polling instead.
alter publication supabase_realtime add table game, shades, r1_items, r2_matchups, r3_items, obols;

-- Portraits: a public bucket, one file per shade at '<user id>.jpg'. Retakes overwrite, which needs select too.
insert into storage.buckets (id, name, public) values ('portraits', 'portraits', true) on conflict do nothing;
create policy own_portrait_select on storage.objects for select to authenticated
  using (bucket_id = 'portraits' and name = auth.uid()::text || '.jpg');
create policy own_portrait_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'portraits' and name = auth.uid()::text || '.jpg');
create policy own_portrait_update on storage.objects for update to authenticated
  using (bucket_id = 'portraits' and name = auth.uid()::text || '.jpg');
create policy host_portrait_delete on storage.objects for delete to authenticated
  using (bucket_id = 'portraits' and is_host());
