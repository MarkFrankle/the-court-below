# `/setup` Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live, shared setup checklist at `/setup` with three views (Next for me, By room, By priority), assignees, priorities, time slots and blockers.

**Architecture:** Supabase holds sections, tasks and blockers behind RLS; hosts (Sarah, Mark) edit, code-joined helpers only tick through a security definer function.
The client loads everything once, keeps it in one hook updated by Realtime, and derives every view from pure functions in `src/setup/rank.ts`.

**Tech Stack:** Vite 7, React 19, TypeScript, `@supabase/supabase-js` 2, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-29-setup-page-design.md` (read it first; it overrides the Setup section of `docs/tech-spec.md`).

## Global Constraints

- Stay on Vite 7 (Vite 8 crashes npm 10.8.2 on install). Install Vitest as `vitest@^3.2`.
- No router library; `src/main.tsx` routes by `location.pathname`.
- Never create `supabase/migrations/`. SQL lives in `supabase/*.sql` and Sarah pastes it into the SQL editor by hand, in this order: `hosts.sql`, `setup.sql`, `seed_setup.sql`.
- Never use the secret or service_role key. Client env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- RLS is the security boundary: helpers can read every setup table and only tick or untick; only `is_host()` writes sections, tasks and blockers.
- Hosts: `sarah@frankle.fyi` is `sarah` ("Sarah"), `mark@frankle.fyi` is `mark` ("Mark").
- Setup code `pain-and-panic`, compared case-insensitively with runs of spaces and hyphens treated as one hyphen.
- Helper group label "Pain & Panic", defined once as `HELPERS_LABEL`.
- Priorities `must`, `should`, `nice`, labelled "Must", "Should", "Nice to have"; default `should`.
- Slots (Europe/Amsterdam is UTC+01:00 on both days, DST ended 25 Oct), null means Anytime:

  | id | label | start | end |
  | --- | --- | --- | --- |
  | `fri_shops` | Friday, shops open | `2026-10-30T09:00:00+01:00` | `2026-10-30T20:00:00+01:00` |
  | `fri_before_friends` | Friday, before friends arrive | `2026-10-30T09:00:00+01:00` | `2026-10-30T17:00:00+01:00` |
  | `fri_evening` | Friday evening | `2026-10-30T17:00:00+01:00` | `2026-10-31T00:00:00+01:00` |
  | `sat_shops` | Saturday, shops open | `2026-10-31T09:00:00+01:00` | `2026-10-31T18:00:00+01:00` |
  | `sat_afternoon` | Saturday afternoon | `2026-10-31T12:00:00+01:00` | `2026-10-31T19:00:00+01:00` |
  | `before_doors` | Before doors | `2026-10-31T19:00:00+01:00` | `2026-10-31T20:00:00+01:00` |

- Mobile-first, dark theme tokens from `src/styles/theme.css` (ink, plum, gold); Cormorant Garamond display, Inter body.
- Code comments and Markdown break at sentences.
- Work on branch `setup-page` (not `main`; every push to `main` deploys). Commits: `git commit -m "type: message" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. Don't push unless Sarah asks.

## Review Focus

- **Phone locked mid-setup:** on unlock the lists catch up without a reload (refetch on `visibilitychange` and on channel re-subscribe). Owned by Task 4.
- **A tick by a helper whose name the client hasn't loaded yet:** "done by" still shows a name, not blank (refetch editors when `done_by` is unknown). Owned by Task 4.
- **Host ticks before their `setup_editors` row exists:** must not fail; `claim_host_editor()` runs on every host sign-in before the page renders. Owned by Tasks 2 and 5.
- **Blocker deleted along with its task:** dependents stop showing "waiting on" a ghost and become doable. Test `blocker that no longer exists does not block` in Task 1.
- **Late and blocked at once:** a task whose slot has ended but which still has an open blocker is `blocked`, not `late`, so it doesn't jump to the top while nobody can do it. Test `blocked wins over late` in Task 1.

---

### Task 1: Model, slots and ranking (pure)

**Files:**
- Create: `src/setup/model.ts`, `src/setup/rank.ts`, `tests/setup/rank.test.ts`
- Modify: `package.json` (add `vitest@^3.2` dev dependency and `"test": "vitest run"`)

**Interfaces:**
- Produces (`model.ts`):
  ```ts
  export type Person = 'sarah' | 'mark'
  export type Viewer = Person | 'helper'
  export type Priority = 'must' | 'should' | 'nice'
  export type SlotId = 'fri_shops' | 'fri_evening' | 'sat_shops' | 'sat_afternoon' | 'before_doors'
  export interface Slot { id: SlotId; label: string; start: Date; end: Date }
  export const SLOTS: Record<SlotId, Slot>
  export const PRIORITY_ORDER: Priority[]            // ['must', 'should', 'nice']
  export const PRIORITY_LABELS: Record<Priority, string>
  export const HELPERS_LABEL = 'Pain & Panic'
  export const PERSON_NAMES: Record<Person, string>  // Sarah, Mark
  export function personFromEmail(email: string | undefined): Person | null
  export interface Section { id: string; key: string; title: string; kind: 'room' | 'shopping' | 'day'; position: number }
  export interface Task { id: string; key: string; sectionId: string; text: string; note: string | null;
    assignee: Person | null; priority: Priority; slot: SlotId | null; position: number;
    doneBy: string | null; doneAt: string | null }
  export interface Blocker { itemId: string; blockedById: string }
  export interface Editor { userId: string; name: string }
  ```
- Produces (`rank.ts`):
  ```ts
  export type TaskState = 'done' | 'doable' | 'late' | 'blocked' | 'not_yet'
  export interface TaskView { task: Task; state: TaskState; waitingOn: Task[]; unblocksOthers: boolean }
  export function viewTasks(tasks: Task[], blockers: Blocker[], viewer: Viewer, now: Date): Map<string, TaskView>
  export function rankNext(tasks: Task[], sections: Section[], blockers: Blocker[], viewer: Viewer, now: Date): TaskView[]
  export function groupByRoom(tasks: Task[], sections: Section[], blockers: Blocker[], viewer: Viewer, now: Date): { section: Section; items: TaskView[] }[]
  export function groupByPriority(tasks: Task[], sections: Section[], blockers: Blocker[], viewer: Viewer, now: Date): { priority: Priority; items: TaskView[] }[]
  ```

Rules (from the spec):

- State: done if `doneBy`; else `blocked` if any blocker in `blockers` points at an existing open task; else `not_yet` if the slot starts after `now`; else `late` if the slot ended at or before `now`; else `doable`.
- `unblocksOthers`: the task blocks at least one open task whose assignee is not `viewer` (another person, or null). For `viewer = 'helper'`, any open dependent assigned to someone else counts. Null-assignee dependents count for everyone.
- `rankNext` includes open tasks only: for a person, assignee is that person or null; for helpers, null only.
  Doable and late go first, sorted by priority, then (assignee is viewer or `unblocksOthers`) first, then late before doable, then slot end soonest (Anytime last), then section position, then task position.
  Then not_yet (by slot start, then priority), then blocked (by priority), each tie broken by section and task position.
- `groupByRoom`: every section in position order with every task (done included) in position order; empty sections kept.
- `groupByPriority`: three groups in `PRIORITY_ORDER`, items in section then task position, done included.

- [ ] **Step 1: Install Vitest and add the test script**

Run: `npm install -D vitest@^3.2` then add `"test": "vitest run"` to `package.json` scripts.
Expected: install succeeds without the `edgesOut` crash; `npm test` reports "No test files found".

- [ ] **Step 2: Write the failing tests** in `tests/setup/rank.test.ts`, with a small `task()` factory and fixed `now` values from the slot table. Tests and assertions:

- `personFromEmail maps host emails`: `sarah@frankle.fyi` gives `'sarah'`, `MARK@frankle.fyi` gives `'mark'`, `x@y.z` and `undefined` give `null`.
- `anytime task with no blockers is doable`.
- `task with an open blocker is blocked and lists it in waitingOn`.
- `ticking the blocker makes the dependent doable`.
- `blocker that no longer exists does not block` (blocker row points at an id missing from `tasks`).
- `slot not started is not_yet`: `fri_evening` at `2026-10-30T12:00:00+01:00`.
- `slot ended is late`: `fri_shops` at `2026-10-30T21:00:00+01:00`.
- `blocked wins over late`.
- `helpers only see unassigned tasks in Next`.
- `Sarah sees her tasks and unassigned, not Mark's`.
- `Next excludes done tasks`.
- `must beats a nice task only Sarah can do`.
- `within a priority, only-mine beats unassigned`.
- `within a priority, a task that unblocks others beats one that does not`.
- `within a priority and tier, late beats doable`.
- `waiting tasks come after doable ones, not_yet before blocked`.
- `groupByRoom keeps done tasks and empty sections in order`.
- `groupByPriority groups must, should, nice`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules `src/setup/model` and `src/setup/rank` not found.

- [ ] **Step 4: Implement `model.ts` and `rank.ts`** to the interfaces and rules above.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npx tsc -b`
Expected: all tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git checkout -b setup-page
git add package.json package-lock.json src/setup/model.ts src/setup/rank.ts tests/setup/rank.test.ts
git commit -m "feat: add setup task model and ranking" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Database SQL (hosts and setup)

**Files:**
- Create: `supabase/hosts.sql`, `supabase/setup.sql`, `supabase/setup_rls_checks.md`

**Interfaces:**
- Produces (SQL, called from the client):
  - `join_setup(p_code text, p_name text) returns boolean`
  - `claim_host_editor() returns text` (the host's name; raises `not host` otherwise)
  - `set_task_done(p_task uuid, p_done boolean) returns void`
  - Tables `setup_editors (user_id, name)`, `setup_sections (id, key, title, kind, position)`, `setup_items (id, key, section_id, text, note, assignee, priority, slot, position, done_by, done_at, updated_at)`, `setup_blockers (item_id, blocked_by_id)`.

`hosts.sql`: the `hosts` table and `is_host()` exactly as in the tech spec's schema, plus RLS on `hosts` with the `host_read` policy, plus the insert of both hosts from `auth.users`.

`setup.sql`, starting from the tech spec's setup block with these changes:

- `setup_secret.code` stores the normalised code; insert `'pain-and-panic'`.
- `join_setup` compares `lower(regexp_replace(trim(p_code), '[\s-]+', '-', 'g'))` with the stored code and trims `p_name`.
- `setup_sections` gains `key text not null unique`.
- `setup_items` drops `owner` and gains `key text not null unique`, `assignee text check (assignee in ('sarah', 'mark', 'hosts'))`, `priority text not null default 'should' check (priority in ('must', 'should', 'nice'))`, `slot text check (slot in ('fri_shops', 'fri_evening', 'sat_shops', 'sat_afternoon', 'before_doors'))`.
- `setup_blockers (item_id uuid references setup_items on delete cascade, blocked_by_id uuid references setup_items on delete cascade, primary key (item_id, blocked_by_id), check (item_id <> blocked_by_id))`.
- A `before insert or update` trigger on `setup_blockers` raising `blocker loop` when a recursive walk from `new.blocked_by_id` over existing blockers reaches `new.item_id`.
- `claim_host_editor()`: security definer; if `is_host()`, upsert `setup_editors` with `'Sarah'` or `'Mark'` by the caller's `auth.users.email`, and return it.
- `set_task_done`: security definer, raises `not an editor` unless `is_setup_editor()`; sets `done_by = auth.uid(), done_at = now()` or clears both; touches `updated_at`.
- Policies: `select` on `setup_editors`, `setup_sections`, `setup_items` and `setup_blockers` for `is_setup_editor()`; `insert`, `update`, `delete` on sections, items and blockers for `is_host()` only. Replace the spec's `editors_all` policies.
- Realtime publication: `setup_editors, setup_sections, setup_items, setup_blockers`.

`setup_rls_checks.md`: the manual checks from the spec's Testing section as a short list Sarah can run from the browser console once the client exists (Task 4 exposes `window.__setup` in dev only), with the expected error for each.

- [ ] **Step 1: Write `supabase/hosts.sql` and `supabase/setup.sql`** to the description above.

- [ ] **Step 2: Syntax-check against a throwaway Postgres**

Run: `docker run --rm -d --name pgcheck -e POSTGRES_PASSWORD=x -p 54329:5432 postgres:16` and, with stub `auth` schema (`create schema auth; create table auth.users (id uuid primary key, email text); create function auth.uid() returns uuid language sql as $$ select null::uuid $$; create role authenticated; create publication supabase_realtime;`), run both files with `psql`.
Expected: both files run with no errors. If Docker isn't available, say so and skip; Sarah's paste is then the check.

- [ ] **Step 3: Hand over to Sarah**

Tell Sarah to paste `hosts.sql` then `setup.sql` into the Supabase SQL editor.
Then verify with the read-only MCP: `list_tables` shows the four setup tables plus `hosts` and `setup_secret`, and `select count(*) from hosts` returns 2 (once Mark's user exists; 1 otherwise, which is fine).

- [ ] **Step 4: Commit**

```bash
git add supabase/hosts.sql supabase/setup.sql supabase/setup_rls_checks.md
git commit -m "feat: add setup schema and host role SQL" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Seed from the setup plan

**Files:**
- Create: `supabase/seed_setup.sql`

**Interfaces:**
- Consumes: tables from Task 2; slot ids and priorities from Global Constraints.

Rules:

- The whole seed is one `do $$ ... $$` block that first raises `setup_items is not empty` if any row exists.
- One section per `###` heading under "Checklists by room" and "Shopping list", plus "Saturday before doors"; `kind` is `room`, `shopping` or `day`; positions follow the document.
- One task per checkbox in `docs/setup-plan.md`, text without the bold markers, with a kebab-case `key` unique across the seed (such as `arch-wisteria`).
- Assignee: `mark` for items marked **Mark**, under "Drinks (Mark)", or for Mark's bar station; `sarah` for **Decide** items; otherwise null.
- Priority: **Decide** items `must`; "Bathroom" decor, the mushy seats and the incense `nice`; the rest `should` unless clearly essential for doors (QR cards, laptop casting, food, drinks, ice, candles: `must`).
- Slot: shopping marked Friday `fri_shops`; Saturday fresh food, ice and garnishes `sat_shops`; frozen yogurt bites `fri_evening`; entryway and costumes `sat_afternoon`; each timed "Saturday before doors" line at 19:00 or later `before_doors`; everything else null.
- Blockers by key, inserted with `insert into setup_blockers select a.id, b.id from setup_items a, setup_items b where a.key = ... and b.key = ...`, at least: tree step 2 waits on step 1; arch wisteria waits on arch step 3; album QR card waits on the album; filling the platters waits on buying them; candelabra waits on black candles; LED and faux candles wait on batteries; hanging portraits waits on printing; skulls' jewels wait on hanging the skulls; QR cards by the door wait on printing QR cards; lamps and LED candles wait on rearranging furniture.

- [ ] **Step 1: Write `supabase/seed_setup.sql`** to the rules.

- [ ] **Step 2: Check it** against the Task 2 throwaway Postgres (after `setup.sql`): it runs once, and a second run fails with `setup_items is not empty`.
Expected: both behaviours seen. Skip with a note if Docker is unavailable.

- [ ] **Step 3: Hand over to Sarah** to paste it, then verify with MCP: `select count(*) from setup_items` matches the checkbox count in `docs/setup-plan.md` (`grep -c '\- \[ \]' docs/setup-plan.md`).

- [ ] **Step 4: Commit**

```bash
git add supabase/seed_setup.sql
git commit -m "feat: seed setup checklist from the setup plan" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Supabase client and live data hook

**Files:**
- Create: `src/lib/supabase.ts`, `src/setup/api.ts`, `src/setup/useSetupData.ts`, `.env.example`

**Interfaces:**
- Consumes: SQL functions and tables from Task 2; types from Task 1.
- Produces:
  ```ts
  // src/lib/supabase.ts
  export const supabase: SupabaseClient
  // src/setup/api.ts (rows mapped snake_case to the Task 1 types)
  export type Session = { viewer: Viewer; name: string; userId: string }
  export async function currentSession(): Promise<Session | null>   // host via personFromEmail + claim_host_editor; helper via setup_editors row
  export async function joinAsHelper(code: string, name: string): Promise<'ok' | 'bad_code'>   // anonymous sign-in, then join_setup
  export async function signInHost(email: string, password: string): Promise<Session>
  export async function signOut(): Promise<void>
  export async function setDone(taskId: string, done: boolean): Promise<void>
  export async function saveTask(task: Task): Promise<void>        // upsert, host only
  export async function deleteTask(id: string): Promise<void>
  export async function restoreTask(task: Task, blockers: Blocker[]): Promise<void>
  export async function setBlockers(itemId: string, blockedByIds: string[]): Promise<void>
  export async function saveSection(section: Section): Promise<void>
  // src/setup/useSetupData.ts
  export function useSetupData(enabled: boolean): { sections: Section[]; tasks: Task[]; blockers: Blocker[]; editors: Map<string, string>; error: string | null; refresh: () => void }
  ```

- `useSetupData` fetches all four tables, subscribes to one channel `setup` with `postgres_changes` on all four, applies inserts, updates and deletes to local state, and refetches in full on `visibilitychange` to visible, on `SUBSCRIBED` after a reconnect, every 30 s, and when a task's `doneBy` isn't in `editors`.
- In dev only (`import.meta.env.DEV`), expose `window.__setup = { supabase, api }` for the RLS checks.
- `.env.example` lists `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`.

- [ ] **Step 1: Implement the three files** to the interfaces.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc -b && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts src/setup/api.ts src/setup/useSetupData.ts .env.example
git commit -m "feat: add setup data layer with realtime" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Sign-in, shell, By room and ticking

**Files:**
- Create: `src/setup/SetupPage.tsx`, `src/setup/SignIn.tsx`, `src/setup/TaskRow.tsx`, `src/setup/RoomView.tsx`, `src/setup/Undo.tsx`, `src/setup/setup.css`
- Modify: `src/main.tsx` (render `<SetupPage />` for `/setup`; other routes keep the placeholder)

**Interfaces:**
- Consumes: Task 4 API and hook; `groupByRoom` from Task 1.
- Produces:
  ```ts
  export function TaskRow(props: { view: TaskView; editors: Map<string, string>; sections?: Section[]; canEdit: boolean; onToggle: (done: boolean) => void; onEdit?: () => void }): JSX.Element
  export function useUndo(): { show: (label: string, undo: () => void) => void; element: JSX.Element }   // 5-second toast
  ```

- `SignIn`: two paths, "I'm one of Pain & Panic" (name, then setup code) and "Host sign in" (email, password). A bad code shows "That's not the code." and keeps the name.
- `SetupPage`: loads `currentSession()`, shows `SignIn` if null, otherwise a header (name, sign out) and three tabs, Next, By room and By priority, with By room working in this task and the other two showing "Coming shortly".
- `TaskRow`: checkbox, text, note, assignee name, "Sarah or Mark" or "anyone", priority chip, and a state label: "late" (red), "waiting on: <texts>", the slot label for `not_yet`, or "done by <name>" with strike-through.
- Ticking calls `setDone` straight away and shows the undo toast ("Ticked: <text>", Undo unticks).
- Layout sketches from `docs/sketches/*.jpg` at the bottom of By room. Copy them to `public/sketches/` so Vite serves them.

- [ ] **Step 1: Implement** the files to the description.

- [ ] **Step 2: Verify in the browser** with `npm run dev` on a phone-width viewport (use the `run` skill):
  - helper join with "Pain and Panic" works, and "wrong" shows the error
  - host sign-in as Sarah shows "Sarah" in the header
  - ticking a task in one tab shows "done by" in a second tab within a couple of seconds
  - locking the tab (switch away and back) refetches
  Expected: all four observed.

- [ ] **Step 3: Run the RLS checks** in `supabase/setup_rls_checks.md` as a helper and with no session.
Expected: every check gives its listed result.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/setup public/sketches
git commit -m "feat: add setup sign-in and by-room view" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Next for me and By priority

**Files:**
- Create: `src/setup/NextView.tsx`, `src/setup/PriorityView.tsx`
- Modify: `src/setup/SetupPage.tsx` (wire the two tabs; Next becomes the default)

**Interfaces:**
- Consumes: `rankNext`, `groupByPriority` (Task 1), `TaskRow` and `useUndo` (Task 5).

- `NextView`: doable and late tasks first, then a "Coming up" divider and the waiting tasks greyed out. The first task gets a larger card. "now" ticks every 60 s so slots roll over. Empty state: "Nothing for you right now."
- `PriorityView`: three headed groups using `PRIORITY_LABELS`.

- [ ] **Step 1: Implement** both views and the wiring.

- [ ] **Step 2: Verify in the browser**: as Sarah, Next's first task is a Must; as a helper, no task assigned to Sarah or Mark appears in Next; ticking a blocker makes its dependent move up on a second tab.
Expected: all three observed.

- [ ] **Step 3: Commit**

```bash
git add src/setup
git commit -m "feat: add next-for-me and by-priority views" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Host editing of tasks

**Files:**
- Create: `src/setup/TaskEditor.tsx`
- Modify: `src/setup/RoomView.tsx` (an "Add task" button per section for hosts), `src/setup/TaskRow.tsx` (tap to edit for hosts)

**Interfaces:**
- Consumes: `saveTask`, `deleteTask`, `restoreTask` (Task 4); `useUndo` (Task 5).

- `TaskEditor`: a sheet with text (max 200), note, assignee (Sarah, Mark, Sarah or Mark, anyone), priority, slot (Anytime plus the five slots), section, and delete.
- A new task gets a `key` from its text (kebab-case, a short random suffix if taken) and the next position in its section.
- Delete keeps the task and its blockers in memory and shows the undo toast; Undo calls `restoreTask`.
- Helpers never see the editor or the add buttons.

- [ ] **Step 1: Implement** the editor and the wiring.

- [ ] **Step 2: Verify in the browser**: as Mark, add, edit and delete a task, then undo the delete; it returns with its blockers. As a helper, no edit controls show.
Expected: all observed.

- [ ] **Step 3: Commit**

```bash
git add src/setup
git commit -m "feat: let hosts add, edit and delete setup tasks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Blockers, moving tasks and sections

**Files:**
- Create: `src/setup/BlockerPicker.tsx`, `src/setup/SectionEditor.tsx`
- Modify: `src/setup/TaskEditor.tsx`, `src/setup/RoomView.tsx`

**Interfaces:**
- Consumes: `setBlockers`, `saveTask`, `saveSection` (Task 4).

- `BlockerPicker`: a search box over task texts, with the current blockers as removable chips. A `blocker loop` error from the database shows "That would make a loop."
- Move up and down within a section swaps positions with the neighbour; changing the section in the editor puts the task last there.
- `SectionEditor`: add a section (title, kind) and rename one, hosts only.

- [ ] **Step 1: Implement** the picker, moves and section editor.

- [ ] **Step 2: Verify in the browser**: add a blocker and see the dependent show "waiting on"; try a loop and see the message; move a task up and to another section; add and rename a section.
Expected: all observed.

- [ ] **Step 3: Commit**

```bash
git add src/setup
git commit -m "feat: add blocker editing, task moves and sections" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Docs

**Files:**
- Modify: `docs/tech-spec.md` (replace the "Setup page" section with a summary of the design and a link to the design doc; move `hosts`/`is_host()` out of `schema.sql` and note that `hosts.sql` runs first; update the repo layout and the setup RLS test checklist item), `docs/setup-plan.md` (one line saying the live list in Supabase is now the source of truth once seeded, and edits after seeding go through SQL scripts by task `key`), `CLAUDE.md` (setup code chosen; remove it from Open; note the SQL file order)

- [ ] **Step 1: Make the edits**, breaking lines at sentences.

- [ ] **Step 2: Check** that `grep -n "owner" docs/tech-spec.md` no longer describes setup items and `grep -n "choose a code" -r docs supabase` finds nothing.

- [ ] **Step 3: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: update spec for the setup page redesign" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## After the plan

Merging `setup-page` into `main` deploys to Netlify. That's Sarah's call, and the Netlify env vars must be set first.
