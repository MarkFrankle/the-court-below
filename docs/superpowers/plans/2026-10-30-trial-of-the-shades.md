**Status: Implemented** — merged PR #3

# Trial of the Shades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The arrival form, the Hall of Shades on the TV, the host remote and the three-round Trial, live for Saturday 31 October at 23:00.

**Architecture:** Supabase holds the game state behind RLS, and every screen renders from one `game` row plus a few public tables, refetched in full on any Realtime change.
The host remote is the game engine: each Next changes the phase, then does that phase's entry work (build rounds, copy answers, tally, write obols), all idempotent so a reload just repeats it.
The TV is a read-only display signed in anonymously; all round building and scoring is in pure, unit-tested functions in `src/lib/`.

**Tech Stack:** Vite 7, React 19, TypeScript, `@supabase/supabase-js` 2, Vitest 3, `@electric-sql/pglite` (dev only, for RLS tests), `qrcode`.

**Specs:** `docs/game-plan.md` (every on-screen line) and `docs/tech-spec.md` (architecture, schema, phases, scoring).
Where this plan differs from the spec, this plan wins, and Task 12 brings the docs in line. The differences are listed under [Changes from the spec](#changes-from-the-spec).

## Global Constraints

- Stay on Vite 7. No router library: `src/main.tsx` routes by `location.pathname`.
- Never create `supabase/migrations/`. SQL lives in `supabase/*.sql` and is pasted into the SQL editor by hand. Game order: `hosts.sql` (already run), then `schema.sql`.
- Never use the secret or service_role key.
- RLS is the security boundary. Confessions, Round 2 answers, votes and Round 1 authors are readable only by the writer and the hosts.
- On-screen copy comes from `docs/game-plan.md`, verbatim. Nothing invented reaches a guest's screen without Sarah or Mark approving it.
- Do not touch `src/setup/` or the setup SQL. Sarah is using `/setup` live.
- Mobile-first for `/` and `/host`. `/tv` is a 16:9 TV at a distance: large type, nothing smaller than about 28 px.
- Dark theme tokens from `src/styles/theme.css` (ink, plum, gold); Cormorant Garamond display, Inter body.
- Times are Europe/Amsterdam, UTC+01:00. The Trial opens at `2026-10-31T23:00:00+01:00`.
- Code comments and Markdown break at sentences. No em-dashes in prose.
- Work on branch `game`. Open a draft PR early so Netlify builds a deploy preview for phone testing; merge to `main` only with `npm test` and `npm run build` green.
- Commits: `git commit -m "type: message" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.

## Changes from the spec

1. **The engine moves from `/tv` to `/host`.** The remote does each phase's entry work right after `set_phase`. The TV needs no host sign-in and can't stall the game by being closed.
2. **The TV signs in anonymously.** Vote and answer counters come from two `security definer` functions, `vote_count()` and `answer_count()`, polled every 2 seconds during timed phases. `votes` and `r2_answers` leave the Realtime publication.
3. **New private table `r1_authors`** (host only) holds Round 1 authors until the reveal. Without it the engine would have to match confession text back to a shade.
4. **`shades` and `votes` lose their foreign keys to `auth.users`**, and `shades` gains a host-only `test` column, so the remote can seed test shades and auto-vote for them.
5. **New phases** `r1_intro`, `r2_intro`, `r3_intro` for the round intro lines, and steps on `intro` (opening lines, obols, bound shades) and `finale` (leaderboard, then Favored of Hades). `phase` is free text, so this needs no schema change.
6. **Round 3 ties go to Asphodel** (as do shades with no votes), replacing the tie-break screen. Persephone can still overrule out loud.
7. **Late shades** use the arrival form with the confessions hidden, and vote as soon as they join.
8. **`reset_game()` lives in `schema.sql`**, not a separate `reset.sql`. One file to paste.
9. **`r2_matchups` gains `note`** (the lore line) **and `opened`** (answers copied). **`r1_items` gains `guessers`.**
10. **Cut:** the portrait zip export, the printable QR card view, and the separate late-arrival form.

## Review Focus

- **Phone locked mid-vote:** on unlock the phone catches up without a reload, and shows its own vote read back from the database. Owned by Task 5.
- **A vote sent after Next:** rejected by RLS, and the phone shows "The Court has heard enough" rather than an error. Owned by Tasks 1 and 8.
- **Remote reloads mid-reveal:** the remote reruns the current phase's entry work on load; nothing is double-counted (obols are upserted on a unique key). Owned by Task 7.
- **No early leaks:** Round 1 authors stay in `r1_authors` until the reveal; Round 2 answers are copied into the public matchup only when that matchup's vote opens; Round 3 realms are written per reveal step. Owned by Tasks 1, 8, 9, 10.
- **Duplicate shade from a second browser:** the host hides it; hidden shades are not players and their votes don't count. Owned by Tasks 2, 3, 7.
- **Fewer than 3 players:** Round 2 is skipped automatically. Test `skips round 2 when it has no matchups` in Task 2.

---

### Task 0: Access and environment (Mark, by hand)

Nothing in this task is code. Do it before Task 1's hand-over step.

- [ ] Sarah invites `mark@frankle.fyi` to the Supabase org "Frankle" and to the Netlify site `thecourtbelow`.
- [ ] Check GitHub push access: `gh repo view --json viewerPermission` reports `WRITE` or `ADMIN`.
- [ ] Copy `.env.example` to `.env.local` with the project URL `https://jtkxpxbrdusbylbhtprl.supabase.co` and the `sb_publishable_...` key (Supabase → Project Settings → API keys).
- [ ] Restart Claude Code, approve the `supabase` MCP server, and sign in through `/mcp`.
- [ ] Confirm `mark@frankle.fyi` exists in Authentication → Users and is in `hosts` (`select * from hosts` via the MCP returns two rows).

---

### Task 1: Game schema and RLS tests

**Files:**
- Create: `supabase/schema.sql`, `tests/db/harness.ts`, `tests/db/rls.test.ts`, `supabase/game_rls_checks.md`
- Modify: `package.json` (dev dependency `@electric-sql/pglite`)

**Interfaces:**
- Produces (SQL, called from the client):
  - `set_phase(p text, s int, seconds int default 0)`, `add_time(seconds int)`, `server_now()`, `reset_game()`
  - `vote_count(r smallint, i int) returns int`, `answer_count() returns int`
  - Tables as in the schema below.

- [ ] **Step 1: Install PGlite**

Run: `npm install -D @electric-sql/pglite@^0.5`
Expected: added to `devDependencies`, lockfile updated.

- [ ] **Step 2: Write the test harness**

`tests/db/harness.ts` stubs the parts of Supabase the schema relies on (`auth.uid()` from a session setting, `auth.users`, the `authenticated` role, `storage.objects`, the Realtime publication), then loads the real SQL files.

```ts
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

export const HOST = '11111111-1111-1111-1111-111111111111'
export const ANA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
export const BEN = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
export const CAL = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

// The bits of Supabase the schema relies on. auth.uid() reads the same setting Supabase's does.
const stubs = `
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage to authenticated;
  grant all on all tables in schema storage to authenticated;
  alter default privileges in schema public grant all on tables to authenticated;
  alter default privileges in schema public grant all on sequences to authenticated;
`

export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create()
  await db.exec(stubs)
  await db.exec(readFileSync('supabase/hosts.sql', 'utf8'))
  await db.exec(readFileSync('supabase/schema.sql', 'utf8'))
  await db.exec(`insert into auth.users values ('${HOST}', 'mark@frankle.fyi'); insert into hosts values ('${HOST}');`)
  return db
}

// Runs one statement as a signed-in user, with RLS applied.
export async function as<T = Record<string, unknown>>(db: PGlite, uid: string, sql: string): Promise<T[]> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return (await db.query<T>(sql)).rows
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

// Moves the game directly, as the SQL editor would. Negative seconds put the deadline in the past.
export async function setPhase(db: PGlite, phase: string, step = 0, seconds?: number): Promise<void> {
  await db.query(
    `update game set phase = $1, step = $2,
       deadline_at = case when $3::int is null then null else now() + make_interval(secs => $3::int) end`,
    [phase, step, seconds ?? null],
  )
}
```

- [ ] **Step 3: Write the failing RLS tests**

`tests/db/rls.test.ts`:

```ts
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, expect, test } from 'vitest'
import { ANA, BEN, CAL, HOST, as, freshDb, setPhase } from './harness'

let db: PGlite

beforeEach(async () => {
  db = await freshDb()
  await as(db, ANA, `insert into shades (name) values ('Ana')`)
  await as(db, ANA, `insert into confessions (sin, talent, bargain) values ('sin', 'talent', 'bargain')`)
  await as(db, BEN, `insert into shades (name) values ('Ben')`)
}, 30_000)

const one = async (sql: string) => (await db.query(sql)).rows[0] as Record<string, unknown>

test('a guest cannot create a shade for someone else', async () => {
  await expect(as(db, ANA, `insert into shades (id, name) values ('${CAL}', 'Cal')`)).rejects.toThrow(/row-level security/)
})

test('a guest cannot set hidden, realm or test on their own shade', async () => {
  await as(db, ANA, `update shades set hidden = true, realm = 'elysium', test = true where id = '${ANA}'`)
  expect(await one(`select hidden, realm, test from shades where id = '${ANA}'`)).toEqual({ hidden: false, realm: null, test: false })
})

test('a shade created after the lobby is late', async () => {
  await setPhase(db, 'intro')
  await as(db, CAL, `insert into shades (name) values ('Cal')`)
  expect(await one(`select late from shades where id = '${CAL}'`)).toEqual({ late: true })
})

test('guests read only their own confessions', async () => {
  expect(await as(db, BEN, `select * from confessions`)).toEqual([])
  expect(await as(db, ANA, `select sin from confessions`)).toEqual([{ sin: 'sin' }])
  expect(await as(db, HOST, `select sin from confessions`)).toEqual([{ sin: 'sin' }])
})

test('confessions are locked after the lobby', async () => {
  await setPhase(db, 'intro')
  expect(await as(db, ANA, `update confessions set sin = 'changed' returning sin`)).toEqual([])
  await expect(as(db, BEN, `insert into confessions (sin) values ('late')`)).rejects.toThrow(/row-level security/)
})

test('only hosts change the phase', async () => {
  await expect(as(db, ANA, `select set_phase('intro', 0)`)).rejects.toThrow(/not host/)
  expect(await as(db, ANA, `update game set phase = 'intro' returning phase`)).toEqual([])
  await as(db, HOST, `select set_phase('intro', 0)`)
  expect(await one(`select phase from game`)).toEqual({ phase: 'intro' })
})

test('votes are accepted only for the open item', async () => {
  await expect(as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)).rejects.toThrow(/row-level security/)
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  await expect(as(db, ANA, `insert into votes (round, item, choice) values (1, 1, '${BEN}')`)).rejects.toThrow(/row-level security/)
})

test('votes close three seconds after the deadline', async () => {
  await setPhase(db, 'r1_vote', 0, -5)
  await expect(as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)).rejects.toThrow(/row-level security/)
})

test('a guest can change their vote while it is open', async () => {
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${CAL}')
    on conflict (voter_id, round, item) do update set choice = excluded.choice`)
  expect(await as(db, ANA, `select choice from votes`)).toEqual([{ choice: CAL }])
})

