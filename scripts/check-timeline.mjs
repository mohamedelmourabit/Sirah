// Run: npm run check:timeline — validates the master timeline (src/chrono): ids, order, groups, sources, certainty, review state, 4 languages.
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const out = join(mkdtempSync(join(tmpdir(), 'sira-tl-')), 'm.mjs')
await build({ stdin: { contents: "export * from './src/chrono/def.ts'; export { SAMPLE } from './src/data.ts'", resolveDir: process.cwd() }, bundle: true, format: 'esm', outfile: out, logLevel: 'silent' })
const { EVENTS, GROUPS, CATS, SAMPLE } = await import(out)
const byId = new Map(SAMPLE.map((e) => [e.id, e]))
const AR = /[؀-ۿ]/
const ids = EVENTS.map((x) => x.id)

assert.equal(new Set(ids).size, ids.length, 'duplicate event in the timeline')
for (const d of EVENTS) {
  const e = byId.get(d.id); assert.ok(e, `${d.id}: not an entity id`); assert.equal(e.kind, 'event', `${d.id}: not an event`)
  assert.ok(GROUPS.includes(d.group) && CATS.includes(d.cat) && ['established', 'disputed', 'uncertain'].includes(d.certainty), `${d.id}: bad group/category/certainty`)
  assert.ok(e.sources.length > 0, `${d.id}: no source references`)
  assert.ok(e.when && e.summary && e.bio, `${d.id}: missing date/summary/bio`)
  if (d.certainty !== 'established') assert.ok(e.disputed, `${d.id}: ${d.certainty} but no visible "reports differ" note`)
}
// every event entity is on the timeline (nothing left out), and the order agrees with the entities' own chronology
for (const e of SAMPLE) if (e.kind === 'event') assert.ok(ids.includes(e.id), `event ${e.id} is missing from the master timeline`)
for (let i = 1; i < EVENTS.length; i++) assert.ok(byId.get(EVENTS[i].id).y >= byId.get(EVENTS[i - 1].id).y, `order: ${EVENTS[i - 1].id} → ${EVENTS[i].id} goes back in time`)
// groups: 17, contiguous, none empty, in order
assert.equal(GROUPS.length, 17)
const seq = EVENTS.map((x) => GROUPS.indexOf(x.group)); assert.deepEqual(seq, [...seq].sort((a, b) => a - b), 'groups are not contiguous / in order')
for (const g of GROUPS) assert.ok(EVENTS.some((x) => x.group === g), `${g}: empty group`)
for (const c of CATS) assert.ok(EVENTS.some((x) => x.cat === c), `category ${c} unused`)
// the 17 periods requested
const wanted = { g1: ['elephant'], g2: ['birth'], g4: ['marriage'], g5: ['revelation'], g8: ['habasha_hijra'], g9: ['sorrow'], g10: ['isra'], g11: ['hijra'], g12: ['madina_state'], g13: ['badr', 'uhud', 'khandaq'], g14: ['hudaybiyyah'], g15: ['fath'], g16: ['farewell'], g17: ['death'] }
for (const [g, es] of Object.entries(wanted)) for (const id of es) assert.equal(EVENTS.find((x) => x.id === id).group, g, `${id} should be in ${g}`)

for (const l of ['ar', 'fr', 'en', 'es']) {
  const p = JSON.parse(readFileSync(`src/chrono/${l}.json`, 'utf8'))
  assert.deepEqual(Object.keys(p.groups).sort(), [...GROUPS].sort(), `${l}: groups`)
  for (const [g, x] of Object.entries(p.groups)) { for (const k of ['title', 'range', 'intro']) assert.ok(x[k]?.trim(), `${l}/${g}.${k} empty`); assert.equal(AR.test(x.title), l === 'ar', `${l}/${g}: wrong script`) }
  assert.equal(p.verification?.status, 'PENDING_REVIEW', `${l}: verification must be PENDING_REVIEW`)
  if (l === 'ar') assert.ok(!p.translation); else assert.equal(p.translation?.status, 'draft', `${l}: translation must stay draft`)
}
const cnt = (c) => EVENTS.filter((x) => x.certainty === c).length
console.log(`timeline OK: ${EVENTS.length} events in ${GROUPS.length} stages (${cnt('established')} established, ${cnt('disputed')} disputed, ${cnt('uncertain')} uncertain), 4 languages`)
