// Editorial model. THREE independent axes — none may be derived from another:
//   1. historical review   (was this record checked by a qualified reviewer?)
//   2. account classification (how do the sources present it?)
//   3. translation status   (per language; only for fr/en/es — Arabic is the original)
export type HistReview = 'PENDING_REVIEW' | 'IN_REVIEW' | 'VERIFIED' | 'NEEDS_REVISION'
export type Classification = 'ESTABLISHED' | 'DISPUTED' | 'UNCERTAIN'
export type TransStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED'
export type RecordType = 'entity' | 'stage' | 'biography' | 'claim'
export type TLang = 'fr' | 'en' | 'es'

export const HIST_REVIEWS: HistReview[] = ['PENDING_REVIEW', 'IN_REVIEW', 'VERIFIED', 'NEEDS_REVISION']
export const CLASSIFICATIONS: Classification[] = ['ESTABLISHED', 'DISPUTED', 'UNCERTAIN']

/** One bibliographic reference. Every field except `work`/`locator` is optional and stays empty until someone checks the edition —
 *  nothing is ever filled in from memory. `passage` is only meaningful with `verified: true`. */
export interface SourceRef {
  id: string // `${work}§${locator}` — stable
  work: string // Arabic title as used in the data
  author?: string
  kind: 'quran' | 'hadith' | 'sira' | 'history' | 'biographical' | 'modern'
  locator: string // the original chapter-level locator, kept verbatim
  chapter?: string
  volume?: string
  page?: string
  hadithNo?: string
  verse?: string // Qur'an: sūra:āya
  edition?: string
  publisher?: string
  url?: string
  passage?: { text: string; verified: boolean }
  supports: string[] // record ids this source is cited for
  completeness: 'incomplete' | 'complete'
}

export interface Reviewer { name: string; role: 'editor' | 'reviewer' }
export interface EditorialRecord {
  id: string // `${type}:${key}`
  type: RecordType
  subtype?: string // entity kind
  key: string
  label: string // Arabic
  classification: Classification | null // null = not classified yet
  review: HistReview
  reviewer?: Reviewer
  reviewedAt?: string
  reviewedSources: string[] // SourceRef ids the reviewer actually checked
  notes?: string
  sourceIds: string[]
  translations: Record<TLang, TransStatus> // independent of `review`
}
export interface ReviewAction { to: HistReview; by: Reviewer; at: string; reviewedSources?: string[]; notes?: string; classification?: Classification }
