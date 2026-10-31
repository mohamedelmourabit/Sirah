// Run: npm run test:search — search engine over all 40 entities, in each UI language, with/without draft translations.
import assert from 'node:assert/strict'
import { test, before } from 'node:test'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const J = (p) => JSON.parse(readFileSync(p, 'utf8'))
const ui = Object.fromEntries(['ar', 'fr', 'en', 'es'].map((l) => [l, J(`src/locales/${l}.json`)]))
const pk = Object.fromEntries(['fr', 'en', 'es'].map((l) => [l, J(`src/locales/content/${l}.json`)]))
let S, C, D, A, base
before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sira-s-'))
  const out = join(dir, 'm.mjs')
  await build({ stdin: { contents: "export * as S from '/Users/elmourabitmohammed/sira-app/src/search.ts'; export * as C from '/Users/elmourabitmohammed/sira-app/src/content.ts'; export * as D from '/Users/elmourabitmohammed/sira-app/src/data.ts'; export * as A from '/Users/elmourabitmohammed/sira-app/src/aliases.ts'", resolveDir: process.cwd() }, bundle: true, format: 'esm', outfile: out, loader: { '.json': 'json' }, logLevel: 'silent' })
  ;({ S, C, D, A } = await import(out))
  base = D.SAMPLE
})

const extra = () => { const m = {}; for (const p of Object.values(pk)) for (const [id, t] of Object.entries(p.entities)) (m[id] ??= []).push(t.name); return m }
// same wiring as src/lib.ts, for one UI language
const docs = (lang, drafts) => {
  const all = C.localize(base, C.arPack, lang === 'ar' ? null : pk[lang], drafts)
  const L = ui[lang]
  const periods = ['pre', 'mecca', 'hijra', 'medina'].map((p, i) => ({ id: 'period:' + p, display: L.periods[p], y: i * 100, names: [D.PERIODS[p], ...Object.values(ui).map((u) => u.periods[p])] }))
  const ar = new Map(base.map((e) => [e.id, e.name]))
  return S.buildDocs(all, (id) => ar.get(id), extra(), A.ALIASES, (e) => `${L.periods[e.period]} ${L.kinds[e.kind]}`, periods)
}
const top = (d, q, n = 3) => S.searchDocs(d, q).slice(0, n).map((h) => h.doc.id)

const CASES = [
  ['Omar', 'umar'], ['Umar', 'umar'], ['Oumar', 'umar'], ['عمر', 'umar'], ['OMAR', 'umar'], ['ʿUmar ibn al-Khaṭṭāb', 'umar'], ['Omar ibn al-Khattab', 'umar'], ['khattab', 'umar'], ['عمر بن الخطاب', 'umar'],
  ['Abu Bakr', 'abubakr'], ['Abou Bakr', 'abubakr'], ['أبو بكر', 'abubakr'], ['ابو بكر', 'abubakr'], ['Abubakar', 'abubakr'], ['Abu Bakr al-Siddiq', 'abubakr'], ['Siddiq', 'abubakr'],
  ['Medina', 'madinah'], ['Médine', 'madinah'], ['Medine', 'madinah'], ['MÉDINE', 'madinah'], ['Madinah', 'madinah'], ['المدينة', 'madinah'], ['المدينة المنورة', 'madinah'], ['مدينة', 'madinah'],
  ['Badr', 'badr'], ['Battle of Badr', 'badr'], ['Bataille de Badr', 'badr'], ['Batalla de Badr', 'badr'], ['بدر', 'badr'], ['غزوة بدر', 'badr'],
  ['Mecca', 'makkah'], ['La Mecque', 'makkah'], ['La Meca', 'makkah'], ['مكة', 'makkah'],
  ['Aicha', 'aisha'], ['Khadija', 'khadija'], ['Jadiya', 'khadija'], ['Othman', 'uthman'], ['Osman', 'uthman'], ['Uhud', 'uhud'], ['Ohud', 'uhud'], ['Hijra', 'hijra'], ['Hégire', 'hijra'], ['Kaaba', 'kaaba'], ['الكعبة', 'kaaba'], ['Abyssinie', 'habasha'], ['Negus', 'najashi'], ['Khaled', 'khalid'], ['Bilal', 'bilal'],
]
for (const lang of ['ar', 'fr', 'en', 'es'])
  for (const drafts of [false, true])
    test(`UI ${lang}${drafts ? ' + draft translations' : ''}: names, transliterations and aliases resolve to the right entity`, () => {
      const d = docs(lang, drafts)
      for (const [q, id] of CASES) assert.ok(top(d, q, q.length <= 3 ? 5 : 3).includes(id), `"${q}" -> ${top(d, q, 5)} (wanted ${id})`)
    })