test('guests cannot read or forge each other’s votes', async () => {
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  expect(await as(db, BEN, `select * from votes`)).toEqual([])
  await expect(as(db, BEN, `insert into votes (voter_id, round, item, choice) values ('${CAL}', 1, 0, '${ANA}')`)).rejects.toThrow(/row-level security/)
})

test('vote_count tells anyone how many have voted, not who', async () => {
  await setPhase(db, 'r1_vote', 0, 20)
  await as(db, ANA, `insert into votes (round, item, choice) values (1, 0, '${BEN}')`)
  expect(await as(db, CAL, `select vote_count(1::smallint, 0) as n`)).toEqual([{ n: 1 }])
})

test('only assigned writers answer, and only during r2_write', async () => {
  await db.exec(`insert into r2_assignments values (0, 'a', '${ANA}')`)
  await expect(as(db, ANA, `insert into r2_answers (matchup, text) values (0, 'too early')`)).rejects.toThrow(/row-level security/)
  await setPhase(db, 'r2_write', 0, 90)
  await expect(as(db, BEN, `insert into r2_answers (matchup, text) values (0, 'not mine')`)).rejects.toThrow(/row-level security/)
  await as(db, ANA, `insert into r2_answers (matchup, text) values (0, 'mine')`)
  expect(await as(db, BEN, `select * from r2_answers`)).toEqual([])
  expect(await as(db, BEN, `select answer_count() as n`)).toEqual([{ n: 1 }])
})

test('round 1 authors stay hidden from guests', async () => {
  await db.exec(`insert into r1_items (idx, text) values (0, 'sin'); insert into r1_authors values (0, '${ANA}')`)
  expect(await as(db, BEN, `select * from r1_authors`)).toEqual([])
  expect(await as(db, HOST, `select author_id from r1_authors`)).toEqual([{ author_id: ANA }])
})

test('only hosts reset the game', async () => {
  await setPhase(db, 'r2_write')
  await expect(as(db, ANA, `select reset_game()`)).rejects.toThrow(/not host/)
  await as(db, HOST, `select reset_game()`)
  expect(await one(`select count(*)::int as n from shades`)).toEqual({ n: 0 })
  expect(await one(`select phase from game`)).toEqual({ phase: 'lobby' })
})

