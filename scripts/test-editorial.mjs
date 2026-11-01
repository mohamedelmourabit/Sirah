// Run: npm run test:editorial — editorial rules (pure) + the SQL implementation in PGlite (in-process Postgres).
// NOT a live Supabase test: PostgREST, the auth service and the network are not exercised.
import assert from 'node:assert/strict'
import { test, before } from 'node:test'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { makeDb, as, USERS } from './admin-db.mjs'

let R, X, db
const U = Object.fromEntries(Object.entries(USERS).map(([k, v]) => [k, v[0]]))
const call = (who, fn, ...args) => as(db, U[who] ?? null, `select ${fn}(${args.map((_, i) => `$${i + 1}`).join(',')})`, args)
const row = async (id) => (await db.query('select * from editorial_records where record_id=$1', [id])).rows[0]
const SRC = JSON.stringify(['صحيح البخاري§كتاب الشروط'])

before(async () => {
  const out = join(mkdtempSync(join(tmpdir(), 'sira-ed-')), 'm.mjs')
  await build({ stdin: { contents: "export * as R from './src/editorial/rules.ts'; export * as X from './src/editorial/records.ts'; export * as S from './src/editorial/sources.ts'; export * as B from './src/editorial/backlog.ts'", resolveDir: process.cwd() }, bundle: true, format: 'esm', outfile: out, loader: { '.json': 'json' }, logLevel: 'silent' })
  const m = await import(out); R = m.R; X = { ...m.X, ...m.S, ...m.B }
  db = await makeDb()
})

const base = () => ({ ...X.buildRegistry().byId.get('entity:badr') })
const REVIEWER = { name: 'Dr R', role: 'reviewer' }, EDITOR = { name: 'Ed', role: 'editor' }
const act = (to, extra = {}, by = REVIEWER) => ({ to, by, at: '2026-05-01', ...extra })

test('defaults: every record PENDING_REVIEW, nothing verified, translations DRAFT, classification only where the data has one', () => {
  const { records } = X.buildRegistry()
  assert.equal(records.length, 53 + 17 + 2 + 76)
  assert.ok(records.every((r) => r.review === 'PENDING_REVIEW' && !r.reviewer && !r.reviewedSources.length))
  assert.ok(records.every((r) => ['fr', 'en', 'es'].every((l) => r.translations[l] === 'DRAFT')))
  assert.equal(records.filter((r) => r.type === 'entity' && r.subtype === 'event').every((r) => r.classification), true)
  assert.equal(records.filter((r) => r.type === 'entity' && r.subtype !== 'event').every((r) => r.classification === null), true) // never guessed
})

test('ESTABLISHED never becomes VERIFIED by itself; PENDING_REVIEW cannot jump to VERIFIED', () => {
  const r = base(); assert.equal(r.classification, 'ESTABLISHED'); assert.equal(r.review, 'PENDING_REVIEW')
  assert.throws(() => R.applyReview(r, act('VERIFIED', { reviewedSources: r.sourceIds, notes: 'n' })), /not allowed/)
  const inRev = R.applyReview(r, act('IN_REVIEW', {}, EDITOR))
  assert.equal(inRev.classification, 'ESTABLISHED'); assert.equal(inRev.review, 'IN_REVIEW')
})

test('VERIFIED requires reviewer identity+role, date, reviewed sources (belonging to the record) and notes', () => {
  const r = R.applyReview(base(), act('IN_REVIEW', {}, EDITOR))
  assert.throws(() => R.applyReview(r, act('VERIFIED', { notes: 'n' })), /reviewed source/)
  assert.throws(() => R.applyReview(r, act('VERIFIED', { reviewedSources: r.sourceIds })), /notes/)
  assert.throws(() => R.applyReview(r, act('VERIFIED', { reviewedSources: ['x§y'], notes: 'n' })), /sources of this record/)
  assert.throws(() => R.applyReview(r, act('VERIFIED', { reviewedSources: r.sourceIds, notes: 'n' }, EDITOR)), /only a reviewer/)
  const v = R.applyReview(r, act('VERIFIED', { reviewedSources: [r.sourceIds[0]], notes: 'Checked against the edition.' }))
  assert.deepEqual(R.verifiedProblems(v), []); assert.equal(v.reviewer.name, 'Dr R'); assert.equal(v.reviewedAt, '2026-05-01')
  assert.equal(R.applyReview(v, act('NEEDS_REVISION', { notes: 'Date differs.' })).reviewer, undefined) // leaving VERIFIED clears the verification data
})

