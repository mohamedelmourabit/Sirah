// Run: npm test — unit tests for translation/verification rules (no browser, no network).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const out = join(mkdtempSync(join(tmpdir(), 'sira-')), 'content.mjs')
await build({ entryPoints: ['src/content.ts'], bundle: true, format: 'esm', outfile: out, loader: { '.json': 'json' }, logLevel: 'silent' })
const { verificationOf, translationApproved, localize, mergeRemote, arPack } = await import(out)
const J = (l) => JSON.parse(readFileSync(`src/locales/content/${l}.json`, 'utf8'))

const E = (id) => ({ id, name: 'ع' + id, when: 'w', summary: 's', bio: 'b', context: 'c', sources: [['صحيح البخاري', 'كتاب بدء الوحي']], rel: [], disputed: 'ملاحظة' })
const R = { by: 'Dr. X', at: '2026-01-01' }
const reviewer = { reviewed_by: R.by, reviewed_at: R.at }
const pack = (over = {}) => ({
  books: { 'صحيح البخاري': 'Sahih al-Bukhari' }, refs: { 'كتاب بدء الوحي': 'Book of the Beginning of Revelation' },
  entities: { a: { name: 'A', when: 'W', summary: 'S', bio: 'B', context: 'C', translation: { status: 'draft' }, ...over } },
})

test('verification defaults to PENDING_REVIEW, never auto-VERIFIED', () => {
  assert.equal(verificationOf(undefined).status, 'PENDING_REVIEW')
  assert.equal(verificationOf({}).status, 'PENDING_REVIEW')
  assert.equal(verificationOf({ status: 'verified' }).status, 'PENDING_REVIEW') // wrong case
  assert.equal(verificationOf({ status: 'VERIFIED' }).status, 'PENDING_REVIEW') // no reviewer
  assert.equal(verificationOf({ status: 'VERIFIED', reviewed_by: 'x' }).status, 'PENDING_REVIEW') // no date
  for (const s of ['DISPUTED', 'UNCERTAIN']) assert.equal(verificationOf({ status: s }).status, 'PENDING_REVIEW')
  for (const s of ['VERIFIED', 'DISPUTED', 'UNCERTAIN']) assert.equal(verificationOf({ status: s, ...reviewer }).status, s)
})

test('translation approval needs status reviewed + named reviewer + date', () => {
  assert.equal(translationApproved(undefined), false)
  assert.equal(translationApproved({ status: 'draft', ...reviewer }), false)
  assert.equal(translationApproved({ status: 'reviewed' }), false)
  assert.equal(translationApproved({ status: 'reviewed', ...reviewer }), true)
})

test('localize: Arabic UI keeps the original; pending/draft/approved are distinct', () => {
  const all = [E('a')]
  assert.equal(localize(all, null, null)[0].tr, 'original')
  const pend = localize(all, null, pack())[0] // draft, drafts hidden
  assert.equal(pend.tr, 'pending'); assert.equal(pend.name, 'عa') // Arabic, not the translation
  const dr = localize(all, null, pack(), true)[0]
  assert.equal(dr.tr, 'draft'); assert.equal(dr.name, 'A'); assert.deepEqual(dr.sources[0], ['Sahih al-Bukhari', 'Book of the Beginning of Revelation'])
  const bad = localize(all, null, pack({ translation: { status: 'reviewed' } }))[0] // "reviewed" without reviewer
  assert.equal(bad.tr, 'pending')
  const ok = localize(all, null, pack({ translation: { status: 'reviewed', ...reviewer } }))[0]
  assert.equal(ok.tr, 'approved'); assert.equal(ok.name, 'A'); assert.deepEqual(ok.trReview, R)
  assert.equal(localize(all, null, { books: {}, refs: {}, entities: {} })[0].tr, 'pending') // no entry at all
})

test('translation review and historical verification are independent', () => {
  const all = [E('a')]
  // translation approved, history still pending
  const a = localize(all, null, pack({ translation: { status: 'reviewed', ...reviewer } }))[0]
  assert.equal(a.tr, 'approved'); assert.equal(a.verification.status, 'PENDING_REVIEW')
  // draft translation, history verified for that language
  const b = localize(all, null, pack({ verification: { status: 'VERIFIED', ...reviewer } }), true)[0]
  assert.equal(b.tr, 'draft'); assert.equal(b.verification.status, 'VERIFIED')
  // Arabic shown (pending translation): verification comes from the Arabic record, not the French one
  const arP = { books: {}, refs: {}, entities: { a: { verification: { status: 'DISPUTED', ...reviewer } } } }
  const c = localize(all, arP, pack({ verification: { status: 'VERIFIED', ...reviewer } }))[0]
  assert.equal(c.tr, 'pending'); assert.equal(c.verification.status, 'DISPUTED')
})

test('mergeRemote filters unapproved rows and applies verification rows', () => {
  const rows = [
    { entity_id: 'a', fields: { name: 'DB-A' }, translation_status: 'draft' },
    { entity_id: 'a', fields: { name: 'DB-A' }, translation_status: 'reviewed' }, // no reviewer
    { entity_id: 'b', fields: { name: 'DB-B' }, translation_status: 'reviewed', translation_reviewed_by: 'R', translation_reviewed_at: '2026-02-02' },
  ]
  const m = mergeRemote(pack(), rows, [{ entity_id: 'a', status: 'VERIFIED' }, { entity_id: 'b', status: 'DISPUTED', reviewed_by: 'R', reviewed_at: '2026-02-02' }])
  assert.equal(m.entities.a.name, 'A') // bundled kept, unapproved DB rows ignored
  assert.equal(m.entities.b.name, 'DB-B'); assert.equal(m.entities.b.translation.status, 'reviewed')
  const l = localize([E('a'), E('b')], null, m)
  assert.equal(l[0].verification.status, 'PENDING_REVIEW') // VERIFIED row without reviewer demoted
  assert.equal(l[1].verification.status, 'DISPUTED')
  assert.equal(mergeRemote(pack(), [], []).entities.a.name, 'A') // empty DB -> bundled fallback
})

test('bundled content never ships auto-approved or auto-verified', () => {
  for (const l of ['ar', 'fr', 'en', 'es']) {
    for (const [id, e] of Object.entries(J(l).entities)) {
      if (l !== 'ar') assert.equal(translationApproved(e.translation), false, `${l}/${id} translation approved without review`)
      const v = verificationOf(e.verification)
      assert.ok(v.status === 'PENDING_REVIEW' || (v.reviewed_by && v.reviewed_at), `${l}/${id} verification`)
    }
  }
  assert.equal(Object.keys(arPack.entities).length, 40)
})
