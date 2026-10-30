# Game RLS checks

Run these after pasting `schema.sql`, from the browser console on `npm run dev` at `/` (dev builds expose `window.__game`).
`tests/db/rls.test.ts` checks the same rules against a local Postgres (PGlite) on every `npm test`; this is the check against the real project.

`const { supabase } = window.__game`

Use two browsers (or a normal and a private window), each signed in anonymously by opening `/`, with a shade created in each. Call them A and B. `<A id>` is A's `(await supabase.auth.getUser()).data.user.id`.

**As guest B, in the lobby:**

- `await supabase.from('confessions').select()` returns only B's own row.
- `await supabase.from('shades').insert({ id: '<A id>', name: 'X' })` fails with "violates row-level security policy".
- `await supabase.from('shades').update({ hidden: true, realm: 'elysium', test: true }).eq('id', '<B id>').select()` returns B's row with `hidden: false`, `realm: null`, `test: false`.
- `await supabase.rpc('set_phase', { p: 'intro', s: 0 })` fails with "not host".
- `await supabase.from('game').update({ phase: 'intro' }).eq('id', 1).select()` returns an empty list.
- `await supabase.from('votes').insert({ round: 1, item: 0, choice: '<A id>' })` fails with "violates row-level security policy" (no vote is open).
- `await supabase.from('r1_authors').select()` returns an empty list.
- `await supabase.rpc('reset_game')` fails with "not host".
- `await supabase.storage.from('portraits').upload('<A id>.jpg', new Blob(['x']))` fails.

**After the host moves to `r1_vote`:**

- As A, `await supabase.from('votes').upsert({ round: 1, item: 0, choice: '<B id>' })` succeeds.
- As B, `await supabase.from('votes').select()` doesn't include A's vote, and `await supabase.rpc('vote_count', { r: 1, i: 0 })` returns `1`.
- As B, `await supabase.from('confessions').update({ sin: 'x' }).eq('shade_id', '<B id>').select()` returns an empty list (confessions are locked after the lobby).

Finish with Reset game on the remote.
