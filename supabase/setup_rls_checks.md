# Setup RLS checks

Run these after pasting `hosts.sql`, `setup.sql` and `seed_setup.sql`, from the browser console on `npm run dev` at `/setup` (dev builds expose `window.__setup`).
The same rules were checked against a local Postgres (PGlite) before shipping; this is the check against the real project.

`const { supabase } = window.__setup`

**With no session** (private window, before joining):

- `await supabase.from('setup_items').select()` returns an empty list.

**As a helper** (joined with the code):

- `await supabase.from('setup_items').select()` returns every task.
- `await supabase.rpc('set_task_done', { p_task: '<an item id>', p_done: true })` succeeds.
- `await supabase.from('setup_items').insert({ key: 'x', section_id: '<a section id>', text: 'x', position: 99 })` fails with "violates row-level security policy".
- `await supabase.from('setup_items').update({ text: 'hacked' }).eq('id', '<an item id>').select()` returns an empty list, and the text is unchanged.
- `await supabase.from('setup_items').delete().eq('id', '<an item id>').select()` returns an empty list.
- `await supabase.from('setup_blockers').insert({ item_id: '<id>', blocked_by_id: '<id>' })` fails with "violates row-level security policy".
- `await supabase.rpc('claim_host_editor')` fails with "not host".
- `await supabase.from('setup_secret').select()` returns an empty list.

**Joining:**

- `await supabase.rpc('join_setup', { p_code: 'wrong', p_name: 'X' })` returns `false`.
- `await supabase.rpc('join_setup', { p_code: 'Pain and Panic', p_name: 'X' })` returns `true`.
