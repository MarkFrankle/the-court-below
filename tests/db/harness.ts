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