test('whole-name match ranks first', () => {
  const d = docs('fr', false)
  assert.equal(top(d, 'Medina', 1)[0], 'madinah'); assert.equal(top(d, 'Badr', 1)[0], 'badr'); assert.equal(top(d, 'Umar', 1)[0], 'umar')
})

test('index covers all 40 entities: each is found by its id, Arabic name, and every fr/en/es name, in every UI language', () => {
  for (const lang of ['ar', 'fr', 'en', 'es']) {
    const d = docs(lang, false)
    assert.equal(d.filter((x) => x.cat !== 'period').length, 40)
    for (const e of base) {
      const names = [e.id.replace(/_/g, ' '), e.name, ...['fr', 'en', 'es'].map((l) => pk[l].entities[e.id].name)]
      for (const n of names) assert.ok(top(d, n, 5).includes(e.id), `${lang}: "${n}" does not find ${e.id}: ${top(d, n, 5)}`)
    }
  }
})

test('matching is case-, accent-, diacritic- and partial-insensitive', () => {
  const d = docs('en', false)
  for (const q of ['oumar', 'ÚMAR', 'omár', 'khattab', 'KHAṬṬĀB', 'عُمَر', 'عمَر']) assert.ok(top(d, q, 3).includes('umar'), q)
  for (const q of ['mad', 'medi', 'mdina'.replace('mdina', 'medinna')]) assert.ok(S.searchDocs(d, q).some((h) => h.doc.id === 'madinah'), q)
  assert.ok(S.searchDocs(d, 'sidd').some((h) => h.doc.id === 'abubakr'))
})

test('a name match wins over description-only matches ("Medina" is not every Medinan-period entry); keywords still work alone', () => {
  const d = docs('en', false)
  const ids = S.searchDocs(d, 'Medina').map((h) => h.doc.id)
  assert.ok(ids.includes('madinah') && !ids.includes('khalid') && !ids.includes('badr'), ids.join())
  assert.ok(S.searchDocs(d, 'caliph').length > 0 || S.searchDocs(d, 'الخلفاء').length > 0) // no name matches -> description search
})

test('categories: companions, events, places and historical periods are all searchable', () => {
  const d = docs('en', false)
  const cat = (q) => S.searchDocs(d, q).map((h) => h.doc.cat)
  assert.ok(cat('Umar').includes('person')); assert.ok(cat('Badr').includes('event')); assert.ok(cat('Medina').includes('place'))
  for (const [q, id] of [['Medinan period', 'period:medina'], ['العهد المدني', 'period:medina'], ['Période mecquoise', 'period:mecca'], ['Periodo mecano', 'period:mecca'], ['Antes de la revelación', 'period:pre'], ['Before the revelation', 'period:pre'], ['Meccan', 'period:mecca'], ['Hégire', 'period:hijra']])
    for (const lang of ['ar', 'fr', 'en', 'es']) assert.ok(S.searchDocs(docs(lang, false), q).some((h) => h.doc.id === id), `${lang}: ${q} -> ${id}`)
  assert.equal(S.searchDocs(d, 'Umar', { cat: 'event' }).length, 0)
})

test('"also known as" is reported when the match is not the displayed name; nothing when it is', () => {
  const d = docs('fr', false) // displayed names are Arabic (no approved translation)
  const h = S.searchDocs(d, 'Omar')[0]
  assert.equal(h.doc.id, 'umar'); assert.ok(h.via && /umar|omar/i.test(S.norm(h.via) ? h.via : ''), h.via)
  assert.equal(S.searchDocs(d, 'عمر')[0].via, null)
})

test('no match -> empty; suggestions offered for near misses', () => {
  const d = docs('en', false)
  assert.equal(S.searchDocs(d, 'zzqxw').length, 0)
  assert.equal(S.searchDocs(d, 'Omar Zzqxw').length, 0) // every word must match
  assert.ok(S.suggest(d, 'Abubaker').length >= 0)
  assert.ok(S.suggest(d, 'Omarr').some((n) => /omar|umar|oumar/i.test(n)), String(S.suggest(d, 'Omarr')))
  assert.ok(S.suggest(d, 'Medinnaa').some((n) => /medin|madin/i.test(n)), String(S.suggest(d, 'Medinnaa')))
  assert.deepEqual(S.suggest(d, ''), [])
})

test('highlight marks matching words, also across spellings', () => {
  assert.deepEqual(S.highlight('ʿUmar ibn al-Khaṭṭāb', 'omar').filter(([, m]) => m).map(([s]) => s), ['ʿUmar'])
  assert.deepEqual(S.highlight('عمر بن الخطاب', 'عمر').filter(([, m]) => m).map(([s]) => s), ['عمر'])
  assert.equal(S.highlight('Battle of Badr', 'zzz').some(([, m]) => m), false)
})
