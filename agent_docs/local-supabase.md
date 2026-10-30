# Local Supabase

A full Supabase stack (auth, Postgres, Realtime, Storage) in Docker, for testing the game without touching the live project.

## Keep it outside this repo

Run `supabase init` in a folder outside the repo, never here.
It creates `supabase/config.toml` and invites a `supabase/migrations/` folder, and the Supabase GitHub integration applies migrations to production on push (see CLAUDE.md).

## Start it

Needs Docker Desktop running. The first start downloads a few GB of images.

```bash
mkdir -p ~/court-below-localsb && cd ~/court-below-localsb
npx supabase@2.122.0 init --yes
# in supabase/config.toml: enable_anonymous_sign_ins = true, and anonymous_users = 1000 under [auth.rate_limit]
npx supabase@2.122.0 start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
npx supabase@2.122.0 status -o env > status.env
```

Then load the SQL from this repo, in the same order as the live project:

```bash
docker exec -i supabase_db_<project_id> psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/hosts.sql
docker exec -i supabase_db_<project_id> psql -v ON_ERROR_STOP=1 -U postgres -d postgres < supabase/schema.sql
```

`<project_id>` is the folder name, as written in `config.toml`.

## Run the end-to-end test

`tests/local/game.e2e.ts` plays the game through the app's own api and engine: guests on separate connections, test shades, the remote's Next, votes, reveals and obols.
It refuses to run against anything but `127.0.0.1` or `localhost`.

```bash
set -a; . ~/court-below-localsb/status.env; set +a
VITE_SUPABASE_URL=$API_URL VITE_SUPABASE_ANON_KEY=$PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY npm run test:local
```

It creates the host user `host@local.test` (password `host-password-local`), which also works for signing in to `/host` locally.
It ends by leaving the game mid-way; Reset game on `/host` clears it.

## Use it from phones

Point `.env.local` at the laptop's LAN address instead of `127.0.0.1` (for example `VITE_SUPABASE_URL=http://192.168.178.44:54321`, with the local `PUBLISHABLE_KEY`), and run `npm run dev -- --host`.
Phones on the same Wi-Fi open `http://<LAN address>:5173/`.
That's plain http, so browser APIs limited to secure contexts (such as `crypto.randomUUID()`) don't exist there; use `uuid()` from `src/lib/random.ts`.

## Gotcha: Realtime's two "subscribed" moments

`channel.subscribe()` reports `SUBSCRIBED` before database changes start flowing.
A separate `system` message (`extension: 'postgres_changes', status: 'ok'`) follows a moment later, and a change in that gap is never delivered.
`useGame` refetches at both. The e2e test waits for the `system` message before changing anything.
`src/setup/useSetupData.ts` only refetches at `SUBSCRIBED`; its 30-second refetch covers the gap.
