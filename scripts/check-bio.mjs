// Run: npm run check:bio — validates every biography in src/bio/<id>/: structure, ids, sources, certainty, review state, 4 languages.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const dir = mkdtempSync(join(tmpdir(), 'sira-bio-'))
const out = join(dir, 'm.mjs')
await build({ stdin: { contents: "export { BIOS } from './src/bio/index.ts'; export { SAMPLE } from './src/data.ts'", resolveDir: process.cwd() }, bundle: true, format: 'esm', outfile: out, loader: { '.json': 'json' }, logLevel: 'silent' })
const { BIOS, SAMPLE } = await import(out)
const ids = new Set(SAMPLE.map((e) => e.id))
const LANGS = ['ar', 'fr', 'en', 'es'], CERT = ['established', 'disputed', 'uncertain'], PERIODS = ['pre', 'mecca', 'hijra', 'medina']
const AR = /[؀-ۿ]/
let n = 0
const J = (p) => JSON.parse(readFileSync(p, 'utf8'))
const same = (a, b, msg) => assert.deepEqual([...a].sort(), [...b].sort(), msg)

for (const [id, { def }] of Object.entries(BIOS)) {
  const ent = SAMPLE.find((e) => e.id === id)
  assert.ok(ent, `${id}: not an entity id`)
  assert.equal(def.id, id)
  const links = new Set([...(def.sections.flatMap((s) => [...(s.links ?? []), ...s.claims.flatMap((c) => c.links ?? [])])), ...def.journey.map((j) => j.entity).filter(Boolean), def.neighbors?.prev, def.neighbors?.next].filter(Boolean))
  for (const l of links) assert.ok(ids.has(l), `${id}: link to unknown entity "${l}"`)
  for (const p of def.periods) assert.ok(PERIODS.includes(p), `${id}: bad period ${p}`)
  const claims = def.sections.flatMap((s) => s.claims)
  assert.equal(new Set(claims.map((c) => c.id)).size, claims.length, `${id}: duplicate claim ids`)
  for (const c of [...claims, ...def.facts, ...def.journey]) assert.ok(CERT.includes(c.certainty), `${id}: ${c.id} certainty`)
  for (const c of [...claims, ...def.facts]) for (const s of c.src) assert.ok(def.sources[s], `${id}: ${c.id} cites unknown source ${s}`)
  assert.ok(claims.some((c) => c.certainty === 'disputed') && claims.some((c) => c.certainty === 'uncertain') && claims.some((c) => c.certainty === 'established'), `${id}: certainty labels not used`)
  // the entity's original sources stay represented
  const titles = new Set(Object.values(def.sources).map((s) => s[0]))
  for (const [t] of ent.sources) assert.ok(titles.has(t), `${id}: original source "${t}" not carried over`)

  for (const l of LANGS) {
    const f = `src/bio/${id}/${l}.json`; assert.ok(existsSync(f), `missing ${f}`)
    const p = J(f)
    same(Object.keys(p.claims), claims.map((c) => c.id), `${f}: claims`)
    same(Object.keys(p.sections), def.sections.map((s) => s.id), `${f}: sections`)
    same(Object.keys(p.facts), def.facts.map((x) => x.id), `${f}: facts`)
    same(Object.keys(p.journey), def.journey.map((x) => x.id), `${f}: journey`)
    for (const t of [p.title, p.subtitle, ...Object.values(p.claims), ...Object.values(p.sections), ...Object.values(p.facts).flatMap((x) => [x.label, x.value]), ...Object.values(p.journey).flatMap((x) => [x.label, x.when])]) assert.ok(t && t.trim(), `${f}: empty text`)
    for (const t of Object.values(p.claims)) assert.equal(AR.test(t), l === 'ar', `${f}: wrong script in a claim: ${t.slice(0, 40)}`)
    // review state: never auto-approved; PENDING_REVIEW unless a named reviewer + date exist
    const v = p.verification ?? {}; assert.ok(['VERIFIED', 'DISPUTED', 'UNCERTAIN', 'PENDING_REVIEW'].includes(v.status), `${f}: verification`)
    if (v.status !== 'PENDING_REVIEW') assert.ok(v.reviewed_by && v.reviewed_at, `${f}: ${v.status} needs reviewer + date`)
    if (l === 'ar') assert.ok(!p.translation, `${f}: the Arabic original has no translation status`)
    else { assert.ok(['draft', 'reviewed'].includes(p.translation?.status), `${f}: translation.status`); if (p.translation.status === 'reviewed') assert.ok(p.translation.reviewed_by && p.translation.reviewed_at, `${f}: reviewed needs reviewer + date`) }
    if (l !== 'ar') for (const [title, loc] of Object.values(def.sources)) { assert.ok(p.books[title], `${f}: no translation of book "${title}"`); assert.ok(p.refs[loc], `${f}: no translation of locator "${loc}"`) }
  }
  console.log(`${id}: ${claims.length} claims (${CERT.map((c) => `${claims.filter((x) => x.certainty === c).length} ${c}`).join(', ')}), ${Object.keys(def.sources).length} sources, ${links.size} linked entities, 4 languages OK`)
  n++
}
console.log(`bio OK (${n} biography)`)
