import { SAMPLE, Entity } from '../data'
import fr from '../locales/content/fr.json'
import en from '../locales/content/en.json'
import es from '../locales/content/es.json'
import type { EdRow, TrRow, VerRow } from './api'

export type Lang = 'ar' | 'fr' | 'en' | 'es'
export const LANGS: Lang[] = ['ar', 'fr', 'en', 'es']
export const LANG_NAME: Record<Lang, string> = { ar: 'Arabic (original)', fr: 'French', en: 'English', es: 'Spanish' }
export const FIELDS = ['name', 'when', 'summary', 'bio', 'context', 'disputed'] as const
export type Field = (typeof FIELDS)[number]
export type Fields = Partial<Record<Field, string>> & { sources?: unknown }

export const TR_STATUS = ['draft', 'submitted', 'rejected', 'reviewed'] as const
export const V_STATUS = ['PENDING_REVIEW', 'UNCERTAIN', 'DISPUTED', 'VERIFIED'] as const
export const TR_LABEL: Record<string, string> = { draft: 'Draft', submitted: 'In review', rejected: 'Rejected', reviewed: 'Approved' }
export const V_LABEL: Record<string, string> = { PENDING_REVIEW: 'Pending review', UNCERTAIN: 'Uncertain', DISPUTED: 'Disputed', VERIFIED: 'Verified' }
export const KIND_LABEL: Record<Entity['kind'], string> = { person: 'Companion / figure', event: 'Event', place: 'Place', group: 'Group' }
export const PERIOD_LABEL: Record<Entity['period'], string> = { pre: 'Before revelation', mecca: 'Meccan period', hijra: 'Hijra', medina: 'Medinan period' }

export const ENTITIES: Entity[] = [...SAMPLE].sort((a, b) => a.y - b.y)
export const byId = new Map(ENTITIES.map((e) => [e.id, e]))

// bundled drafts: used only when the database has no row yet, so the first save creates it
const BUNDLED = { fr, en, es } as unknown as Record<string, { entities: Record<string, Fields> }>
export const bundledFields = (id: string, lang: Lang): Fields => (lang === 'ar' ? {} : { ...BUNDLED[lang]?.entities[id] })

export interface Index { tr: Map<string, TrRow>; ver: Map<string, VerRow>; ed: Map<string, EdRow> }
export const index = (tr: TrRow[], ver: VerRow[], ed: EdRow[] = []): Index => ({ tr: new Map(tr.map((r) => [r.entity_id + '/' + r.lang, r])), ver: new Map(ver.map((r) => [r.entity_id + '/' + r.lang, r])), ed: new Map(ed.map((r) => [r.record_id, r])) })
/** Missing translation row -> still the bundled draft; missing verification row -> PENDING_REVIEW. */
export const trStatus = (ix: Index, id: string, l: Lang) => (l === 'ar' ? null : ix.tr.get(id + '/' + l)?.translation_status ?? 'draft')
export const vStatus = (ix: Index, id: string, l: Lang) => ix.ver.get(id + '/' + l)?.status ?? 'PENDING_REVIEW'
