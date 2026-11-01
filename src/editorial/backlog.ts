/** Editorial backlog: events that are NOT represented yet. Deliberately contains no historical detail — no dates, no accounts, no outcomes.
 *  An item may only become an entity + timeline event after: sources identified → drafted from those sources → reviewed. */
export type BacklogStatus = 'BACKLOG' | 'SOURCES_IDENTIFIED' | 'DRAFTING' | 'IN_REVIEW' | 'ADDED'
export interface BacklogItem {
  id: string // proposed entity id (not created yet)
  nameAr: string
  nameLatin: string
  stageHint: string // timeline stage it would belong to (src/chrono/def.ts)
  status: BacklogStatus
  rationale: string // why it is on the list — never a description of the event
  sources: string[] // identified sources (empty until a historian adds them)
}
export const REQUIRED_STEPS = [
  'Identify at least two independent primary sources and record exact citations (work, volume, page / hadith number, edition).',
  'Record every reported date and every disagreement between sources; classify each account (ESTABLISHED / DISPUTED / UNCERTAIN).',
  'Draft the Arabic text only from those sources; no quotation unless its wording is checked in the edition.',
  'Historical review by a qualified reviewer (IN_REVIEW → VERIFIED, with reviewed sources and notes).',
  'Only then: add the entity + timeline entry + relationships; fr/en/es translations start as DRAFT and are reviewed separately.',
]
const why = 'Named in the audit as a major Medinan-period event that is not yet represented. No details written.'
export const BACKLOG: BacklogItem[] = [
  { id: 'banu_qaynuqa', nameAr: 'بنو قينقاع', nameLatin: 'Banū Qaynuqāʿ', stageHint: 'g13', status: 'BACKLOG', rationale: why, sources: [] },
  { id: 'banu_nadir', nameAr: 'بنو النضير', nameLatin: 'Banū al-Naḍīr', stageHint: 'g13', status: 'BACKLOG', rationale: why, sources: [] },
  { id: 'banu_qurayza', nameAr: 'بنو قريظة', nameLatin: 'Banū Qurayẓa', stageHint: 'g13', status: 'BACKLOG', rationale: why, sources: [] },
  { id: 'bayat_ridwan', nameAr: 'بيعة الرضوان', nameLatin: 'Bayʿat al-Riḍwān', stageHint: 'g14', status: 'BACKLOG', rationale: 'Mentioned in the existing text of the Ḥudaybiya entry but has no entry of its own. No details written.', sources: [] },
  { id: 'umrat_qada', nameAr: 'عمرة القضاء', nameLatin: 'ʿUmrat al-Qaḍāʾ', stageHint: 'g14', status: 'BACKLOG', rationale: 'Candidate suggested by the audit (follows the Ḥudaybiya stage). To be confirmed by a historian. No details written.', sources: [] },
]
