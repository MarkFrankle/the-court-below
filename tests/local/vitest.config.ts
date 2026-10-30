import { defineConfig } from 'vitest/config'

// End-to-end run against a local Supabase (the CLI's `supabase start`), never the live project.
// Not part of `npm test`. Needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from `supabase status`.
export default defineConfig({
  test: {
    include: ['tests/local/**/*.e2e.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
})
