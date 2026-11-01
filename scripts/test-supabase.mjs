// Run: npm run test:db
// Tests supabase/schema.sql + seed in an in-process Postgres (PGlite): constraints, Row Level Security,
// bundled-vs-DB consistency, and the app's merge logic on rows read as `anon`.
// NOT a test against a live Supabase project (PostgREST, auth service, network) — that needs a configured project.
import assert from 'node:assert/strict'
import { test, before } from 'node:test'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { buildSeed, loadSample } from './seed-lib.mjs'

const db = new PGlite({ extensions: { pg_trgm } })
const as = async (role, sql, params) => { await db.exec(`set role ${role}`); try { return await db.query(sql, params) } finally { await db.exec('reset role') } }
const fails = async (role, sql, re = /row-level security|violates|permission denied/i) => { await assert.rejects(() => as(role, sql), re) }
const J = (l) => JSON.parse(readFileSync(`src/locales/content/${l}.json`, 'utf8'))
let sample, content

before(async () => {
  // minimal stand-ins for what Supabase provides: roles, auth.uid(), default grants
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`)
  await db.exec(readFileSync('supabase/schema.sql', 'utf8'))
  await db.exec('grant select, insert, update, delete on all tables in schema public to anon, authenticated') // Supabase default; RLS is what restricts
  await db.exec(await buildSeed())
  sample = await loadSample()
  const out = join(mkdtempSync(join(tmpdir(), 'sira-')), 'content.mjs')
  await build({ entryPoints: ['src/content.ts'], bundle: true, format: 'esm', outfile: out, loader: { '.json': 'json' }, logLevel: 'silent' })
  content = await import(out)
})

test('schema and seed load; counts match the bundled content', async () => {
  const n = async (t) => Number((await db.query(`select count(*)::int c from ${t}`)).rows[0].c)
  assert.equal(await n('entities'), sample.length)
  assert.equal(await n('entity_translations'), sample.length * 3)
  assert.equal(await n('entity_verification'), sample.length * 4)
})

test('DB entities == bundled Arabic entities (all columns, relations, sources)', async () => {
  const { rows } = await db.query('select * from entities order by id')
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const e of sample) {
    const r = byId.get(e.id); assert.ok(r, `missing ${e.id}`)
    for (const k of ['kind', 'name', 'period', 'when', 'summary', 'bio', 'context', 'kw']) assert.equal(r[k] ?? undefined, e[k] ?? undefined, `${e.id}.${k}`)
    assert.equal(Number(r.y), e.y); assert.equal(r.disputed ?? undefined, e.disputed)
    assert.deepEqual(r.sources, e.sources, `${e.id}.sources`); assert.deepEqual(r.rel, e.rel, `${e.id}.rel`)
  }
  for (const e of sample) for (const rel of e.rel) assert.ok(byId.has(rel), `${e.id} relates to unknown ${rel}`) // map edges resolvable
})

test('DB translations == bundled translations, all seeded as draft + PENDING_REVIEW', async () => {
  for (const l of ['fr', 'en', 'es']) {
    const c = J(l)
    const { rows } = await db.query('select * from entity_translations where lang=$1', [l])
    assert.equal(rows.length, sample.length)
    for (const r of rows) {
      assert.equal(r.translation_status, 'draft'); assert.equal(r.translation_reviewed_by, null)
      for (const k of ['name', 'when', 'summary', 'bio', 'context']) assert.equal(r.fields[k], c.entities[r.entity_id][k], `${l}/${r.entity_id}.${k}`)
    }
  }
  const { rows } = await db.query("select count(*)::int c from entity_verification where status <> 'PENDING_REVIEW'")
  assert.equal(rows[0].c, 0)
})

test('RLS: anon cannot read draft translations; everything else public is readable', async () => {
  assert.equal((await as('anon', 'select * from entity_translations')).rows.length, 0)
  assert.equal((await as('authenticated', 'select * from entity_translations')).rows.length, 0)
  assert.equal((await as('anon', 'select * from entities')).rows.length, sample.length)
  assert.equal((await as('anon', 'select * from entity_verification')).rows.length, sample.length * 4)
})

test('constraints: no reviewed translation / non-pending verification without reviewer + date', async () => {
  await assert.rejects(() => db.exec("update entity_translations set translation_status='reviewed' where entity_id='badr' and lang='fr'"), /translation_reviewed_needs_reviewer/)
  for (const s of ['VERIFIED', 'DISPUTED', 'UNCERTAIN'])
    await assert.rejects(() => db.exec(`update entity_verification set status='${s}' where entity_id='badr' and lang='fr'`), /verification_needs_reviewer/)
  await assert.rejects(() => db.exec("update entity_verification set status='verified' where entity_id='badr' and lang='fr'"), /check/i) // wrong case
  await assert.rejects(() => db.exec("insert into entity_translations (entity_id,lang) values ('badr','ar')"), /check/i) // ar is the source, not a translation
})

test('RLS: anon/authenticated cannot write content, approve translations or verify claims', async () => {
  for (const role of ['anon', 'authenticated']) {
    await fails(role, "insert into entity_translations (entity_id,lang,fields) values ('badr','fr','{}') on conflict do nothing")
    await fails(role, "insert into entity_verification (entity_id,lang,status,reviewed_by,reviewed_at) values ('x','fr','VERIFIED','me',now())")
    await fails(role, "insert into entities (id,kind,name,period) values ('evil','event','x','pre')")
    for (const sql of ["update entity_translations set translation_status='reviewed', translation_reviewed_by='me', translation_reviewed_at=now()", "update entity_verification set status='VERIFIED', reviewed_by='me', reviewed_at=now()", "update entities set name='hacked'", 'delete from entities', 'delete from entity_verification'])
      assert.equal((await as(role, sql + ' returning 1')).rows.length, 0, `${role}: ${sql}`) // no matching writable rows
  }
  assert.equal((await db.query("select count(*)::int c from entity_translations where translation_status='reviewed'")).rows[0].c, 0)
  assert.equal((await db.query("select count(*)::int c from entities where name='hacked'")).rows[0].c, 0)
})

test('RLS: progress is private per user', async () => {
  const [u1, u2] = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']
  await db.exec(`insert into auth.users values ('${u1}'),('${u2}')`)
  await fails('anon', "insert into progress (entity_id) values ('badr')") // no session
  await db.exec(`select set_config('request.jwt.claim.sub','${u1}',false)`)
  await as('authenticated', "insert into progress (entity_id) values ('badr')")
  await fails('authenticated', `insert into progress (user_id, entity_id) values ('${u2}','uhud')`) // cannot write as someone else
  assert.equal((await as('authenticated', 'select * from progress')).rows.length, 1)
  await db.exec(`select set_config('request.jwt.claim.sub','${u2}',false)`)
  assert.equal((await as('authenticated', 'select * from progress')).rows.length, 0)
  await db.exec("select set_config('request.jwt.claim.sub','',false)")
  assert.equal((await as('anon', 'select * from progress')).rows.length, 0)
})

test('reviewer promotes rows (service role) -> anon sees only those; app merge logic displays them correctly', async () => {
  // as a reviewer with the service role (superuser here, bypasses RLS):
  await db.exec(`update entity_translations set translation_status='reviewed', translation_reviewed_by='Reviewer A', translation_reviewed_at='2026-03-01' where entity_id='badr' and lang='fr'`)
  await db.exec(`update entity_translations set fields = jsonb_set(fields,'{name}','"Bataille de Badr (relue)"') where entity_id='badr' and lang='fr'`)
  await db.exec(`update entity_verification set status='DISPUTED', reviewed_by='Historian B', reviewed_at='2026-03-02', note='x', refs='[{"title":"t","ref":"r"}]' where entity_id='birth' and lang='ar'`)
  await db.exec(`update entity_verification set status='VERIFIED', reviewed_by='Historian B', reviewed_at='2026-03-02', refs='[{"title":"t","ref":"r"}]' where entity_id='badr' and lang='ar'`)

  const tr = (await as('anon', "select * from entity_translations where lang='fr' and translation_status='reviewed'")).rows
  assert.deepEqual(tr.map((r) => r.entity_id), ['badr']) // exactly the approved one
  const verAr = (await as('anon', "select * from entity_verification where lang='ar'")).rows
  const iso = (d) => (d instanceof Date ? d.toISOString() : d)
  const fix = (r) => ({ ...r, translation_reviewed_at: iso(r.translation_reviewed_at), reviewed_at: iso(r.reviewed_at) })

  // same calls loadPack() makes, then the same merge + localize the UI uses
  const frLocal = J('fr')
  const fr = content.mergeRemote(frLocal, tr.map(fix), [])
  const ar = content.mergeRemote(content.arPack, [], verAr.map(fix))
  const all = content.localize(sample, ar, fr, false)
  const badr = all.find((e) => e.id === 'badr'), uhud = all.find((e) => e.id === 'uhud'), birth = all.find((e) => e.id === 'birth')
  assert.equal(badr.tr, 'approved'); assert.equal(badr.name, 'Bataille de Badr (relue)'); assert.equal(badr.trReview.by, 'Reviewer A')
  assert.equal(badr.verification.status, 'PENDING_REVIEW') // translation approved != history verified (fr record untouched)
  assert.equal(uhud.tr, 'pending'); assert.equal(uhud.name, sample.find((e) => e.id === 'uhud').name) // Arabic fallback, not a draft
  assert.equal(birth.verification.status, 'DISPUTED') // Arabic original's record shown while its French translation is pending
  // with the toggle on, un-promoted entities show as drafts from the bundle
  assert.equal(content.localize(sample, ar, fr, true).find((e) => e.id === 'uhud').tr, 'draft')
  // DB unavailable / empty -> bundled content only
  assert.equal(content.mergeRemote(frLocal, [], []).entities.badr.translation.status, 'draft')
})
