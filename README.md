# Halloween at the Court Below

Plans for Hades and Persephone's Halloween party, **Saturday 31 October 2026, 20:00–02:00**: the party games, the web app that runs them, and the setup checklists.

**Status:** planning only. No app code yet.

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
