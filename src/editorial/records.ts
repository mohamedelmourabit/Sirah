import { SAMPLE } from '../data'
import { EVENTS, GROUPS } from '../chrono/def'
import { abubakr } from '../bio/abubakr'
import { umar } from '../bio/umar'
import type { BioDef } from '../bio/types'
import { classify, transStatus } from './rules'
import { registry, sourceId } from './sources'
import type { EditorialRecord, SourceRef, TLang } from './types'
import reviews from './reviews.json'
import frC from '../locales/content/fr.json'
import enC from '../locales/content/en.json'
import esC from '../locales/content/es.json'
import frT from '../chrono/fr.json'
import enT from '../chrono/en.json'
import esT from '../chrono/es.json'
import umFr from '../bio/umar/fr.json'
import umEn from '../bio/umar/en.json'
import umEs from '../bio/umar/es.json'
import abFr from '../bio/abubakr/fr.json'
import abEn from '../bio/abubakr/en.json'
import abEs from '../bio/abubakr/es.json'

export const BIO_DEFS: BioDef[] = [umar, abubakr]
// translation status is READ from each language's own pack — it is never derived from the historical review
const ENT = { fr: frC, en: enC, es: esC } as unknown as Record<TLang, { entities: Record<string, { translation?: { status?: string } }> }>
const STG = { fr: frT, en: enT, es: esT } as unknown as Record<TLang, { translation?: { status?: string } }>
const BIOT = { umar: { fr: umFr, en: umEn, es: umEs }, abubakr: { fr: abFr, en: abEn, es: abEs } } as unknown as Record<string, Record<TLang, { translation?: { status?: string } }>>
const LANGS3: TLang[] = ['fr', 'en', 'es']
const tr = (f: (l: TLang) => string | undefined): EditorialRecord['translations'] => Object.fromEntries(LANGS3.map((l) => [l, transStatus(f(l))])) as EditorialRecord['translations']
const evCert = new Map(EVENTS.map((e) => [e.id, e.certainty]))

export interface Registry { records: EditorialRecord[]; byId: Map<string, EditorialRecord>; sources: Map<string, SourceRef> }

/** Every historical record, with defaults: review = PENDING_REVIEW, classification derived from the existing certainty (events, claims) or unset,
 *  translations = DRAFT. `reviews.json` (bundled decisions, currently empty) can only override — and is validated by `npm run check:editorial`. */
export function buildRegistry(): Registry {
  const cites: { work: string; locator: string; record: string }[] = []
  const rec = (r: Omit<EditorialRecord, 'review' | 'reviewedSources'> & Partial<EditorialRecord>): EditorialRecord => ({ review: 'PENDING_REVIEW', reviewedSources: [], ...r } as EditorialRecord)
  const records: EditorialRecord[] = []
  for (const e of SAMPLE) {
    const id = `entity:${e.id}`
    e.sources.forEach(([work, locator]) => cites.push({ work, locator, record: id }))
    records.push(rec({ id, type: 'entity', subtype: e.kind, key: e.id, label: e.name, classification: evCert.has(e.id) ? classify(evCert.get(e.id)!) : null, sourceIds: e.sources.map(([w, l]) => sourceId(w, l)), translations: tr((l) => ENT[l].entities[e.id]?.translation?.status) }))
  }
  for (const g of GROUPS) {
    const evs = SAMPLE.filter((e) => EVENTS.find((x) => x.id === e.id && x.group === g))
    const sids = [...new Set(evs.flatMap((e) => e.sources.map(([w, l]) => sourceId(w, l))))]
    records.push(rec({ id: `stage:${g}`, type: 'stage', key: g, label: g, classification: null, sourceIds: sids, translations: tr((l) => STG[l].translation?.status) }))
  }
  for (const b of BIO_DEFS) {
    const all = Object.values(b.sources).map(([w, l]) => sourceId(w, l))
    records.push(rec({ id: `biography:${b.id}`, type: 'biography', key: b.id, label: SAMPLE.find((e) => e.id === b.id)!.name, classification: null, sourceIds: [...new Set(all)], translations: tr((l) => BIOT[b.id][l].translation?.status) }))
    for (const s of b.sections) for (const c of s.claims) {
      const id = `claim:${b.id}:${c.id}`
      c.src.forEach((k) => cites.push({ work: b.sources[k][0], locator: b.sources[k][1], record: id }))
      records.push(rec({ id, type: 'claim', subtype: b.id, key: `${b.id}:${c.id}`, label: c.id, classification: classify(c.certainty), sourceIds: c.src.map((k) => sourceId(b.sources[k][0], b.sources[k][1])), translations: tr((l) => BIOT[b.id][l].translation?.status) }))
    }
  }
  const sources = registry(cites)
  const ov = reviews as Record<string, Partial<EditorialRecord>>
  for (const r of records) if (ov[r.id]) Object.assign(r, ov[r.id])
  return { records, byId: new Map(records.map((r) => [r.id, r])), sources }
}
export const TLANGS: TLang[] = ['fr', 'en', 'es']
