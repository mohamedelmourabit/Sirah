// Pure search engine (no DOM / i18n imports, so it is unit-tested in node).
// Every entity is indexed under ALL its names (Arabic, fr, en, es, aliases, id) — whatever language is displayed.

export type Cat = 'person' | 'event' | 'place' | 'period'
export interface Doc {
  id: string
  cat: Cat
  names: string[] // raw, every language + aliases
  keys: string[] // normalized words of all names
  body: string[] // normalized words of description / date / keywords
  display: string // the name currently shown
  y: number
}
export interface Hit { doc: Doc; score: number; via: string | null; fuzzy: boolean; bodyOnly: boolean; len: number }

/** Case-, accent-, diacritic- and apostrophe-insensitive; Latin vowels o/u and "ou" folded (Omar = Umar = Oumar). */
export function norm(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[ʿʾʻʼ'’‘`´]/g, '')
    .replace(/ou/g, 'u').replace(/o/g, 'u').replace(/(.)\1+/g, '$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
const words = (s: string) => norm(s).split(' ').filter(Boolean)

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
/** 0 exact · 1 prefix · 2 substring · 3 one typo / spelling variant · -1 none */
const noAl = (w: string) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w) // Arabic definite article: الشعب = شعب
export function matchWord(q: string, w: string): number {
  const a = rawMatch(q, w), b = rawMatch(noAl(q), noAl(w))
  return a < 0 ? b : b < 0 ? a : Math.min(a, b)
}
function rawMatch(q: string, w: string): number {
  if (w === q) return 0
  if (w.startsWith(q)) return 1
  if (q.length >= 3 && w.includes(q)) return 2
  if (q.length >= 4 && w.length >= 4 && lev(q, w) <= 1) return 3
  return -1
}

export interface EntityLike { id: string; kind: 'person' | 'event' | 'place' | 'group'; name: string; summary: string; when: string; kw?: string; y: number; period: string }
/** extra: names in other languages; labels: period/kind labels in the UI language (searchable text). */
export function buildDocs(
  all: EntityLike[], arabicName: (id: string) => string, extra: Record<string, string[]>, aliases: Record<string, string[]>,
  label: (e: EntityLike) => string, periods: { id: string; names: string[]; display: string; y: number }[] = [],
): Doc[] {
  const docs: Doc[] = all.map((e) => {
    const names = [...new Set([e.name, arabicName(e.id), ...(extra[e.id] ?? []), ...(aliases[e.id] ?? []), e.id.replace(/_/g, ' ')])].filter(Boolean)
    return { id: e.id, cat: e.kind === 'group' ? 'person' : e.kind, names, keys: [...new Set(names.flatMap(words))], body: words([e.summary, e.when, e.kw ?? '', label(e)].join(' ')), display: e.name, y: e.y }
  })
  for (const p of periods) docs.push({ id: p.id, cat: 'period', names: p.names, keys: [...new Set(p.names.flatMap(words))], body: [], display: p.display, y: p.y - 1e4 })
  return docs
}

/** Every query word must match (names rank above description). Returns best-first. */
export function searchDocs(docs: Doc[], q: string, f: { cat?: Cat } = {}): Hit[] {
  const toks = words(q)
  if (!toks.length) return []
  const hits: Hit[] = []
  for (const d of docs) {
    if (f.cat && d.cat !== f.cat) continue
    let score = 0, fuzzy = false, bodyOnly = false
    for (const t of toks) {
      let best = -1
      for (const k of d.keys) { const m = matchWord(t, k); if (m >= 0 && (best < 0 || m < best)) best = m; if (best === 0) break }
      if (best < 0) { for (const k of d.body) if (matchWord(t, k) >= 0 && matchWord(t, k) <= 2) { best = 4; bodyOnly = true; break } }
      if (best < 0) { score = -1; break }
      score += best
      if (best === 3) fuzzy = true
    }
    if (score < 0) continue
    // which name matched? show it when it is not the displayed one ("also known as")
    const via = d.names.find((n) => n !== d.display && toks.every((t) => words(n).some((w) => matchWord(t, w) >= 0))) ?? null
    const shown = toks.every((t) => words(d.display).some((w) => matchWord(t, w) >= 0))
    const exact = d.names.some((n) => norm(n) === norm(q)) // whole-name match outranks partial ones ("Medina" -> Madinah, not "Hijra to Madinah")
    const len = Math.min(...d.names.filter((n) => toks.every((t) => words(n).some((w) => matchWord(t, w) >= 0))).map((n) => words(n).length), 99) // shorter matching name = closer match
    hits.push({ doc: d, score: score + (shown ? 0 : 0.5) - (exact ? 1 : 0), via: shown ? null : via, fuzzy, bodyOnly, len })
  }
  // spelling-variant (fuzzy) matches only fill in when nothing matches precisely — keeps "Omar" from listing "ʿUmayr"
  // ...and description-only matches (e.g. "Medina" inside "Medinan period") only fill in when no name matches
  const byName = hits.some((h) => !h.bodyOnly) ? hits.filter((h) => !h.bodyOnly) : hits
  const out = byName.some((h) => !h.fuzzy) ? byName.filter((h) => !h.fuzzy) : byName
  return out.sort((a, b) => a.score - b.score || a.len - b.len || a.doc.y - b.doc.y)
}

/** Closest known names for an empty result ("Did you mean"). */
export function suggest(docs: Doc[], q: string, n = 3): string[] {
  const toks = words(q); if (!toks.length) return []
  const t = toks[toks.length - 1], seen = new Map<string, number>()
  for (const d of docs) for (const name of d.names) {
    if (!/[A-Za-z؀-ۿ]/.test(name) || name.length > 28) continue
    for (const w of words(name)) { if (w.length < 3) continue; const dist = lev(t.slice(0, w.length + 1), w) + (w.startsWith(t.slice(0, 2)) ? 0 : 1); if (dist <= 2 && !seen.has(name)) seen.set(name, dist) }
  }
  return [...seen].sort((a, b) => a[1] - b[1] || a[0].length - b[0].length).slice(0, n).map(([k]) => k)
}

/** Split text into [segment, isMatch] by whole words matching the query. */
export function highlight(text: string, q: string): [string, boolean][] {
  const toks = words(q)
  return text.split(/([\s\-–—/،]+)/).filter((s) => s !== '').map((s) => [s, /^[\s\-–—/،]+$/.test(s) ? false : toks.some((t) => { const w = norm(s); return w ? matchWord(t, w) >= 0 : false })] as [string, boolean])
}