test('guests upload only their own portrait', async () => {
  await as(db, ANA, `insert into storage.objects (bucket_id, name) values ('portraits', '${ANA}.jpg')`)
  await expect(as(db, ANA, `insert into storage.objects (bucket_id, name) values ('portraits', '${BEN}.jpg')`)).rejects.toThrow(/row-level security/)
})
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run tests/db`
Expected: FAIL, `supabase/schema.sql` does not exist.

- [ ] **Step 5: Write `supabase/schema.sql`**

```sql
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

create function set_phase(p text, s int, seconds int default 0) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_host() then raise exception 'not host'; end if;
  update game set phase = p, step = s, updated_at = now(),
    deadline_at = case when seconds > 0 then now() + make_interval(secs => seconds) end
  where id = 1;
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

-- Round 3
create table r3_items (idx int primary key, shade_id uuid not null references shades on delete cascade);

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
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run tests/db`
Expected: 15 passed. If PGlite can't switch roles, run the same files against `docker run --rm -d -e POSTGRES_PASSWORD=x -p 54329:5432 postgres:16` and note it in the commit message.

- [ ] **Step 7: Write `supabase/game_rls_checks.md`**

The same checks as the tests, as browser-console one-liners against the live project, in the style of `supabase/setup_rls_checks.md` (dev builds expose `window.__game = { supabase }`, added in Task 5).

- [ ] **Step 8: Hand over and verify**

Mark (or Sarah) pastes `supabase/schema.sql` into the SQL editor.
Verify with the read-only MCP: `list_tables` shows the 12 game tables, `select phase from game` returns `lobby`, `select id, public from storage.buckets` includes `portraits` with `public = true`.

- [ ] **Step 9: Commit**

```bash
git add supabase/schema.sql supabase/game_rls_checks.md tests/db package.json package-lock.json
git commit -m "feat: add game schema with RLS tests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Game types, phases and round builders (pure)

**Files:**
- Create: `src/lib/game.ts`, `src/lib/random.ts`, `src/lib/phases.ts`, `src/lib/rounds.ts`, `tests/game/phases.test.ts`, `tests/game/rounds.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/game.ts
  export type Phase = 'lobby' | 'intro' | 'r1_intro' | 'r1_vote' | 'r1_reveal' | 'r2_intro' | 'r2_write' | 'r2_vote'
    | 'r2_reveal' | 'r3_intro' | 'r3_vote' | 'r3_reveal' | 'finale' | 'after'
  export type Realm = 'elysium' | 'asphodel' | 'tartarus'
  export const REALMS: Realm[]                       // reveal order: ['tartarus', 'asphodel', 'elysium']
  export interface GameState { phase: Phase; step: number; deadlineAt: string | null }
  export interface Shade { id: string; name: string; guise: string | null; portraitPath: string | null
    hidden: boolean; realm: Realm | null; late: boolean; test: boolean; createdAt: string }
  export interface Confession { shadeId: string; sin: string | null; talent: string | null; bargain: string | null }
  export interface Vote { voterId: string; round: 1 | 2 | 3; item: number; choice: string }
  export type Reason = 'guess' | 'fooled' | 'framed' | 'votes' | 'sweep' | 'bet'
  export interface Award { shadeId: string; amount: number; round: 1 | 2 | 3; item: number; reason: Reason }
  export interface Prompt { text: string; note?: string }    // text may contain '[Name]'
  export const confessionRef: (shadeId: string, field: 'sin' | 'talent' | 'bargain') => string   // '<id>:<field>'
  export const answerRef: (matchup: number, writerId: string) => string                          // '<matchup>:<id>'
  // src/lib/random.ts
  export type Rand = () => number                    // [0, 1)
  export function seeded(seed: number): Rand         // mulberry32, for tests and test shades
  export function shuffle<T>(items: T[], rand: Rand): T[]   // returns a new array
  // src/lib/phases.ts
  export const TIMERS = { r1_vote: 20, r2_write: 90, r2_vote: 20, r3_vote: 12 }
  export const STEPS = { intro: 3, r3_intro: 2, r3_reveal: 3, finale: 2 }   // screens per phase; others have 1 or one per item
  export interface Counts { r1: number; r2: number; r3: number }
  export function nextStep(g: { phase: Phase; step: number }, c: Counts): { phase: Phase; step: number; seconds: number } | null
  // src/lib/rounds.ts
  export function players(shades: Shade[]): Shade[]  // not hidden, not late
  export function voters(shades: Shade[]): Set<string>   // ids of every shade that isn't hidden (late ones vote)
  export function buildRound1(players: Shade[], confessions: Confession[], hidden: Set<string>, rand: Rand): { idx: number; text: string; authorId: string }[]
  export function buildRound2(players: Shade[], prompts: Prompt[], rand: Rand): {
    matchups: { idx: number; prompt: string; note: string | null; subjectId: string | null }[]
    assignments: { matchup: number; slot: 'a' | 'b'; writerId: string }[] }
  export function buildRound3(players: Shade[], rand: Rand): string[]   // shade ids, judgment order
  ```

**Phase order** (`nextStep`): `lobby → intro 0..2 → r1_intro → r1_vote i → r1_reveal i → … → r2_intro → r2_write → r2_vote i → r2_reveal i → … → r3_intro 0..1 → r3_vote 0..n-1 → r3_reveal 0..2 → finale 0..1 → after`, then `null`.
A round with a count of 0 is skipped along with its intro. Timed phases get their seconds from `TIMERS`; every other step gets 0.

