// Pure content logic (no React, no network): translation + verification resolution.
import type { Entity } from './data'
import arJson from './locales/content/ar.json'

/** Historical-accuracy status of what is displayed. Never derived automatically. */
export type VStatus = 'VERIFIED' | 'IN_REVIEW' | 'NEEDS_REVISION' | 'PENDING_REVIEW' | 'DISPUTED' | 'UNCERTAIN'
/** DISPUTED / UNCERTAIN are LEGACY values (they describe the account, not the review); they are still accepted but new records use
 *  the editorial model (src/editorial): review status and classification are separate fields. */
export const VSTATUS: VStatus[] = ['VERIFIED', 'IN_REVIEW', 'NEEDS_REVISION', 'PENDING_REVIEW', 'DISPUTED', 'UNCERTAIN']
export interface Verif { status: VStatus; reviewed_by?: string; reviewed_at?: string; note?: string; refs?: { title: string; ref?: string }[] }
/** Linguistic review of one language's text. Independent of Verif. */
export interface TrMeta { status?: 'draft' | 'reviewed'; reviewed_by?: string; reviewed_at?: string }

type Fields = Partial<Pick<Entity, 'name' | 'when' | 'summary' | 'bio' | 'context' | 'disputed' | 'sources'>>
export interface Tr extends Fields { translation?: TrMeta; verification?: Partial<Verif> }
export interface Pack { books: Record<string, string>; refs: Record<string, string>; entities: Record<string, Tr> }
export const arPack = arJson as unknown as Pack

const PENDING: Verif = { status: 'PENDING_REVIEW' }
/** Missing/invalid data -> PENDING_REVIEW. Any other status needs a named reviewer and a date. */
export function verificationOf(v?: Partial<Verif> | null): Verif {
  if (!v || !VSTATUS.includes(v.status as VStatus)) return PENDING
  if (v.status !== 'PENDING_REVIEW' && !(v.reviewed_by && v.reviewed_at)) return PENDING
  return v as Verif
}
/** A translation is approved only with status 'reviewed' AND a named reviewer and date. */
export const translationApproved = (m?: TrMeta | null) => m?.status === 'reviewed' && !!m.reviewed_by && !!m.reviewed_at

/**
 * Same ids and relations in every language. For each entity:
 *  approved -> reviewed translation; draft -> shown only when showDrafts (labelled);
 *  otherwise the Arabic original is kept and flagged 'pending'.
 * `verification` always belongs to the text actually displayed (Arabic original or that language).
 */
export const localize = (all: Entity[], ar: Pack | null, pack: Pack | null, showDrafts = false): Entity[] =>
  all.map((e) => {
    const arV = verificationOf(ar?.entities[e.id]?.verification)
    const t = pack?.entities[e.id]
    if (!pack || !t) return { ...e, tr: pack ? 'pending' : 'original', verification: arV, trReview: undefined }
    const approved = translationApproved(t.translation)
    if (!approved && !showDrafts) return { ...e, tr: 'pending', verification: arV, trReview: undefined }
    return {
      ...e,
      name: t.name ?? e.name, when: t.when ?? e.when, summary: t.summary ?? e.summary,
      bio: t.bio ?? e.bio, context: t.context ?? e.context, disputed: t.disputed ?? e.disputed,
      sources: t.sources ?? e.sources.map(([s, r]): [string, string] => [pack.books[s] ?? s, pack.refs[r] ?? r]),
      tr: approved ? 'approved' : 'draft',
      trReview: approved ? { by: t.translation!.reviewed_by!, at: t.translation!.reviewed_at! } : undefined,
      verification: verificationOf(t.verification),
    }
  })

export interface TrRow { entity_id: string; fields?: Fields; translation_status?: string; translation_reviewed_by?: string | null; translation_reviewed_at?: string | null }
export interface VerRow { entity_id: string; status?: string; reviewed_by?: string | null; reviewed_at?: string | null; note?: string | null; refs?: { title: string; ref?: string }[] | null }
/** Overlay database rows on a bundled pack. Unapproved translation rows are ignored even if the server sent them. */
export function mergeRemote(local: Pack, tr: TrRow[], ver: VerRow[]): Pack {
  const entities: Record<string, Tr> = { ...local.entities }
  for (const r of tr) {
    const meta: TrMeta = { status: r.translation_status as TrMeta['status'], reviewed_by: r.translation_reviewed_by ?? undefined, reviewed_at: r.translation_reviewed_at ?? undefined }
    if (!translationApproved(meta)) continue
    entities[r.entity_id] = { ...entities[r.entity_id], ...r.fields, translation: meta }
  }
  for (const r of ver)
    entities[r.entity_id] = { ...entities[r.entity_id], verification: { status: r.status as VStatus, reviewed_by: r.reviewed_by ?? undefined, reviewed_at: r.reviewed_at ?? undefined, note: r.note ?? undefined, refs: r.refs?.length ? r.refs : undefined } }
  return { ...local, entities }
}
