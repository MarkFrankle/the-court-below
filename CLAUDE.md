# The Court Below

Web app for Sarah and Mark's Halloween party, Saturday 31 October 2026, 20:00–02:00, about 15 guests.
Live at <https://thecourtbelow.netlify.app>.

## Read first

The docs are the source of truth. Read the relevant one before changing anything:

- `docs/game-plan.md`: The Trial of the Shades, arrival form, three rounds, every on-screen line.
- `docs/tech-spec.md`: architecture, schema and RLS, game phases, scoring, `/setup` page, deploy, test checklist.
- `docs/setup-plan.md`: room checklists, shopping list, Saturday countdown. Seed content for `/setup`.

If code and docs disagree, ask which one is right, then update the docs.

## Priorities

1. `/setup` first: it's needed for setup on Friday 30 October.
2. Then the game, with a working rehearsal on Friday evening (friends come over to decorate; no fixed time).

Mark may take over building the app or the game from the spec, so keep the docs current and the code easy to pick up.

## Stack

- Vite 7 + React 19 + TypeScript, no router library: `src/main.tsx` routes by `location.pathname` (`/`, `/tv`, `/host`, `/setup`).
  Vite 8 crashes npm 10.8.2 on install (`Cannot read properties of null (reading 'edgesOut')`), so stay on Vite 7.
- Netlify builds from `main` via `netlify.toml` (Node 22, SPA redirect). Every push to `main` deploys.
- Supabase (project "TheCourtBelow", org "Frankle", free tier): anonymous auth for guests and setup helpers, email + password host user, Postgres + RLS, Realtime `postgres_changes`, Storage bucket `portraits`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local` locally and in Netlify's environment variables.

## Rules

- The anon key is public, so RLS is the security boundary. Confessions, Round 2 answers and votes stay readable only by the writer and the host. Run the RLS checks in the spec's test checklist after any schema change.
- Mobile-first. Guests use phones only twice: arrival, and the 23:00 Trial.
- Look: dark and elegant. Tokens live in `src/styles/theme.css` (ink, plum, gold); Cormorant Garamond for display, Inter for body.
- On-screen copy comes from the game plan, not invented.
- `public/halloween-2026.jpeg` is the invitation art (Hades and Persephone's court), available for the Hall of Shades or the welcome screen.

## Decided

- Late guests after 23:00 get a quick form (name and portrait only); they vote from the next round and aren't guessed, writers or judged. Spec: `shades.late`.
- Obol totals stay hidden until the finale.
- The Netlify site is `thecourtbelow`.
- No migrations: SQL lives in `supabase/*.sql` as the spec lays out, and gets pasted into the Supabase SQL editor by hand. Never create `supabase/migrations/`; the Supabase GitHub integration would apply it to production on push.
- The host account is a user in the Supabase project (Authentication → Users), separate from Sarah's GitHub-based dashboard login.

## Open

- Before `/setup` works: turn on anonymous sign-ins in Supabase, create the host user, pick the setup code (several words, not a PIN), add the env vars locally and in Netlify.
- Host account email.
- Mark's GitHub and Supabase access, if he takes over.
- The unreadable "M:" under Drinks in `docs/sketches/menu-and-todo.jpg`: ask Mark.

## Conventions

- Markdown and code comments break at sentences, not at a fixed width.
- Commits: `type: message`, with the co-author line as a second `-m`.