**Round building rules** (from the spec's Game logic, with the changes above):

- Round 1: at most 8 items, at most one per shade, each a sin or a talent picked at random. Skip empty and hidden ones. Shades with a portrait come first, then shuffle within each group. `text` is the bare confession; the TV adds *This shade confesses*.
- Round 2: needs 3 or more players. Shuffle the players; matchup `i` goes to players `i` (slot `a`) and `(i + 1) mod n` (slot `b`), so everyone writes exactly two. Shuffle the prompts and use `prompts[i % prompts.length]`. For a `[Name]` prompt, pick a subject who isn't one of its two writers, preferring shades not yet used as a subject, and replace `[Name]` with their name.
- Round 3: every player, shuffled.

- [ ] **Step 1: Write the failing phase tests**

`tests/game/phases.test.ts`:

```ts
import { expect, test } from 'vitest'
import { nextStep } from '../../src/lib/phases'

const c = { r1: 8, r2: 15, r3: 15 }
const at = (phase: string, step = 0, counts = c) => nextStep({ phase: phase as never, step }, counts)

test('the lobby opens the court', () => {
  expect(at('lobby')).toEqual({ phase: 'intro', step: 0, seconds: 0 })
})

test('the opening has three screens, then round 1', () => {
  expect(at('intro', 0)).toEqual({ phase: 'intro', step: 1, seconds: 0 })
  expect(at('intro', 2)).toEqual({ phase: 'r1_intro', step: 0, seconds: 0 })
})

test('round 1 alternates vote and reveal', () => {
  expect(at('r1_intro')).toEqual({ phase: 'r1_vote', step: 0, seconds: 20 })
  expect(at('r1_vote', 3)).toEqual({ phase: 'r1_reveal', step: 3, seconds: 0 })
  expect(at('r1_reveal', 3)).toEqual({ phase: 'r1_vote', step: 4, seconds: 20 })
  expect(at('r1_reveal', 7)).toEqual({ phase: 'r2_intro', step: 0, seconds: 0 })
})

test('round 2 writes, then alternates vote and reveal', () => {
  expect(at('r2_intro')).toEqual({ phase: 'r2_write', step: 0, seconds: 90 })
  expect(at('r2_write')).toEqual({ phase: 'r2_vote', step: 0, seconds: 20 })
  expect(at('r2_vote', 2)).toEqual({ phase: 'r2_reveal', step: 2, seconds: 0 })
  expect(at('r2_reveal', 14)).toEqual({ phase: 'r3_intro', step: 0, seconds: 0 })
})

test('round 3 votes on every shade, then reveals realm by realm', () => {
  expect(at('r3_intro', 1)).toEqual({ phase: 'r3_vote', step: 0, seconds: 12 })
  expect(at('r3_vote', 5)).toEqual({ phase: 'r3_vote', step: 6, seconds: 12 })
  expect(at('r3_vote', 14)).toEqual({ phase: 'r3_reveal', step: 0, seconds: 0 })
  expect(at('r3_reveal', 2)).toEqual({ phase: 'finale', step: 0, seconds: 0 })
})

test('the finale ends in the after-party, then stops', () => {
  expect(at('finale', 1)).toEqual({ phase: 'after', step: 0, seconds: 0 })
  expect(at('after')).toBeNull()
})

test('skips round 2 when it has no matchups', () => {
  expect(at('r1_reveal', 7, { ...c, r2: 0 })).toEqual({ phase: 'r3_intro', step: 0, seconds: 0 })
})

test('skips round 1 when it has no items', () => {
  expect(at('intro', 2, { ...c, r1: 0 })).toEqual({ phase: 'r2_intro', step: 0, seconds: 0 })
})
```

- [ ] **Step 2: Write the failing round tests**

`tests/game/rounds.test.ts`:

```ts
import { expect, test } from 'vitest'
import type { Confession, Shade } from '../../src/lib/game'
import { seeded } from '../../src/lib/random'
import { buildRound1, buildRound2, buildRound3, players, voters } from '../../src/lib/rounds'

const shade = (id: string, extra: Partial<Shade> = {}): Shade => ({
  id, name: id.toUpperCase(), guise: null, portraitPath: `${id}.jpg`, hidden: false, realm: null,
  late: false, test: false, createdAt: '2026-10-31T20:00:00+01:00', ...extra,
})
const many = (n: number) => Array.from({ length: n }, (_, i) => shade(`s${i}`))
const confess = (shadeId: string, extra: Partial<Confession> = {}): Confession => ({
  shadeId, sin: `${shadeId} sin`, talent: `${shadeId} talent`, bargain: `${shadeId} bargain`, ...extra,
})
const prompts = [
  { text: 'Why should Hades release [Name] back to the living?' },
  { text: 'The River Styx’s one-star review.' },
  { text: 'What Cerberus’s third head is thinking.', note: 'Cerberus is Hades’ three-headed guard dog.' },
]

test('players leaves out hidden and late shades; voters leaves out only hidden ones', () => {
  const all = [shade('a'), shade('b', { hidden: true }), shade('c', { late: true })]
  expect(players(all).map((s) => s.id)).toEqual(['a'])
  expect(voters(all)).toEqual(new Set(['a', 'c']))
})

test('round 1 picks at most 8 confessions, one per shade', () => {
  const ps = many(15)
  const items = buildRound1(ps, ps.map((s) => confess(s.id)), new Set(), seeded(1))
  expect(items).toHaveLength(8)
  expect(new Set(items.map((i) => i.authorId)).size).toBe(8)
  expect(items.map((i) => i.idx)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  for (const i of items) expect([`${i.authorId} sin`, `${i.authorId} talent`]).toContain(i.text)
})

test('round 1 skips empty and hidden confessions', () => {
  const ps = many(3)
  const cs = [confess('s0', { sin: '', talent: null }), confess('s1', { talent: '  ' }), confess('s2')]
  const items = buildRound1(ps, cs, new Set(['s1:sin']), seeded(2))
  expect(items.map((i) => i.authorId).sort()).toEqual(['s2'])
})

test('round 1 prefers shades with portraits', () => {
  const ps = [...many(8), shade('x', { portraitPath: null }), shade('y', { portraitPath: null })]
  const items = buildRound1(ps, ps.map((s) => confess(s.id)), new Set(), seeded(3))
  expect(items.map((i) => i.authorId)).not.toContain('x')
  expect(items.map((i) => i.authorId)).not.toContain('y')
})

test.each([3, 8, 15, 20])('round 2 with %i players: everyone writes exactly two, never against themselves', (n) => {
  const { matchups, assignments } = buildRound2(many(n), prompts, seeded(n))
  expect(matchups).toHaveLength(n)
  const counts = new Map<string, number>()
  for (const a of assignments) counts.set(a.writerId, (counts.get(a.writerId) ?? 0) + 1)
  expect([...counts.values()].every((v) => v === 2)).toBe(true)
  expect(counts.size).toBe(n)
  for (const m of matchups) {
    const [a, b] = assignments.filter((x) => x.matchup === m.idx)
    expect(a.writerId).not.toBe(b.writerId)
  }
})

test('round 2 fills in a subject who is not one of the writers', () => {
  const ps = many(8)
  const { matchups, assignments } = buildRound2(ps, prompts, seeded(4))
  const named = matchups.filter((m) => m.subjectId)
  expect(named.length).toBeGreaterThan(0)
  for (const m of named) {
    const writers = assignments.filter((a) => a.matchup === m.idx).map((a) => a.writerId)
    expect(writers).not.toContain(m.subjectId)
    expect(m.prompt).toContain(ps.find((s) => s.id === m.subjectId)!.name)
    expect(m.prompt).not.toContain('[Name]')
  }
  for (const m of matchups.filter((x) => !x.subjectId)) expect(m.prompt).not.toContain('[Name]')
})

test('round 2 keeps the lore note', () => {
  const { matchups } = buildRound2(many(6), prompts, seeded(5))
  expect(matchups.find((m) => m.prompt.startsWith('What Cerberus'))?.note).toBe('Cerberus is Hades’ three-headed guard dog.')
})

test('round 2 needs at least 3 players', () => {
  expect(buildRound2(many(2), prompts, seeded(6))).toEqual({ matchups: [], assignments: [] })
})

test('round 3 judges every player once', () => {
  const ps = many(15)
  expect(buildRound3(ps, seeded(7)).sort()).toEqual(ps.map((s) => s.id).sort())
})

test('builders are deterministic for a seed', () => {
  const ps = many(10)
  expect(buildRound3(ps, seeded(8))).toEqual(buildRound3(ps, seeded(8)))
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/game`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `game.ts`, `random.ts`, `phases.ts`, `rounds.ts`** to the interfaces and rules above.

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run tests/game`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/game.ts src/lib/random.ts src/lib/phases.ts src/lib/rounds.ts tests/game
git commit -m "feat: add game phases and round builders" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scoring (pure)

**Files:**
- Create: `src/lib/scoring.ts`, `tests/game/scoring.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
  ```ts
  export function scoreRound1(p: { item: number; authorId: string; votes: Vote[]; playerIds: Set<string>; voterIds: Set<string> }):
    { correct: number; guessers: number; awards: Award[] }
  export function revealTone(correct: number, guessers: number): 'most' | 'half' | 'none'
  export function scoreRound2(p: { item: number; writerA: string; writerB: string; hasA: boolean; hasB: boolean; votes: Vote[]; voterIds: Set<string> }):
    { votesA: number; votesB: number; winner: 'a' | 'b' | null; awards: Award[] }
  export function judge(p: { item: number; votes: Vote[]; voterIds: Set<string> }): Realm
  export function realmsRevealed(step: number): Realm[]     // 0: tartarus; 1: + asphodel; 2: all three
  export function totals(obols: { shadeId: string; amount: number }[]): Map<string, number>
  export function favored(totals: Map<string, number>, candidates: string[]): string[]   // highest total; [] if nobody scored
  ```

**Rules** (from the spec's Scoring table):

- A vote counts only if it's for this round and item, from a shade in `voterIds`, with a valid choice: a player id other than the voter's own (Round 1), `a` or `b` for an answer that exists (Round 2), or a realm (Round 3).
- Round 1: the author's vote is their frame. Each guesser who names the author gets `guess` +1. The author gets `fooled` +1 per guesser who didn't name them, and `framed` +1 per guesser who picked the framed shade. Awards are one row per shade and reason, with the amount summed; zero-amount awards are left out.
- Round 2: the writers' votes are bets. Each writer gets `votes` +1 per vote. A writer with every vote, at least 3 votes cast and both answers present, gets `sweep` +2. If exactly one answer is missing, the other wins by default. Writers who bet on the winner get `bet` +1; a tie has no winner.
- Round 3: the realm with the most votes; a tie or no votes is Asphodel.

- [ ] **Step 1: Write the failing tests**

`tests/game/scoring.test.ts`:

```ts
import { expect, test } from 'vitest'
import type { Vote } from '../../src/lib/game'
import { favored, judge, realmsRevealed, revealTone, scoreRound1, scoreRound2, totals } from '../../src/lib/scoring'

const v = (voterId: string, round: 1 | 2 | 3, item: number, choice: string): Vote => ({ voterId, round, item, choice })
const ids = (...xs: string[]) => new Set(xs)
const everyone = ids('ana', 'ben', 'cal', 'dev', 'eve', 'fay')

test('round 1: guessers who name the author score, the author scores for the rest and for the frame', () => {
  const votes = [v('ana', 1, 0, 'ben'), v('cal', 1, 0, 'ana'), v('dev', 1, 0, 'ben'), v('eve', 1, 0, 'ben'), v('fay', 1, 0, 'ana')]
  const r = scoreRound1({ item: 0, authorId: 'ana', votes, playerIds: everyone, voterIds: everyone })
  expect(r.correct).toBe(2)
  expect(r.guessers).toBe(4)
  expect(r.awards).toEqual(expect.arrayContaining([
    { shadeId: 'cal', amount: 1, round: 1, item: 0, reason: 'guess' },
    { shadeId: 'fay', amount: 1, round: 1, item: 0, reason: 'guess' },
    { shadeId: 'ana', amount: 2, round: 1, item: 0, reason: 'fooled' },
    { shadeId: 'ana', amount: 2, round: 1, item: 0, reason: 'framed' },
  ]))
  expect(r.awards).toHaveLength(4)
})

test('round 1 ignores other items, hidden voters, self votes and non-players', () => {
  const votes = [v('ben', 1, 1, 'ana'), v('zed', 1, 0, 'ana'), v('cal', 1, 0, 'cal'), v('dev', 1, 0, 'nobody'), v('eve', 2, 0, 'ana')]
  const r = scoreRound1({ item: 0, authorId: 'ana', votes, playerIds: everyone, voterIds: everyone })
  expect(r).toEqual({ correct: 0, guessers: 0, awards: [] })
})

test('round 1: a late shade can guess, though it is not a player', () => {
  const r = scoreRound1({ item: 0, authorId: 'ana', votes: [v('lat', 1, 0, 'ana')], playerIds: everyone, voterIds: ids(...everyone, 'lat') })
  expect(r.awards).toEqual([{ shadeId: 'lat', amount: 1, round: 1, item: 0, reason: 'guess' }])
})

test.each([
  [0, 0, 'none'], [1, 5, 'none'], [1, 4, 'half'], [3, 5, 'half'], [4, 5, 'most'],
] as const)('reveal tone for %i of %i is %s', (correct, guessers, tone) => {
  expect(revealTone(correct, guessers)).toBe(tone)
})

const r2 = (votes: Vote[], hasA = true, hasB = true) =>
  scoreRound2({ item: 0, writerA: 'ana', writerB: 'ben', hasA, hasB, votes, voterIds: everyone })

test('round 2: each writer earns a coin per vote', () => {
  const r = r2([v('cal', 2, 0, 'a'), v('dev', 2, 0, 'a'), v('eve', 2, 0, 'a'), v('fay', 2, 0, 'b')])
  expect([r.votesA, r.votesB, r.winner]).toEqual([3, 1, 'a'])
  expect(r.awards).toEqual(expect.arrayContaining([
    { shadeId: 'ana', amount: 3, round: 2, item: 0, reason: 'votes' },
    { shadeId: 'ben', amount: 1, round: 2, item: 0, reason: 'votes' },
  ]))
  expect(r.awards).toHaveLength(2)
})

test('round 2: a clean sweep of at least three votes earns the bonus', () => {
  expect(r2([v('cal', 2, 0, 'b'), v('dev', 2, 0, 'b'), v('eve', 2, 0, 'b')]).awards)
    .toContainEqual({ shadeId: 'ben', amount: 2, round: 2, item: 0, reason: 'sweep' })
  expect(r2([v('cal', 2, 0, 'b'), v('dev', 2, 0, 'b')]).awards.map((a) => a.reason)).not.toContain('sweep')
})

test('round 2: writers’ votes are bets, paid when they back the winner', () => {
  const r = r2([v('ana', 2, 0, 'b'), v('ben', 2, 0, 'b'), v('cal', 2, 0, 'a'), v('dev', 2, 0, 'b'), v('eve', 2, 0, 'b')])
  expect([r.votesA, r.votesB]).toEqual([1, 2])
  expect(r.awards).toContainEqual({ shadeId: 'ana', amount: 1, round: 2, item: 0, reason: 'bet' })
  expect(r.awards).toContainEqual({ shadeId: 'ben', amount: 1, round: 2, item: 0, reason: 'bet' })
})

test('round 2: a tie pays no bets', () => {
  const r = r2([v('ana', 2, 0, 'a'), v('cal', 2, 0, 'a'), v('dev', 2, 0, 'b')])
  expect(r.winner).toBeNull()
  expect(r.awards.map((a) => a.reason)).not.toContain('bet')
})

test('round 2: a missing answer loses by default, without the bonus for the other', () => {
  const r = r2([v('cal', 2, 0, 'a'), v('dev', 2, 0, 'b'), v('eve', 2, 0, 'b'), v('fay', 2, 0, 'b')], false, true)
  expect([r.votesA, r.votesB, r.winner]).toEqual([0, 3, 'b'])
  expect(r.awards).toEqual([{ shadeId: 'ben', amount: 3, round: 2, item: 0, reason: 'votes' }])
})

test('round 3: the majority realm wins; ties and silence go to Asphodel', () => {
  const j = (choices: string[]) => judge({ item: 0, voterIds: everyone, votes: choices.map((c, i) => v([...everyone][i], 3, 0, c)) })
  expect(j(['tartarus', 'tartarus', 'elysium'])).toBe('tartarus')
  expect(j(['tartarus', 'elysium'])).toBe('asphodel')
  expect(j([])).toBe('asphodel')
  expect(j(['heaven', 'elysium'])).toBe('elysium')
})

test('realms are revealed Tartarus first, Elysium last', () => {
  expect(realmsRevealed(0)).toEqual(['tartarus'])
  expect(realmsRevealed(1)).toEqual(['tartarus', 'asphodel'])
  expect(realmsRevealed(2)).toEqual(['tartarus', 'asphodel', 'elysium'])
})

test('favored of Hades is the highest total, jointly on a tie', () => {
  const t = totals([{ shadeId: 'ana', amount: 3 }, { shadeId: 'ben', amount: 2 }, { shadeId: 'ben', amount: 1 }, { shadeId: 'cal', amount: 1 }])
  expect(t.get('ben')).toBe(3)
  expect(favored(t, ['ana', 'ben', 'cal']).sort()).toEqual(['ana', 'ben'])
  expect(favored(new Map(), ['ana'])).toEqual([])
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/game/scoring.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/scoring.ts`** to the interfaces and rules above.

- [ ] **Step 4: Run all tests to see them pass**

Run: `npm test`
Expected: all pass, including the 37 setup tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/game/scoring.test.ts
git commit -m "feat: add trial scoring" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Content

**Files:**
- Create: `src/content/copy.ts`, `src/content/prompts.ts`

- `copy.ts` exports every on-screen line from `docs/game-plan.md`, verbatim and grouped by screen: welcome, form labels, hints and examples, closing, late welcome, opening lines, the obol line, the bound-shades call (Seeds), round intros, Round 1 reveal lines keyed by `'most' | 'half' | 'none'`, the three realms (name and description), the reveal lines, closing lines, and the spec's fixed strings ("Look to the Court", "Frame a shade", "The Court has heard enough", "The Court received no petition", "The petitions are being written", "Your shade is recorded").
  Each speaker line is `{ speaker: 'Hades' | 'Persephone'; text: string }`.
- `prompts.ts` exports `PROMPTS: Prompt[]`: the 15 from the game plan with their lore notes, then 5 spares.
  The spares were drafted by Claude and approved by Mark on 30 October:
  - `[Name]'s last words before crossing the river:`
  - `The one thing [Name] would smuggle past Cerberus.` (note: *Cerberus is Hades' three-headed guard dog.*)
  - `A terrible name for a cocktail served in the Underworld.`
  - `What Sisyphus would do if he ever got the boulder to the top.` (note: *Sisyphus pushes a boulder uphill for eternity.*)
  - `Hades' least favourite party guest, and why.`
- The game plan scripts no line for Hades calling the bound shades forward, so the TV shows only the toast ("To the Court Below, may we never leave.") and Hades ad-libs the call.

- [ ] **Step 1: Write both files.**
- [x] **Step 2: Mark approved the five spare prompts.**
- [ ] **Step 3: Type-check:** `npx tsc -b`. Expected: no errors.
- [ ] **Step 4: Commit** `feat: add trial copy and prompts`.

---

### Task 5: Data layer, clock and portraits

**Files:**
- Create: `src/lib/api.ts`, `src/lib/useGame.ts`, `src/lib/clock.ts`, `src/lib/image.ts`
- Modify: `src/main.tsx` (route `/`, `/tv`, `/host` to stub components in `src/guest/GuestPage.tsx`, `src/tv/TvPage.tsx`, `src/host/HostPage.tsx`)

**Interfaces:**
- Produces:
  ```ts
  // src/lib/api.ts: rows mapped snake_case to the Task 2 types; every call throws on error, like src/setup/api.ts
  export async function ensureAnonymous(): Promise<string>                  // user id, signing in anonymously if needed
  export async function signInHost(email: string, password: string): Promise<void>   // throws 'This account is not a host.' unless rpc('is_host')
  export async function isHost(): Promise<boolean>
  export async function setPhase(phase: Phase, step: number, seconds: number): Promise<void>
  export async function addTime(seconds: number): Promise<void>
  export async function resetGame(): Promise<void>
  export async function serverNow(): Promise<number>                        // ms
  export async function voteCount(round: 1 | 2 | 3, item: number): Promise<number>
  export async function answerCount(): Promise<number>
  export async function saveShade(s: { name: string; guise: string | null; portraitPath: string | null }): Promise<void>   // upsert own row
  export async function saveConfession(c: Omit<Confession, 'shadeId'>): Promise<void>
  export async function uploadPortrait(userId: string, jpeg: Blob): Promise<string>   // returns '<id>.jpg?v=<ms>'
  export function portraitUrl(path: string | null): string | null           // public URL, or null
  export async function vote(round: 1 | 2 | 3, item: number, choice: string): Promise<void>   // upsert
  export async function saveAnswer(matchup: number, text: string): Promise<void>               // upsert
  // src/lib/useGame.ts
  export type Role = 'guest' | 'tv' | 'host'
  export interface GameData {
    game: GameState; shades: Shade[]; r1: R1Item[]; r2: Matchup[]; r3: string[]; obols: { shadeId: string; amount: number }[]
    mine: { votes: Vote[]; assignments: { matchup: number; slot: 'a' | 'b' }[]; answers: { matchup: number; text: string }[]; confession: Confession | null }
    host?: { confessions: Confession[]; answers: { matchup: number; writerId: string; text: string }[]; assignments: { matchup: number; slot: 'a' | 'b'; writerId: string }[]
      r1Authors: { idx: number; authorId: string }[]; votes: Vote[]; hidden: Set<string> }
  }
  export function useGame(role: Role, userId: string | null): { data: GameData | null; error: string | null; refresh: () => void }
  // src/lib/clock.ts
  export function useCountdown(deadlineAt: string | null): number | null    // whole seconds left, never negative; null with no deadline
  // src/lib/image.ts
  export async function toPortrait(file: File): Promise<Blob>               // EXIF-rotated, 1080 px long edge, JPEG 0.8
  ```
- `R1Item` (`{ idx; text; authorId: string | null; correct: number | null; guessers: number | null }`) and `Matchup` (`{ idx; prompt; note; subjectId; opened; answerA; answerB; writerA; writerB; votesA; votesB }`) join the types in `src/lib/game.ts`.

- `useGame` copies the pattern of `src/setup/useSetupData.ts`: any Realtime change on `game, shades, r1_items, r2_matchups, r3_items, obols` triggers a 150 ms debounced full refetch; it also refetches on `visibilitychange` to visible, on `SUBSCRIBED`, and every 30 s. A fresh channel topic per mount (see the comment in `useSetupData.ts`). `mine` loads only with a `userId`; `host` loads only for `role === 'host'`. After `vote` or `saveAnswer`, the caller calls `refresh()` so the phone shows what the database holds.
- `useCountdown` calls `serverNow()` once per page load to get the clock offset, then ticks every 250 ms and on `visibilitychange`.
- `toPortrait` uses `createImageBitmap(file, { imageOrientation: 'from-image' })`, a canvas, and `canvas.toBlob(..., 'image/jpeg', 0.8)`.
- In dev only, expose `window.__game = { supabase, api }` for `supabase/game_rls_checks.md`.

- [ ] **Step 1: Implement the four files and the route stubs.**
- [ ] **Step 2: Build:** `npm run build`. Expected: no errors.
- [ ] **Step 3: Smoke-test against the live project:** `npm run dev`, open `/tv`, and in the console `await __game.api.serverNow()` returns a time within a second of now, and `__game.supabase.from('game').select()` returns the `lobby` row.
- [ ] **Step 4: Commit** `feat: add game data layer, clock and portrait resize`.

---

### Task 6: Arrival form (`/`)

**Files:**
- Create: `src/guest/GuestPage.tsx`, `src/guest/ArrivalForm.tsx`, `src/guest/guest.css`

**Behaviour:**
- On load, `ensureAnonymous()`, then `useGame('guest', userId)`.
- **No shade yet, phase `lobby`:** the welcome line, then the form: mortal name (required, 40), guise (60, with its hint), portrait (`<input type="file" accept="image/*" capture="user">`, a preview, "Retake"), the three confessions (140 each, with their examples as placeholders and the "Keep it something you'd say at a party" line). Submit saves the shade, uploads the portrait, saves the portrait path, then saves the confessions.
  The portrait is optional (the game plan leaves it open); without one, screens show the name's initial on plum.
- **No shade yet, any later phase before `finale`:** the same form with only name and portrait, under the late welcome line.
- **Shade saved, phase `lobby`:** the closing screen, then a countdown to 23:00 (`2026-10-31T23:00:00+01:00`), and an "Edit my shade" link that reopens the form filled in.
- Submit errors show under the button in plain words ("The Court couldn't record that. Check your connection and try again."). Keep what was typed.
- The controller screens for later phases come in Tasks 8 to 10; until then, any other phase shows "Look to the Court".

- [ ] **Step 1: Implement the screens.**
- [ ] **Step 2: Build:** `npm run build`.
- [ ] **Step 3: Check on a real phone** via the PR deploy preview: fill the form with a photo, see the row in `shades` and the file in Storage (MCP: `select name, portrait_path from shades`). Retake the photo and confirm the overwrite works.
- [ ] **Step 4: Commit** `feat: add the arrival form`.

**Milestone A:** guests can create shades.

---

### Task 7: Hall of Shades and the host remote

**Files:**
- Create: `src/tv/TvPage.tsx`, `src/tv/Hall.tsx`, `src/tv/tv.css`, `src/host/HostPage.tsx`, `src/host/HostSignIn.tsx`, `src/host/engine.ts`, `src/host/rehearsal.ts`, `src/host/host.css`, `src/ui/Portrait.tsx`
- Modify: `package.json` (`qrcode` and `@types/qrcode`)

**Interfaces:**
- Produces:
  ```ts
  // src/host/engine.ts
  export async function advance(d: GameData): Promise<void>   // set_phase to nextStep(), then enter()
  export async function enter(d: GameData): Promise<void>     // the current phase's entry work; idempotent
  // src/host/rehearsal.ts
  export async function seedTestShades(n: number): Promise<void>   // test = true, random ids, canned names, guises and confessions
  export async function autoVote(d: GameData): Promise<void>        // fills in every test shade's vote or answer for the current item
  // src/ui/Portrait.tsx
  export function Portrait(props: { shade: Shade; size: 'sm' | 'md' | 'lg' | 'xl' }): JSX.Element   // photo, or initial on plum
  ```

**TV (`/tv`):** `ensureAnonymous()`, then `useGame('tv', null)`. In `lobby` and `after`, the Hall of Shades: one portrait at a time, crossfading every 8 s, with name and guise (and realm in `after`), and a QR code of `location.origin + '/'` in a corner. Hidden shades never appear. Other phases show a placeholder until Tasks 8 to 10.
For `intro`, show the opening lines (step 0), the obol line (step 1) and the bound-shades call (step 2).

**Remote (`/host`):** host sign-in (email and password), then:
- The current phase and step in words, the countdown, and the live counter (`voteCount` or `answerCount`, polled every 2 s during timed phases).
- **Next** (large), **+10 seconds**, and during lobby a count of shades so far.
- A shade list with a Hide toggle (for duplicates).
- A Rehearsal section: **Seed 12 test shades**, **Auto-vote** (shown when test shades exist), **Reset game** (behind `window.confirm`).
- On load and after each Next, the remote calls `enter()`.

**Engine, this task's part:** `enter()` on `intro` builds all three rounds if `r3_items` is empty: delete any partial round rows, then write `r1_items` (author null) with `r1_authors`, `r2_matchups` with `r2_assignments`, and `r3_items`, using `players()` from current shades, the non-hidden confessions and `PROMPTS`, with `Math.random`.
`advance()` reads its counts from `d.r1.length`, `d.r2.length` and `d.r3.length`.

- [ ] **Step 1: Implement the TV hall, the remote, `engine.ts` (intro only) and `rehearsal.ts` (seeding only).**
- [ ] **Step 2: Build:** `npm run build`.
- [ ] **Step 3: Check end to end:** laptop on `/tv`, phone on `/host`. Seed test shades and watch them appear in the Hall. Create a real shade on a second phone and watch it appear. Press Next into `intro` and check `r1_items`, `r2_matchups` and `r3_items` were written (MCP). Reload `/host` and check nothing was rebuilt. Reset game.
- [ ] **Step 4: Commit** `feat: add the hall of shades and host remote`.

**Milestone B:** tonight's rehearsal. Shades from phones fill the TV, and the remote drives the opening.

---

### Task 8: Round 1, Whose Sin Is It?

**Files:**
- Create: `src/guest/PickShade.tsx`, `src/tv/Round1.tsx`
- Modify: `src/guest/GuestPage.tsx`, `src/tv/TvPage.tsx`, `src/host/engine.ts`, `src/host/rehearsal.ts`

- **Phone, `r1_vote`:** a grid of every player except yourself (portrait and name), titled "Frame a shade" for the author and otherwise with the confession above it. Tapping votes; the chosen tile shows the vote read back from the database. After the deadline plus 3 s, or if the write is rejected, "The Court has heard enough".
  The phone knows it's the author by its own `mine.confession` matching the item's text.
- **TV, `r1_intro`:** Persephone's round intro. **`r1_vote`:** *This shade confesses:* the text, the countdown, and "N of M have judged". **`r1_reveal`:** the author's portrait and name, "K of N guessed right", and the reveal line for `revealTone()`. Until `author_id` arrives, the confession stays up (no invented "waiting" line).
- **Engine:** on `r1_reveal` step `i`, if `r1_items[i].author_id` is null: score with `scoreRound1`, upsert the awards into `obols` (on conflict `shade_id,round,item,reason`), then update the item with `author_id`, `correct` and `guessers`.
- **Auto-vote:** each test shade votes for a random player other than itself.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Build:** `npm run build`.
- [ ] **Step 3: Rehearse Round 1** with seeded shades, Auto-vote and one real phone. Lock the phone mid-vote, unlock it and check it catches up. Check the `obols` rows add up by hand for one item.
- [ ] **Step 4: Commit** `feat: add round 1`.

---

### Task 9: Round 3, the finale and the after-party

**Files:**
- Create: `src/guest/Judge.tsx`, `src/guest/Verdict.tsx`, `src/tv/Round3.tsx`, `src/tv/Finale.tsx`
- Modify: `src/guest/GuestPage.tsx`, `src/tv/TvPage.tsx`, `src/host/engine.ts`, `src/host/rehearsal.ts`

- **TV, `r3_intro`:** step 0 Hades' intro, step 1 the three realms with their descriptions. **`r3_vote`:** the portrait, name, guise and bargain (unless hidden), the countdown and the counter. **`r3_reveal`:** the speaker line for the realm, then its portraits filling the screen. **`finale`:** step 0 the leaderboard (every shade with a total, highest first); step 1 Persephone's closing lines, then Hades' closing line with the Favored of Hades (joint names on a tie). **`after`:** the Hall with realm labels.
- **Phone, `r3_vote`:** three large buttons, each with its realm's description; the choice is read back. **`finale` and `after`:** your realm and your obol total.
- **Engine:** on `r3_reveal` step `s`, compute `judge()` for every Round 3 shade and write `shades.realm` only for shades whose realm is in `realmsRevealed(s)`.
- **Auto-vote:** a random realm.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Build:** `npm run build`.
- [ ] **Step 3: Rehearse Rounds 1 and 3 back to back** (Round 2 skipped with fewer than 3 players, or Next through it). Check that during `r3_reveal` step 0 no phone can see an Asphodel or Elysium realm (MCP: `select realm, count(*) from shades group by realm`).
- [ ] **Step 4: Commit** `feat: add round 3 and the finale`.

**Milestone C:** a complete game without Round 2.

---

### Task 10: Round 2, Petitions to Hades

**Files:**
- Create: `src/guest/Petitions.tsx`, `src/guest/ChooseAnswer.tsx`, `src/tv/Round2.tsx`
- Modify: `src/guest/GuestPage.tsx`, `src/tv/TvPage.tsx`, `src/host/engine.ts`, `src/host/rehearsal.ts`

- **TV, `r2_intro`:** Hades' intro. **`r2_write`:** "The petitions are being written", the countdown and "N of M petitions received". **`r2_vote`:** the prompt (with its note), answers A and B side by side, unsigned; "The Court received no petition" for a missing one. **`r2_reveal`:** the writers' portraits under their answers, and the vote split. The previous screen stays up until the data lands.
- **Phone, `r2_write`:** your two prompts (from `mine.assignments` joined to `r2`), one text box each (80 max, with a counter), saved on blur and on a Save button, showing "Saved" once read back. Shades without assignments see "Look to the Court".
- **Phone, `r2_vote`:** A and B as two large buttons. For the two writers the heading says it's a bet on the winner.
- **Engine:** on `r2_vote` step `i`, if the matchup isn't `opened`: copy each writer's answer (or null if missing or hidden) into `answer_a` and `answer_b` and set `opened`. On `r2_reveal` step `i`, if `votes_a` is null: score with `scoreRound2`, upsert obols, then write `writer_a`, `writer_b`, `votes_a`, `votes_b`.
- **Auto-vote:** in `r2_write`, each test writer saves a canned answer; in `r2_vote`, a random `a` or `b`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Build:** `npm run build`.
- [ ] **Step 3: Rehearse all three rounds.** Check that during `r2_vote` step 0 the public `r2_matchups` rows for steps 1 and later still have null answers.
- [ ] **Step 4: Commit** `feat: add round 2`.

---

### Task 11: Moderation

**Files:**
- Modify: `src/host/HostPage.tsx`, `src/host/engine.ts`

- During `lobby`, the remote lists every confession as it arrives (sin, talent, bargain, with the shade's name), each with a Hide toggle that writes `hidden_items`. Round 1 building already skips hidden ones; Round 3 shows no bargain for a hidden one.
- During `r2_write` and `r2_vote`, the remote lists the answers for the current matchup with Hide. Hiding during `r2_vote` also clears that answer in the public matchup, so the TV switches to "The Court received no petition".

- [ ] **Step 1: Implement.** - [ ] **Step 2: Build.** - [ ] **Step 3: Check** that a hidden confession never becomes a Round 1 item. - [ ] **Step 4: Commit** `feat: add moderation to the remote`.

---

### Task 12: Docs

**Files:**
- Modify: `docs/tech-spec.md`, `docs/game-plan.md`, `README.md`, `CLAUDE.md`

- Bring the tech spec in line with every item under [Changes from the spec](#changes-from-the-spec): the engine on `/host`, the anonymous TV, `r1_authors`, the `test` column, the new phases and steps, Asphodel for ties, late shades, `reset_game()` in `schema.sql`, the dropped Realtime tables, the cut features, and the repo layout as built.
- Game plan: the tie rule, the late-arrival behaviour, the five spare prompts once approved, and tick any open decisions that were made along the way.
- README status line; CLAUDE.md SQL order (`schema.sql` now includes reset and storage).
- Add a status line to the top of this plan: `**Status: Implemented** — merged PR #XX`.

- [ ] **Step 1: Edit the docs.** - [ ] **Step 2: Commit** `docs: bring the spec in line with the game as built`.