test('independence: a historical review never changes translations, and translations never change the review', () => {
  const r = R.applyReview(R.applyReview(base(), act('IN_REVIEW', {}, EDITOR)), act('VERIFIED', { reviewedSources: [base().sourceIds[0]], notes: 'ok' }))
  assert.deepEqual(r.translations, { fr: 'DRAFT', en: 'DRAFT', es: 'DRAFT' }) // Arabic verified ≠ translation approved
  const tr = { ...base(), translations: { fr: 'APPROVED', en: 'DRAFT', es: 'DRAFT' } }
  assert.equal(tr.review, 'PENDING_REVIEW'); assert.notEqual(tr.review, 'VERIFIED') // approved translation ≠ verified history
  assert.equal(R.transStatus('reviewed'), 'APPROVED'); assert.equal(R.transStatus('submitted'), 'IN_REVIEW'); assert.equal(R.transStatus('rejected'), 'DRAFT'); assert.equal(R.transStatus('draft'), 'DRAFT')
})

test('returning for revision and reclassifying need notes and a reviewer', () => {
  const r = R.applyReview(base(), act('IN_REVIEW', {}, EDITOR))
  assert.throws(() => R.applyReview(r, act('NEEDS_REVISION')), /notes/)
  assert.throws(() => R.applyReview(r, act('IN_REVIEW', { classification: 'DISPUTED' })), /notes/)
  assert.equal(R.applyReview(r, act('IN_REVIEW', { classification: 'DISPUTED', notes: 'Sources differ.' })).classification, 'DISPUTED')
})

test('sources: existing chapter-level references stay and are marked incomplete; nothing is invented', () => {
  const { sources } = X.buildRegistry()
  const all = [...sources.values()]
  assert.ok(all.length >= 116)
  assert.ok(all.every((s) => !s.page && !s.hadithNo && !s.volume && !s.edition && !s.publisher && !s.url && !s.passage), 'a field was filled in without a source')
  assert.ok(all.filter((s) => s.kind !== 'quran').every((s) => s.completeness === 'incomplete' && s.chapter === s.locator))
  const q = sources.get('القرآن الكريم§سورة الإسراء: 1'); assert.equal(q.verse, '1'); assert.equal(q.completeness, 'complete')
  assert.equal(sources.get('القرآن الكريم§سورة الفيل').completeness, 'incomplete')
  assert.ok(all.every((s) => s.supports.length > 0))
  assert.equal(R.completeness({ kind: 'hadith', edition: 'E', hadithNo: '1' }), 'complete'); assert.equal(R.completeness({ kind: 'hadith', hadithNo: '1' }), 'incomplete')
})

test('backlog: Qaynuqāʿ, al-Naḍīr and Qurayẓa are listed with NO historical detail', () => {
  const ids = X.BACKLOG.map((b) => b.id); for (const i of ['banu_qaynuqa', 'banu_nadir', 'banu_qurayza']) assert.ok(ids.includes(i))
  assert.ok(X.BACKLOG.every((b) => b.status === 'BACKLOG' && b.sources.length === 0 && !/\d{3}/.test(b.rationale)))
  const reg = X.buildRegistry(); assert.ok(X.BACKLOG.every((b) => !reg.byId.has(`entity:${b.id}`)))
})

test('bundled reviews.json can only hold valid decisions (currently empty)', () => {
  const o = JSON.parse(readFileSync('src/editorial/reviews.json', 'utf8'))
  for (const [id, v] of Object.entries(o)) { const r = { ...X.buildRegistry().byId.get(id), ...v }; assert.deepEqual(R.verifiedProblems(r), [], id) }
})

// ------------------------- database -------------------------
test('DB: schema constraint rejects a VERIFIED row without reviewer, date, sources or notes', async () => {
  const ins = (cols) => db.exec(`insert into editorial_records (record_id, record_type, review_status ${cols[0]}) values ('entity:x${Math.random()}','entity','VERIFIED' ${cols[1]})`)
  await assert.rejects(() => ins(['', '']), /editorial_verified_needs_review_data/)
  await assert.rejects(() => ins([", reviewed_by, reviewer_role, reviewed_at, reviewed_sources", ", 'a','reviewer',now(),'[]'"]), /editorial_verified_needs_review_data/)
  await assert.rejects(() => ins([", reviewed_by, reviewer_role, reviewed_at, reviewed_sources, review_notes", ", 'a','reviewer',now(),'[\"s\"]','  '"]), /editorial_verified_needs_review_data/)
})

test('DB: workflow — editor starts review; only a reviewer verifies; no PENDING→VERIFIED shortcut; name+date are server-set', async () => {
  const id = 'entity:badr'
  await assert.rejects(call('rev1', 'set_editorial_review', id, 'entity', 'VERIFIED', null, SRC, 'n'), /not an allowed/) // from PENDING
  await assert.rejects(call(null, 'set_editorial_review', id, 'entity', 'IN_REVIEW'), /not authorized|permission/i)
  await assert.rejects(call('outsider', 'set_editorial_review', id, 'entity', 'IN_REVIEW'), /not authorized/)
  await call('editor', 'set_editorial_review', id, 'entity', 'IN_REVIEW')
  assert.equal((await row(id)).review_status, 'IN_REVIEW')
  await assert.rejects(call('editor', 'set_editorial_review', id, 'entity', 'VERIFIED', null, SRC, 'n'), /not authorized/)
  await assert.rejects(call('rev1', 'set_editorial_review', id, 'entity', 'VERIFIED', null, '[]', 'n'), /source/)
  await assert.rejects(call('rev1', 'set_editorial_review', id, 'entity', 'VERIFIED', null, SRC, ' '), /notes/)
  await call('rev1', 'set_editorial_review', id, 'entity', 'VERIFIED', null, SRC, 'Checked against the edition.')
  const r = await row(id)
  assert.equal(r.review_status, 'VERIFIED'); assert.equal(r.reviewed_by, 'Reda Reviewer'); assert.equal(r.reviewer_role, 'reviewer'); assert.ok(r.reviewed_at); assert.deepEqual(r.reviewed_sources, ['صحيح البخاري§كتاب الشروط'])
  assert.equal(r.classification, null) // verifying does not set or change the classification
})

