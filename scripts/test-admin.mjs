// Run: npm run test:admin
// Editorial workflow, roles and RLS for the dashboard, against supabase/schema.sql in PGlite (in-process Postgres).
// NOT a live Supabase test (no PostgREST / GoTrue / network).
import assert from 'node:assert/strict'
import { test, before } from 'node:test'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { makeDb, as, USERS } from './admin-db.mjs'

let db
const U = Object.fromEntries(Object.entries(USERS).map(([k, v]) => [k, v[0]]))
const call = (who, fn, ...args) => as(db, U[who] ?? null, `select ${fn}(${args.map((_, i) => `$${i + 1}`).join(',')})`, args)
const rejects = (p, re) => assert.rejects(p, re)
const row = async (q, ...a) => (await db.query(q, a)).rows[0]
const F = (o = {}) => JSON.stringify({ name: 'Bataille de Badr', when: '2 AH', summary: 's', bio: 'b', context: 'c', ...o })
const REF = JSON.stringify([{ title: 'Sahih al-Bukhari', ref: 'Book of Maghazi' }])
const tr = (e = 'badr', l = 'fr') => row('select * from entity_translations where entity_id=$1 and lang=$2', e, l)
const ver = (e = 'badr', l = 'fr') => row('select * from entity_verification where entity_id=$1 and lang=$2', e, l)

let N
before(async () => { db = await makeDb(); N = Number((await db.query('select count(*)::int c from entities')).rows[0].c) })

test('access: anon and signed-in non-reviewers can neither call the editorial functions nor read staff data', async () => {
  for (const who of [null, 'outsider']) {
    await rejects(call(who, 'save_translation', 'badr', 'fr', F()), /not authorized|permission denied/i)
    await rejects(call(who, 'review_translation', 'badr', 'fr', 'approve', null), /not authorized|permission denied/i)
    await rejects(call(who, 'set_verification', 'badr', 'fr', 'VERIFIED', REF, null), /not authorized|permission denied/i)
    assert.equal((await as(db, U[who] ?? null, 'select * from entity_translations')).rows.length, 0) // drafts hidden
    assert.equal((await as(db, U[who] ?? null, 'select * from review_log')).rows.length, 0)
    assert.equal((await as(db, U[who] ?? null, 'select * from reviewers')).rows.length, 0)
  }
})

test('roles: an editor can save/submit but cannot approve, reject or verify; staff can read drafts + log', async () => {
  await call('editor', 'save_translation', 'badr', 'fr', F({ name: 'Bataille de Badr (v2)' }))
  assert.equal((await tr()).translation_status, 'draft')
  assert.equal((await tr()).last_edited_by, U.editor)
  await call('editor', 'submit_translation', 'badr', 'fr')
  assert.equal((await tr()).translation_status, 'submitted')
  await rejects(call('editor', 'review_translation', 'badr', 'fr', 'approve', null), /not authorized/)
  await rejects(call('editor', 'set_verification', 'badr', 'fr', 'VERIFIED', REF, null), /not authorized/)
  assert.equal((await as(db, U.editor, 'select * from entity_translations')).rows.length, N * 3) // staff see drafts
  assert.ok((await as(db, U.editor, 'select * from review_log')).rows.length >= 2)
  assert.equal((await as(db, U.editor, 'select * from reviewers')).rows.length, 1) // only own row
})

