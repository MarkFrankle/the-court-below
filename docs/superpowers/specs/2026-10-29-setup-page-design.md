# `/setup` redesign: tasks, blockers and "Next for me"

This replaces the [Setup page section of the tech spec](../../tech-spec.md#setup-page-setup).
Once the design is approved, the tech spec is updated to match and this file stays as the record of why.

## Why

Setup runs Friday 30 October (shopping, furniture, photo wall, rehearsal) and Saturday 31 October until doors at 20:00.
Sarah, Mark and a few friends work through it together from their phones.
A long checklist is overwhelming, so the page has to answer one question well: **"what is the next best thing for me to do right now?"**

The checklist alone can't answer that, because some tasks wait on others, some only make sense at certain times (shops open, candles just before doors), and some are nice to have.

This session covers the code and how it works.
The task list itself gets refined in a later session.

## Goals

- **Next for me**: a list for the signed-in person, with the best task first.
- **Rooms**: every to-do, open and done, grouped by room. The full picture.
- **Priority**: the same to-dos grouped by Must, Should and Nice to have.
- **Shopping**: the shopping list, by shop, kept apart from the to-dos.
- Tasks have an assignee, a priority, a time slot and blockers.
- Live: a tick on one phone shows on every phone straight away.
- Works for Friday morning (see [Friday scope](#friday-scope)).

## Non-goals

- Hiding data from helpers. Helpers can see every task; their "Next" list is just kept short.
- Exact opening hours per shop. Rough time slots are enough.
- Notifications, reminders, due dates beyond the slots.
- The old spec's All / Not done / Mine filters. The three views replace them.
- Finalising the task list content.

## Anti-goals

- A "Next" list that feels like the whole list again. If it's overwhelming, it has failed even if it's technically correct.
- Helpers being able to edit or delete tasks by accident.
- A late task (its slot has passed) silently disappearing.

## People and permissions

| Who | Signs in with | Identity | Can |
| --- | --- | --- | --- |
| Sarah | Host email + password (`sarah@frankle.fyi`) | `sarah` | Everything: add, edit, delete, reorder tasks and sections; set assignee, priority, slot, blockers; tick |
| Mark | Host email + password (`mark@frankle.fyi`) | `mark` | Same as Sarah |
| Helpers | Anonymous sign-in, then name + setup code | `helper`, with their name | Read everything, tick and untick |

- Sarah and Mark are hosts (the `hosts` table and `is_host()` from the tech spec). Their identity comes from their auth email: `sarah@frankle.fyi` is `sarah`, `mark@frankle.fyi` is `mark`.
- The first screen on `/setup` offers both paths: "I'm a helper" (name and setup code) and "Host sign in" (email and password).
- Helpers can't change anything except whether a task is done. Enforce this in the database, not just the UI: tick and untick go through a `set_task_done(task_id, done)` security definer function, and task and section writes are host-only.
- A ticked task shows who ticked it ("done by Lotte").
- The helper group's display name is "Pain & Panic", kept in one constant so it's easy to change.

## Task fields

| Field | Values | Notes |
| --- | --- | --- |
| Text | up to 200 characters | |
| Note | optional free text | |
| Room | one section | Sections are rooms, plus shopping by store, plus "Saturday before doors". Stores show in the Shopping tab, not Rooms |
| Assignee | `sarah`, `mark`, `hosts` or none | `hosts` means Sarah or Mark (jobs not to hand to friends, like taking out the rubbish); none means anyone, helpers included |
| Priority | `must`, `should`, `nice` | Default `should` |
| Slot | one of the fixed slots below, or Anytime | Default Anytime |
| Blocked by | zero or more other tasks | A task is blocked while any of its blockers is open |
| Position | order within its room | |
| Done by, done at | who ticked it and when | |

### Time slots

A short fixed list in code, each with a real start and end in Europe/Amsterdam time, so the app can tell what's doable now.
Sarah thinks in rough slots, not exact times.

| Slot | Starts | Ends |
| --- | --- | --- |
| Anytime | — | — |
| Friday, shops open | Fri 30 Oct 09:00 | Fri 30 Oct 20:00 |
| Friday evening | Fri 30 Oct 17:00 | Fri 30 Oct 23:59 |
| Saturday, shops open | Sat 31 Oct 09:00 | Sat 31 Oct 18:00 |
| Saturday afternoon | Sat 31 Oct 12:00 | Sat 31 Oct 19:00 |
| Before doors | Sat 31 Oct 19:00 | Sat 31 Oct 20:00 |

The times are my call and live in one constant so they're easy to change.
Slots only need to be roughly right.

## Task states

Every open task is in exactly one state at a given moment:

- **Doable**: no open blockers, and its slot is Anytime or happening now.
- **Late**: no open blockers, and its slot has ended. Still doable, flagged in red as "late".
- **Blocked**: at least one blocker is still open. Shows "waiting on: tree pole up".
- **Not yet**: no open blockers, but its slot hasn't started. Shows the slot name, such as "Friday evening".

Done tasks are simply done.

## Next for me

A list, not a single task.
The top task is the best thing for this person to do right now.

**Whose tasks.** Sarah sees tasks assigned to her, to Sarah or Mark, and unassigned tasks; Mark the same from his side.
Only a task assigned to the viewer alone counts as only-mine.
Helpers see only unassigned tasks, which keeps their list short.

**Order.**

1. Only doable and late to-dos show. Blocked and not-yet tasks and shopping items stay out of Next (Sarah's call, 2026-10-29); Rooms shows them.
2. Sort by:
   1. priority (Must, then Should, then Nice to have),
   2. then **only-mine or unblocks-others** first: a task assigned to this person, or a task that blocks at least one open task someone else could do (assigned to someone else or unassigned),
   3. then late before on-time,
   4. then the slot ending soonest,
   5. then room order and position.

Ranking priority before only-mine/unblocks is my call: a Nice-to-have that only Sarah can do shouldn't beat a Must anyone can do.
It's easy to swap in the ranking function if it feels wrong on Friday.

**Done tasks** don't appear in Next.
Ticking a task there gives the 5-second undo, then it leaves the list, and anything it was blocking moves up on every phone.

The ranking is a pure function (tasks, blockers, person, now in, ordered list out) in `src/setup/`, with Vitest tests for each rule.

## Rooms

Every to-do, open and done, grouped by section in section order; shopping sections live in their own tab.
Within a section, Must comes before Should before Nice to have, then the hosts' own order; hosts reorder by dragging the ☰ handle on each row, and a task only moves among tasks of the same priority.
Open tasks show their state label (late, waiting on, slot), assignee and priority.
Done tasks stay in place, struck through, with "done by".

## Priority

The same to-dos grouped Must, Should, Nice to have, each group in room order, without shopping.
Same labels as Rooms.

## Shopping

The shopping sections, laid out like Rooms (open and done, by shop).
Shopping never shows in Next, but a shopping item can still block a to-do.

## Editing (Sarah and Mark only)

- Add, edit, delete tasks; delete has a 5-second undo.
- Add and rename sections; drag tasks to reorder them within a section (among tasks of the same priority), and move them to another section from the editor.
- Set assignee, priority, slot, note.
- Blockers: pick from a searchable list of tasks. Reject a blocker that would create a loop.
- Helpers never see edit controls.

## Navigation

Four tabs: **Next** (the default), **Rooms**, **Priority**, **Shopping**.
The person's name and a sign-out link sit in the header.
Mobile-first, using the existing theme tokens in `src/styles/theme.css`.

## Data and security

Changes to the tech spec's setup schema:

- `setup_items` gains `key text not null unique` (see [Editing the list with Claude](#editing-the-list-with-claude)), `assignee text check (assignee in ('sarah', 'mark', 'hosts'))`, `priority text not null default 'should' check (priority in ('must', 'should', 'nice'))` and `slot text` (a slot id from the constant, null meaning Anytime). The `owner` column goes.
- New `setup_blockers (item_id, blocked_by_id)` with both columns referencing `setup_items on delete cascade`, primary key on the pair, and a check that they differ.
- `setup_items`, `setup_sections` and `setup_blockers`: everyone in `is_setup_editor()` can read; only `is_host()` can insert, update and delete.
- `set_task_done(task_id uuid, done boolean)`: security definer, requires `is_setup_editor()`, sets or clears `done_by` and `done_at`.
- `done_by` references `setup_editors`, so hosts get a `setup_editors` row too. On host sign-in the app calls a host-only function that upserts their row with the name "Sarah" or "Mark" from their email. Hosts don't need the setup code.
- Realtime on `setup_sections`, `setup_items` and `setup_blockers`; refetch on `visibilitychange` and reconnect, as in the tech spec.

The database is empty today.
The setup page ships before the game, so `hosts` and `is_host()` move out of `schema.sql` into `supabase/hosts.sql`, run first.
Then `supabase/setup.sql`, then `supabase/seed_setup.sql`.
No `supabase/migrations/` folder: everything is pasted into the SQL editor by hand.

## Seed

`supabase/seed_setup.sql` is generated from the current [setup plan](../../setup-plan.md), with best-guess assignees, priorities, slots and blockers (for example "Mark:" items go to Mark, shopping goes in a shops-open slot, candles and mist makers go in Before doors, "Arch: attach the wisteria" is blocked by "Arch, step 3").
"Decide" items are seeded as Must tasks assigned to Sarah.
Sarah and Mark refine the content in the app or in a later session.

## Friday scope

Needed by Friday morning, in this order if time runs short:

1. Sign-in (helper and host), By room, ticking, live updates, the seed.
2. Next for me with the full ranking, and By priority.
3. Host editing of text, assignee, priority and slot; add and delete tasks.
4. Blocker editing, moving tasks between sections, and sections editing. Until then, blockers come from the seed only.

This order is my call: the seed carries the blockers, so editing them can come last.

## Testing

- Vitest on the ranking function: each state, each sort key, helpers seeing only unassigned tasks, a late task surfacing, ticking a blocker unblocking its dependents.
- RLS checks: without the code, every setup read and write fails; as a helper, inserting, updating or deleting tasks, sections and blockers fails, and `set_task_done` succeeds.
- On two phones: a tick on one shows on the other within a couple of seconds.

## Small calls (mine, settled after review)

- A tick is written straight away; undo unticks it. Nothing is lost if the phone locks mid-undo.
- Blocked tasks can still be ticked (someone may have done it anyway). The app doesn't stop them.
- Blocker loops are rejected by a database trigger, so the rule holds even outside the UI.
- Delete undo keeps the deleted task, blockers included, in memory and re-inserts both.
- "Now" is the device clock. Slots are rough, so a minute or two of drift doesn't matter.
- The seed refuses to run if `setup_items` already has rows, so it can't wipe Friday's ticks.

## Left to the builder

- Component structure, state management and styling details within the theme.
- How the blocker picker and the undo toast look.
- Exact slot times.

## Setup code

`pain-and-panic`, after Hades' two helpers.
The check ignores case, and treats spaces and hyphens the same, so "Pain and Panic" works too.
It's guessable for anyone who knows the film, which is fine here: a stranger would also need the link, and helpers can only tick.

## Editing the list with Claude

The Supabase MCP is read-only on purpose, so Claude never writes to the live list.
Before the seed runs, Claude edits `supabase/seed_setup.sql`.
After that, Claude reads the live list over MCP and writes a small SQL script that Sarah pastes into the SQL editor.

So those scripts can target tasks reliably, each task has a stable `key` (unique text, for example `arch-wisteria`), used in the seed and in later scripts for tasks and blockers alike.
Wording can change freely without breaking a script.