test('DB: returning for revision needs notes and clears the verification data; reclassification needs a reviewer + notes', async () => {
  const id = 'entity:badr'
  await assert.rejects(call('rev1', 'set_editorial_review', id, 'entity', 'NEEDS_REVISION'), /notes/)
  await call('rev1', 'set_editorial_review', id, 'entity', 'NEEDS_REVISION', null, '[]', 'Casualty figures need a second source.')
  const r = await row(id); assert.equal(r.review_status, 'NEEDS_REVISION'); assert.equal(r.reviewed_by, null); assert.equal(r.reviewed_at, null); assert.deepEqual(r.reviewed_sources, [])
  await call('editor', 'set_editorial_review', id, 'entity', 'IN_REVIEW')
  await assert.rejects(call('editor', 'set_editorial_review', id, 'entity', 'IN_REVIEW', 'DISPUTED', '[]', 'x'), /not authorized/)
  await assert.rejects(call('rev1', 'set_editorial_review', id, 'entity', 'IN_REVIEW', 'DISPUTED'), /notes/)
})

test('DB: translation status and historical review are independent (both directions)', async () => {
  const before = (await db.query("select translation_status from entity_translations where entity_id='uhud' and lang='fr'")).rows[0].translation_status
  await call('editor', 'set_editorial_review', 'entity:uhud', 'entity', 'IN_REVIEW')
  await call('rev1', 'set_editorial_review', 'entity:uhud', 'entity', 'VERIFIED', null, SRC, 'ok')
  assert.equal((await db.query("select translation_status from entity_translations where entity_id='uhud' and lang='fr'")).rows[0].translation_status, before) // Arabic verified, French untouched
  assert.ok(!(await as(db, null, "select 1 from entity_translations where entity_id='uhud'")).rows.length) // still hidden from the public
  await call('rev2', 'save_translation', 'uhud', 'fr', JSON.stringify({ name: 'Uhud', summary: 's', bio: 'b' })); await call('rev2', 'submit_translation', 'uhud', 'fr'); await call('rev1', 'review_translation', 'uhud', 'fr', 'approve', null)
  assert.equal((await row('entity:uhud')).review_status, 'VERIFIED') // approving a translation changes nothing about history
  await call('rev2', 'save_translation', 'uhud', 'fr', JSON.stringify({ name: 'Uhud (edited)', summary: 's', bio: 'b' }))
  assert.equal((await row('entity:uhud')).review_status, 'VERIFIED') // editing a translation does not un-verify the Arabic record
})

test('DB: log + RLS — history is recorded; log is staff-only; nobody writes the tables directly; review status is public', async () => {
  const log = (await as(db, U.editor, "select action, from_status, to_status, actor_name, notes from editorial_log where record_id='entity:badr' order by id")).rows
  assert.deepEqual(log.map((l) => l.to_status), ['IN_REVIEW', 'VERIFIED', 'NEEDS_REVISION', 'IN_REVIEW'])
  assert.ok(log.some((l) => l.actor_name === 'Reda Reviewer' && /edition/.test(l.notes)))
  await call('editor', 'add_editorial_note', 'entity:badr', 'Second source suggested: see Ṭabarī.'); await assert.rejects(call('editor', 'add_editorial_note', 'entity:badr', ' '), /empty/)
  for (const who of [null, 'outsider']) assert.equal((await as(db, U[who] ?? null, 'select * from editorial_log')).rows.length, 0)
  assert.ok((await as(db, null, 'select * from editorial_records')).rows.length >= 2)
  for (const who of [null, 'editor', 'rev1']) {
    const r = await as(db, U[who] ?? null, "update editorial_records set review_status='VERIFIED' returning 1").catch(() => ({ rows: [] })); assert.equal(r.rows.length, 0, String(who))
    await assert.rejects(as(db, U[who] ?? null, "insert into editorial_records (record_id, record_type) values ('entity:evil','entity')"), /row-level|permission/i)
    assert.equal((await as(db, U[who] ?? null, 'delete from editorial_log returning 1').catch(() => ({ rows: [] }))).rows.length, 0)
  }
})
