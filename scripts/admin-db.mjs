// In-process Postgres (PGlite) loaded with supabase/schema.sql + seed, plus Supabase-like roles and four test users.
// Shared by test-admin.mjs and the browser test. NOT a live Supabase project.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { buildSeed } from './seed-lib.mjs'

export const USERS = {
  editor: ['aaaaaaaa-0000-0000-0000-000000000001', 'editor', 'Edith Editor'],
  rev1: ['aaaaaaaa-0000-0000-0000-000000000002', 'reviewer', 'Reda Reviewer'],
  rev2: ['aaaaaaaa-0000-0000-0000-000000000003', 'reviewer', 'Rana Reviewer'],
  outsider: ['aaaaaaaa-0000-0000-0000-000000000004', null, null], // signed-up account without a reviewers row
}

export async function makeDb() {
  const db = new PGlite({ extensions: { pg_trgm } })
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`)
  await db.exec(readFileSync('supabase/schema.sql', 'utf8'))
  await db.exec('grant select, insert, update, delete on all tables in schema public to anon, authenticated') // Supabase default; RLS restricts
  await db.exec(await buildSeed())
  for (const [id, role, name] of Object.values(USERS)) {
    await db.exec(`insert into auth.users values ('${id}')`)
    if (role) await db.exec(`insert into reviewers values ('${id}','${role}','${name}')`)
  }
  return db
}

/** Run a query as `anon` (uid null) or as an authenticated user, the way PostgREST does. */
export async function as(db, uid, sql, params) {
  await db.exec(`select set_config('request.jwt.claim.sub','${uid ?? ''}',false); set role ${uid ? 'authenticated' : 'anon'}`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}
