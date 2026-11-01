import type { Classification, EditorialRecord, HistReview, ReviewAction, SourceRef, TransStatus } from './types'

/** Allowed historical-review transitions. There is deliberately NO path PENDING_REVIEW -> VERIFIED: a record must be IN_REVIEW first. */
export const TRANSITIONS: Record<HistReview, HistReview[]> = {
  PENDING_REVIEW: ['IN_REVIEW'],
  IN_REVIEW: ['VERIFIED', 'NEEDS_REVISION', 'PENDING_REVIEW'],
  NEEDS_REVISION: ['IN_REVIEW', 'PENDING_REVIEW'],
  VERIFIED: ['IN_REVIEW', 'NEEDS_REVISION'],
}
const blank = (s?: string | null) => !s || !s.trim()

/** What a VERIFIED record must carry. Same rule as the database constraint `editorial_verified_needs_review_data`. */
export function verifiedProblems(r: Pick<EditorialRecord, 'review' | 'reviewer' | 'reviewedAt' | 'reviewedSources' | 'notes' | 'sourceIds'>): string[] {
  if (r.review !== 'VERIFIED') return []
  const p: string[] = []
  if (!r.reviewer || blank(r.reviewer.name) || !r.reviewer.role) p.push('reviewer identity and role')
  if (!r.reviewedAt) p.push('review date')
  if (!r.reviewedSources?.length) p.push('at least one reviewed source reference')
  else if (r.reviewedSources.some((s) => !r.sourceIds.includes(s))) p.push('reviewed sources must be sources of this record')
  if (blank(r.notes)) p.push('review notes')
  return p
}

/** Apply a review action. Throws if the transition or the required data is missing. Never touches classification or translations unless asked. */
export function applyReview(r: EditorialRecord, a: ReviewAction): EditorialRecord {
  const reclassifyOnly = a.to === r.review && !!a.classification && r.review !== 'VERIFIED' // a VERIFIED record must be reopened before it can be reclassified
  if (!reclassifyOnly && !TRANSITIONS[r.review].includes(a.to)) throw new Error(`${r.review} → ${a.to} is not allowed`)
  const next: EditorialRecord = { ...r, review: a.to, notes: a.notes ?? r.notes, classification: a.classification ?? r.classification }
  if (a.to === 'VERIFIED') { next.reviewer = a.by; next.reviewedAt = a.at; next.reviewedSources = a.reviewedSources ?? [] }
  else { next.reviewer = undefined; next.reviewedAt = undefined; next.reviewedSources = [] }
  if (a.to === 'NEEDS_REVISION' && blank(a.notes)) throw new Error('returning a record for revision needs notes')
  if (a.classification && a.classification !== r.classification && blank(a.notes)) throw new Error('changing the classification needs notes')
  const bad = verifiedProblems(next)
  if (bad.length) throw new Error('VERIFIED needs: ' + bad.join(', '))
  if ((a.to === 'VERIFIED' || a.to === 'NEEDS_REVISION' || a.classification) && a.by.role !== 'reviewer') throw new Error('only a reviewer can verify, return, or reclassify')
  return next
}

/** Existing certainty values -> classification. */
export const classify = (c: 'established' | 'disputed' | 'uncertain'): Classification => c.toUpperCase() as Classification

/** Database / legacy translation status -> editorial translation status. 'rejected' returns to DRAFT. */
export const transStatus = (s?: string): TransStatus => (s === 'reviewed' ? 'APPROVED' : s === 'submitted' ? 'IN_REVIEW' : 'DRAFT')

/** A reference is complete only when it can be located exactly. Qur'an: sūra + āya. Others: an edition AND a page or hadith number. */
export function completeness(s: Pick<SourceRef, 'kind' | 'verse' | 'edition' | 'page' | 'hadithNo'>): 'incomplete' | 'complete' {
  if (s.kind === 'quran') return s.verse ? 'complete' : 'incomplete'
  return s.edition && (s.page || s.hadithNo) ? 'complete' : 'incomplete'
}
