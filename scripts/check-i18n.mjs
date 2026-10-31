// Run: npm run check:i18n  — fails on missing keys/ids or on a "reviewed" entry without a named reviewer.
import { readFileSync } from 'node:fs'
const J = (p) => JSON.parse(readFileSync(new URL(`../src/locales/${p}.json`, import.meta.url), 'utf8'))
const data = readFileSync(new URL('../src/data.ts', import.meta.url), 'utf8')
const blocks = data.split("E({ id: '").slice(1)
const ids = blocks.map((b) => b.split("'")[0])
const refs = new Set(blocks.flatMap((b) => [...(b.match(/src: \[(.*?)\],\s*rel:/s)?.[1].matchAll(/, '([^']*)'\]/g) ?? [])].map((m) => m[1])))
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]))
const strip = (k) => k.replace(/_(one|other|zero|two|few|many)$/, '')
let bad = 0
const err = (m) => { bad++; console.error('✗', m) }

const ar = new Set(flat(J('ar')).map(strip))
const VS = ['VERIFIED', 'DISPUTED', 'UNCERTAIN', 'PENDING_REVIEW']
const checkVerification = (l, i, v) => {
  if (!v) return err(`${l}/${i}: missing verification (defaults to PENDING_REVIEW at runtime, but add it explicitly)`)
  if (!VS.includes(v.status)) err(`${l}/${i}: verification.status must be one of ${VS.join('|')}`)
  if (v.status !== 'PENDING_REVIEW' && !(v.reviewed_by && v.reviewed_at)) err(`${l}/${i}: ${v.status} needs reviewed_by + reviewed_at`)
  if (v.status === 'VERIFIED' && !blocks.find((b) => b.startsWith(i + "'"))?.includes('src: [[')) err(`${l}/${i}: VERIFIED but the entity has no sources`)
}
// Arabic original: only the historical verification track
const arc = J('content/ar')
ids.filter((i) => !arc.entities[i]).forEach((i) => err(`ar: no verification entry for ${i}`))
for (const [i, e] of Object.entries(arc.entities)) { if (!ids.includes(i)) err(`ar: unknown id ${i}`); checkVerification('ar', i, e.verification) }
for (const l of ['fr', 'en', 'es']) {
  const ui = new Set(flat(J(l)).map(strip))
  ;[...ar].filter((k) => !ui.has(k)).forEach((k) => err(`${l}.json missing UI key ${k}`))
  const c = J(`content/${l}`)
  ids.filter((i) => !c.entities[i]).forEach((i) => err(`${l}: no translation entry for ${i}`))
  Object.keys(c.entities).filter((i) => !ids.includes(i)).forEach((i) => err(`${l}: unknown id ${i}`))
  for (const [i, e] of Object.entries(c.entities)) {
    for (const f of ['name', 'when', 'summary', 'bio', 'context']) if (!e[f]?.trim()) err(`${l}/${i}: empty ${f}`)
    const t = e.translation
    if (!t || !['draft', 'reviewed'].includes(t.status)) err(`${l}/${i}: translation.status must be draft|reviewed`)
    else if (t.status === 'reviewed' && !(t.reviewed_by && t.reviewed_at)) err(`${l}/${i}: reviewed translation needs reviewed_by + reviewed_at`)
    checkVerification(l, i, e.verification)
  }
  refs.forEach((r) => c.refs[r] || err(`${l}: no translation for source ref "${r}"`))
  const n = Object.values(c.entities)
  console.log(`${l}: translation reviewed ${n.filter((e) => e.translation?.status === 'reviewed').length}/draft ${n.filter((e) => e.translation?.status === 'draft').length}; verification: ${VS.map((v) => v + ' ' + n.filter((e) => e.verification?.status === v).length).join(', ')}`)
}
console.log(bad ? `${bad} problem(s)` : 'i18n OK')
process.exit(bad ? 1 : 0)
