import { useTranslation } from 'react-i18next'
import type { Entity } from './data'
import type { VStatus } from './content'

const V: Record<VStatus, { icon: string; cls: string }> = {
  VERIFIED: { icon: '✔', cls: 'border-jade/50 bg-jade/10 text-emerald-200' },
  DISPUTED: { icon: '⚖', cls: 'border-amber-500/50 bg-amber-500/10 text-amber-200' },
  UNCERTAIN: { icon: '?', cls: 'border-orange-400/50 bg-orange-400/10 text-orange-200' },
  PENDING_REVIEW: { icon: '⏳', cls: 'border-line bg-ink/50 text-slate-300' },
}
export const VSTATUS_ORDER: VStatus[] = ['VERIFIED', 'DISPUTED', 'UNCERTAIN', 'PENDING_REVIEW']

/** Status is conveyed by icon + text, never by colour alone. */
export function VerifyLabel({ s }: { s: VStatus }) {
  const { t } = useTranslation()
  return <b><span aria-hidden>{V[s].icon} </span>{t(`verification.${s}.label`)}</b>
}

/** Historical-accuracy status of the text shown. Separate from translation status. */
export function VerifyBox({ e, ar }: { e: Entity; ar: object }) {
  const { t } = useTranslation()
  const v = e.verification ?? { status: 'PENDING_REVIEW' as const }
  return (
    <section aria-label={t('verification.title')} className="mt-4 space-y-2 text-sm">
      <div className={`rounded-lg border p-3 ${V[v.status].cls}`}>
        <div className="text-[11px] uppercase tracking-wide opacity-70">{t('verification.title')}</div>
        <div className="mt-0.5"><VerifyLabel s={v.status} /> — {t(`verification.${v.status}.desc`)}</div>
        {v.reviewed_by && <div className="mt-1 text-xs opacity-80">{t('verification.reviewedBy', { by: v.reviewed_by, at: v.reviewed_at })}</div>}
        {v.note && <div className="mt-1 text-xs" {...ar}>{v.note}</div>}
        {!!v.refs?.length && <ul className="mt-1 list-disc ps-5 text-xs" aria-label={t('verification.refs')}>{v.refs.map((r, i) => <li key={i}><b>{r.title}</b>{r.ref && ` — ${r.ref}`}</li>)}</ul>}
      </div>
      {e.disputed && (
        <div className="rounded-lg border border-line bg-ink/40 p-3">
          <div className="text-xs font-semibold text-gold2">{t('verification.diffNote')}</div>
          <p className="mt-1 text-slate-300" {...ar}>{e.disputed}</p>
          {v.status === 'PENDING_REVIEW' && <p className="mt-1 text-[11px] text-slate-400">{t('verification.diffNoteHint')}</p>}
        </div>
      )}
    </section>
  )
}

/** Which text you are reading: Arabic original, draft translation or approved translation. */
export function TrPill({ e, uiAr }: { e: Entity; uiAr: boolean }) {
  const { t } = useTranslation()
  if (e.tr === 'original' && uiAr) return null
  const k = e.tr === 'approved' ? 'pillApproved' : e.tr === 'draft' ? 'pillDraft' : e.tr === 'pending' ? 'pillPending' : 'pillOriginal'
  const cls = e.tr === 'approved' ? 'border-jade/50 bg-jade/10 text-emerald-200' : e.tr === 'draft' ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-line bg-ink/50 text-slate-300'
  return (
    <div role="note" className={`mt-3 rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <b>{t(`tr.${k}`)}</b>
      {e.tr === 'draft' && <> — {t('tr.draftNote')}</>}
      {e.tr === 'approved' && e.trReview && <div className="mt-0.5 opacity-80">{t('tr.reviewedBy', { by: e.trReview.by, at: e.trReview.at })}</div>}
    </div>
  )
}

/** Small tag on list cards: AR = original Arabic shown (no approved translation); Draft = unreviewed translation. */
export function TrTag({ e }: { e: Entity }) {
  const { t } = useTranslation()
  if (e.tr === 'pending') return <span title={t('tr.pillPending')} className="rounded border border-line px-1.5 text-[10px] text-slate-300">{t('tr.tagAr')}</span>
  if (e.tr === 'draft') return <span title={t('tr.pillDraft')} className="rounded border border-amber-500/50 px-1.5 text-[10px] text-amber-200">{t('tr.tagDraft')}</span>
  return null
}