test('four-eyes: neither the editor nor the submitter can approve; a different reviewer can; name+date are server-set', async () => {
  // rev1 edits and submits -> rev1 cannot approve own work
  await call('rev1', 'save_translation', 'uhud', 'fr', F({ name: 'Uhud' }))
  await call('rev1', 'submit_translation', 'uhud', 'fr')
  await rejects(call('rev1', 'review_translation', 'uhud', 'fr', 'approve', null), /different reviewer/)
  // badr: editor edited, editor submitted -> rev1 approves
  await rejects(call('editor', 'review_translation', 'badr', 'fr', 'approve', null), /not authorized/)
  await call('rev1', 'review_translation', 'badr', 'fr', 'approve', 'Checked against the Arabic.')
  const t = await tr()
  assert.equal(t.translation_status, 'reviewed'); assert.equal(t.translation_reviewed_by, 'Reda Reviewer'); assert.ok(t.translation_reviewed_at)
  assert.equal((await ver()).status, 'PENDING_REVIEW') // approving a translation never touches history
  // public sees exactly the approved row
  assert.deepEqual((await as(db, null, "select entity_id from entity_translations")).rows.map((r) => r.entity_id), ['badr'])
  // a second reviewer can approve rev1's work
  await call('rev2', 'review_translation', 'uhud', 'fr', 'approve', null)
  assert.equal((await tr('uhud')).translation_reviewed_by, 'Rana Reviewer')
})

test('state machine: only a submitted translation can be reviewed; reject needs a note and stays hidden; re-edit returns to draft', async () => {
  await rejects(call('rev2', 'review_translation', 'hira', 'en', 'approve', null), /submitted/) // seeded draft, never auto-approved
  await call('editor', 'submit_translation', 'hira', 'en')
  await rejects(call('rev1', 'review_translation', 'hira', 'en', 'reject', '  '), /note/)
  await call('rev1', 'review_translation', 'hira', 'en', 'reject', 'Transliteration of the cave name is wrong.')
  assert.equal((await tr('hira', 'en')).translation_status, 'rejected')
  assert.ok(!(await as(db, null, "select 1 from entity_translations where entity_id='hira'")).rows.length)
  await rejects(call('rev2', 'review_translation', 'hira', 'en', 'approve', null), /submitted/) // rejected cannot be approved directly
  // editing an approved translation withdraws the approval immediately
  await call('rev2', 'save_translation', 'badr', 'fr', F({ name: 'Badr (edited after approval)' }))
  const t = await tr()
  assert.equal(t.translation_status, 'draft'); assert.equal(t.translation_reviewed_by, null); assert.equal(t.translation_reviewed_at, null)
  assert.ok(!(await as(db, null, "select 1 from entity_translations where entity_id='badr'")).rows.length)
})

test('historical verification: needs reference (+ note for DISPUTED/UNCERTAIN); reviewer-only; independent of translation status', async () => {
  await rejects(call('rev1', 'set_verification', 'badr', 'ar', 'VERIFIED', '[]', null), /reference/)
  await rejects(call('rev1', 'set_verification', 'badr', 'ar', 'VERIFIED', '[{"title":" ","ref":"x"}]', null), /reference/)
  await rejects(call('rev1', 'set_verification', 'badr', 'ar', 'DISPUTED', REF, null), /explain/)
  await rejects(call('rev1', 'set_verification', 'badr', 'ar', 'MAYBE', REF, null), /invalid status/)
  const before = (await tr('uhud')).translation_status // 'reviewed' from the previous test
  await call('rev1', 'set_verification', 'uhud', 'fr', 'DISPUTED', REF, 'Sources differ on the number of casualties.')
  const v = await ver('uhud')
  assert.equal(v.status, 'DISPUTED'); assert.equal(v.reviewed_by, 'Reda Reviewer'); assert.ok(v.reviewed_at); assert.deepEqual(v.refs, [{ title: 'Sahih al-Bukhari', ref: 'Book of Maghazi' }])
  assert.equal((await tr('uhud')).translation_status, before) // verification never changes translation review
  await call('rev1', 'set_verification', 'uhud', 'fr', 'PENDING_REVIEW', '[]', null) // can be reset; reviewer data cleared
  const p = await ver('uhud'); assert.equal(p.status, 'PENDING_REVIEW'); assert.equal(p.reviewed_by, null); assert.equal(p.reviewed_at, null)
  assert.equal((await ver('uhud', 'ar')).status, 'PENDING_REVIEW') // other languages untouched
  // public may read verification, with its references
  const pub = await as(db, null, "select status, refs from entity_verification where entity_id='uhud' and lang='fr'")
  assert.equal(pub.rows.length, 1)
})

