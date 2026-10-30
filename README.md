# Halloween at the Court Below

Plans for Hades and Persephone's Halloween party, **Saturday 31 October 2026, 20:00–02:00**: the party games, the web app that runs them, and the setup checklists.

**Status:** `/setup` is live at <https://thecourtbelow.netlify.app/setup>. The game (`/`, `/tv`, `/host`) is built on the `game` branch, waiting for `supabase/schema.sql` to be pasted into the live project.

## Docs

| Doc | What's in it |
| --- | --- |
| [Game plan](docs/game-plan.md) | The Trial of the Shades: arrival flow, the three rounds with all on-screen copy, Persephone's Seeds, run of show |
| [Technical spec](docs/tech-spec.md) | Netlify + Supabase architecture, routes, game phases, schema and RLS, realtime, scoring, deploy steps, the `/setup` page |
| [Setup plan](docs/setup-plan.md) | Friday plan, checklists by room, shopping list, layout sketches, Saturday countdown |

## At a glance

- **Guests:** about 15, mostly new to Greek mythology, so nothing in the games needs prior knowledge.
- **Phones out twice:** a 2-minute "create your shade" form on arrival, then a 30-minute game on the TV at 23:00.
- **The Trial of the Shades:** three rounds (Whose Sin Is It?, Petitions to Hades, The Judgment), hosted by Hades and Persephone.
- **Stack:** Vite + React + TypeScript on Netlify; Supabase for anonymous auth, Postgres with RLS, Realtime and portrait storage.
- **TV:** a laptop casts `/tv` to the Chromecast; music plays on a separate speaker.
- **Setup page:** `/setup` turns the setup plan into a live, shared checklist for the hosts and helpers. It ships first.

## Who does what

Sarah and Mark host as Hades and Persephone.

- **Sarah:** games, tech, decor.
- **Mark:** cocktails and drinks.

## Develop

Needs Node 20.19 or newer

```bash
npm install
cp .env.example .env.local   # fill in the Supabase project URL and anon key
npm run dev
```

`npm test` runs the unit and RLS tests. `npm run test:local` plays a whole game against a local Supabase; see [agent_docs/local-supabase.md](agent_docs/local-supabase.md).

Every push to `main` deploys to Netlify. Start with the [technical spec](docs/tech-spec.md); copy and game content come from the [game plan](docs/game-plan.md).
