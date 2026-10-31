import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from './ctx'
import { KIND_COLOR } from './data'
import { Badge } from './Timeline'
import { TrPill, TrTag, VerifyBox } from './status'
import { hasBio } from './bio'

export default function Detail({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { sel, byId, orig, open, go, readBio } = useApp()
  const [showAr, setShowAr] = useState(false)
  useEffect(() => setShowAr(false), [sel]) // each entity opens on the translation again
  const tr = sel ? byId.get(sel) : null
  const e = showAr ? orig.get(sel!) ?? tr : tr
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onClose])
  if (!e) return null
  const uiAr = i18n.resolvedLanguage === 'ar'
  // Arabic original text (pending fallback or explicit toggle) renders RTL even in an LTR UI
  const ar = e.tr === 'pending' || e.tr === 'original' ? ({ lang: 'ar', dir: 'rtl' } as const) : {}
  // a translation exists for this entity: let the reader flip between it and the Arabic original
  const canFlip = !uiAr && tr && (tr.tr === 'approved' || tr.tr === 'draft')

  const show = (v: 'map' | 'timeline') => { go(v); }
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={e.name}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <article className="scroll-thin absolute inset-y-0 start-0 w-full overflow-y-auto border-e border-gold/40 bg-panel p-5 shadow-2xl md:w-[460px]">
        <button onClick={onClose} aria-label={t('detail.close')} className="float-end grid size-8 place-items-center rounded-full border border-line hover:bg-panel2">✕</button>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full px-2 py-0.5 text-ink" style={{ background: KIND_COLOR[e.kind] }}>{t(`kinds.${e.kind}`)}</span>
          <span className="text-slate-400">{t(`periods.${e.period}`)} · <bdi>{e.when}</bdi></span>
          <Badge id={e.id} />
        </div>
        <TrPill e={e} uiAr={uiAr} />
        {canFlip && (
          <button onClick={() => setShowAr(!showAr)} aria-pressed={showAr} className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs text-gold2 hover:border-gold">
            {showAr ? t('tr.viewTranslation') : t('tr.viewOriginal')}
          </button>
        )}
        {hasBio(e.id) && <button onClick={() => readBio(e.id)} className="mt-3 w-full rounded-lg bg-gold py-2 text-sm font-semibold text-ink hover:bg-gold2">📖 {t('bio.read')}</button>}
        <h2 className="mt-3 font-display text-4xl text-gold2" {...ar}>{e.name}</h2>
        <p className="mt-2 text-slate-200" {...ar}>{e.summary}</p>

        <VerifyBox e={e} ar={ar} />

        <h3 className="mb-1 mt-5 text-sm font-semibold text-gold">{t('detail.bio')}</h3>
        <p className="leading-8 text-slate-300" {...ar}>{e.bio}</p>
        <h3 className="mb-1 mt-5 text-sm font-semibold text-gold">{t('detail.context')}</h3>
        <p className="leading-8 text-slate-300" {...ar}>{e.context}</p>

        <h3 className="mb-2 mt-5 text-sm font-semibold text-gold">{t('detail.sources')}</h3>
        <ul className="list-disc space-y-1 ps-5 text-sm text-slate-300" {...ar}>
          {e.sources.map(([t, r]) => <li key={t + r}><b>{t}</b> — {r}</li>)}
        </ul>

        <h3 className="mb-2 mt-5 text-sm font-semibold text-gold">{t('detail.related')}</h3>
        <div className="flex flex-wrap gap-2">
          {e.rel.map((r) => byId.get(r)).filter(Boolean).map((r) => (
            <button key={r!.id} onClick={() => (hasBio(r!.id) ? readBio(r!.id) : open(r!.id))} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs hover:border-gold">
              <i className="size-2 rounded-full" style={{ background: KIND_COLOR[r!.kind] }} />{r!.name}<TrTag e={r!} />
            </button>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={() => show('map')} className="flex-1 rounded-lg bg-gold/20 py-2 text-sm text-gold2 hover:bg-gold/30">{t('detail.showMap')}</button>
          {e.kind === 'event' && <button onClick={() => show('timeline')} className="flex-1 rounded-lg bg-gold/20 py-2 text-sm text-gold2 hover:bg-gold/30">{t('detail.showTimeline')}</button>}
        </div>
      </article>
    </div>
  )
}