test('log: revision history and reviewer notes are recorded, append-only, staff-only', async () => {
  await call('editor', 'add_review_note', 'badr', 'fr', 'translation', 'Please check the date format.')
  await rejects(call('editor', 'add_review_note', 'badr', 'fr', 'translation', ' '), /empty/)
  const log = (await as(db, U.editor, "select action, note, actor_name, fields from review_log where entity_id='badr' and lang='fr' and track='translation' order by id")).rows
  assert.ok(log.some((l) => l.action === 'save' && l.fields?.name === 'Bataille de Badr (v2)')) // snapshot kept
  assert.ok(log.some((l) => l.action === 'approve' && l.actor_name === 'Reda Reviewer' && l.note === 'Checked against the Arabic.'))
  assert.ok(log.some((l) => l.action === 'note' && l.actor_name === 'Edith Editor'))
  for (const who of ['editor', 'rev1']) {
    assert.equal((await as(db, U[who], "update review_log set note='x' returning 1")).rows.length, 0)
    assert.equal((await as(db, U[who], 'delete from review_log returning 1')).rows.length, 0)
  }
})

test('RLS: no client (editor, reviewer, anon) can write tables directly; fields are validated', async () => {
  for (const who of [null, 'editor', 'rev1']) {
    for (const sql of ["update entity_translations set translation_status='reviewed', translation_reviewed_by='me', translation_reviewed_at=now() returning 1", "update entity_verification set status='VERIFIED' returning 1", 'delete from entity_translations returning 1', "update reviewers set role='reviewer' returning 1"]) {
      const r = await as(db, U[who] ?? null, sql).catch(() => ({ rows: [] }))
      assert.equal(r.rows.length, 0, `${who}: ${sql}`)
    }
    await rejects(as(db, U[who] ?? null, "insert into entity_verification (entity_id,lang,status,reviewed_by,reviewed_at,refs) values ('x','fr','VERIFIED','me',now(),'[1]')"), /row-level|violates|permission/i)
    await rejects(as(db, U[who] ?? null, "insert into reviewers values (gen_random_uuid(),'reviewer','Eve')"), /row-level|violates|permission/i)
  }
  await rejects(call('editor', 'save_translation', 'badr', 'fr', JSON.stringify({ name: 'x', translation_status: 'reviewed' })), /invalid fields/)
  await rejects(call('editor', 'save_translation', 'badr', 'fr', JSON.stringify({ name: ' ' })), /name/)
  await rejects(call('editor', 'save_translation', 'badr', 'ar', F()), /check/i) // Arabic is the source, not a translation
  assert.equal(Number((await row("select count(*)::int c from entity_translations where translation_status='reviewed'")).c), 1) // only uhud (badr was edited)
})

test('public data path unchanged: anon reads entities, verification (4 per entity), and only reviewed translations', async () => {
  assert.equal((await as(db, null, 'select * from entities')).rows.length, N)
  assert.equal((await as(db, null, 'select * from entity_verification')).rows.length, N * 4)
  assert.ok((await as(db, null, 'select * from entity_translations')).rows.every((r) => r.translation_status === 'reviewed'))
})

test('no service-role key or secret in frontend source or build output', () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
  const files = [...walk('src'), 'admin.html', 'index.html', '.env.example', ...(existsSync('dist') ? walk('dist') : [])].filter((f) => existsSync(f))
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    assert.ok(!/service[_-]?role/i.test(s), `${f} mentions the service role`)
    assert.ok(!/VITE_[A-Z_]*SERVICE/i.test(s), `${f}`)
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}\.eyJ/.test(s), `${f} contains a JWT`)
  }
})
