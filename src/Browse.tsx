import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp, View } from './ctx'
import { Entity, KIND_COLOR, Period } from './data'
import { VSTATUS_ORDER, TrTag, VerifyLabel } from './status'
import { Badge } from './Timeline'

const PERIODS: Period[] = ['pre', 'mecca', 'hijra', 'medina']
type Sec = 'person' | 'event' | 'place' | 'period'
const SECTIONS: Sec[] = ['person', 'event', 'place', 'period']
const secOf = (e: Entity): Exclude<Sec, 'period'> => (e.kind === 'group' ? 'person' : e.kind)

/** Segmented switch between the relationship map and the organised list. */
export function ViewToggle({ view, go }: { view: View; go: (v: View) => void }) {
  const { t } = useTranslation()
  const on = view === 'browse'
  const b = (active: boolean) => `rounded-full px-4 py-1.5 text-sm ${active ? 'bg-gold/25 text-gold2' : 'text-slate-300 hover:bg-panel2'}`
  return (
    <div role="group" aria-label={t('view.label')} className="inline-flex rounded-full border border-line bg-panel/70 p-1">
      <button aria-pressed={!on} onClick={() => go('map')} className={b(!on)}>🕸 {t('view.map')}</button>
      <button aria-pressed={on} onClick={() => go('browse')} className={b(on)}>☰ {t('view.list')}</button>
    </div>
  )
}

const sel = 'rounded-lg border border-line bg-ink/60 px-2 py-1.5 text-sm'

export default function Browse({ period: p0 }: { period?: Period }) {
  const { t, i18n } = useTranslation()
  const { all, open, viewed } = useApp()
  const [type, setType] = useState<Sec | ''>('')
  const [period, setPeriod] = useState<Period | ''>(p0 ?? '')
  const [reading, setReading] = useState<'' | 'new' | 'viewed'>('')
  const [ver, setVer] = useState('')
  const [sort, setSort] = useState<'chrono' | 'name' | 'unread' | 'ver'>('chrono')

  const list = useMemo(() => {
    const cmp: Record<string, (a: Entity, b: Entity) => number> = {
      chrono: (a, b) => a.y - b.y,
      name: (a, b) => a.name.localeCompare(b.name, i18n.resolvedLanguage),
      unread: (a, b) => Number(viewed.has(a.id)) - Number(viewed.has(b.id)) || a.y - b.y,
      ver: (a, b) => VSTATUS_ORDER.indexOf(a.verification?.status ?? 'PENDING_REVIEW') - VSTATUS_ORDER.indexOf(b.verification?.status ?? 'PENDING_REVIEW') || a.y - b.y,
    }
    return all
      .filter((e) => (!period || e.period === period) && (!reading || (reading === 'viewed') === viewed.has(e.id)) && (!ver || (e.verification?.status ?? 'PENDING_REVIEW') === ver))
      .sort(cmp[sort])
  }, [all, period, reading, ver, sort, viewed, i18n.resolvedLanguage])
  const filtered = !!(period || reading || ver || type)
  const reset = () => { setType(''); setPeriod(''); setReading(''); setVer('') }
  const counts = (p: Period) => all.filter((e) => e.period === p).length

  const Card = ({ e }: { e: Entity }) => (
    <button onClick={() => open(e.id)} className="rounded-xl border border-line bg-panel p-4 text-start transition hover:border-gold/60">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-gold2">{e.name}</h4>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-1"><TrTag e={e} /><Badge id={e.id} /></span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
        <i className="size-2 rounded-full" style={{ background: KIND_COLOR[e.kind] }} aria-hidden />{t(`kinds.${e.kind}`)} · {t(`periods.${e.period}`)} · <bdi>{e.when}</bdi>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-300">{e.summary}</p>
      <div className="mt-2 text-[11px] text-slate-300"><VerifyLabel s={e.verification?.status ?? 'PENDING_REVIEW'} /></div>
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-panel/60 p-3 text-xs text-slate-300">
        <label className="grid gap-1">{t('browse.type')}
          <select className={sel} value={type} onChange={(e) => setType(e.target.value as Sec | '')}><option value="">{t('browse.all')}</option>{SECTIONS.map((s) => <option key={s} value={s}>{t(`cat.${s}`)}</option>)}</select></label>
        <label className="grid gap-1">{t('browse.period')}
          <select className={sel} value={period} onChange={(e) => setPeriod(e.target.value as Period | '')}><option value="">{t('browse.all')}</option>{PERIODS.map((p) => <option key={p} value={p}>{t(`periods.${p}`)}</option>)}</select></label>
        <label className="grid gap-1">{t('browse.reading')}
          <select className={sel} value={reading} onChange={(e) => setReading(e.target.value as '' | 'new' | 'viewed')}><option value="">{t('browse.all')}</option><option value="new">{t('progress.new')}</option><option value="viewed">{t('progress.viewed')}</option></select></label>
        <label className="grid gap-1">{t('browse.verification')}
          <select className={sel} value={ver} onChange={(e) => setVer(e.target.value)}><option value="">{t('browse.all')}</option>{VSTATUS_ORDER.map((v) => <option key={v} value={v}>{t(`verification.${v}.label`)}</option>)}</select></label>
        <label className="grid gap-1">{t('browse.sort')}
          <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>{(['chrono', 'name', 'unread', 'ver'] as const).map((s) => <option key={s} value={s}>{t(`browse.sort${{ chrono: 'Chrono', name: 'Name', unread: 'Unread', ver: 'Verification' }[s]}`)}</option>)}</select></label>
        {filtered && <button onClick={reset} className="rounded-lg border border-gold/60 px-3 py-1.5 text-gold2 hover:bg-gold/10">{t('browse.reset')}</button>}
        <span className="ms-auto self-center" aria-live="polite">{t('browse.entries', { count: list.length })}</span>
      </div>

      {SECTIONS.filter((s) => !type || type === s).map((s) => {
        if (s === 'period') {
          const ps = PERIODS.filter((p) => !period || p === period)
          return (
            <section key={s} aria-labelledby="sec-period">
              <h3 id="sec-period" className="mb-2 font-display text-2xl text-gold2">{t('cat.period')}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {ps.map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className="rounded-xl border border-line bg-panel p-4 text-start hover:border-gold/60">
                    <h4 className="font-medium text-gold2">{t(`periods.${p}`)}</h4>
                    <div className="mt-1 text-xs text-slate-400">{t('browse.entries', { count: counts(p) })}</div>
                    <div className="mt-2 text-xs text-slate-300">{t('browse.showPeriod')}</div>
                  </button>
                ))}
              </div>
            </section>
          )
        }
        const items = list.filter((e) => secOf(e) === s)
        return (
          <section key={s} aria-labelledby={`sec-${s}`}>
            <h3 id={`sec-${s}`} className="mb-2 font-display text-2xl text-gold2">{t(`cat.${s}`)} <span className="text-sm text-slate-400">({items.length})</span></h3>
            {items.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((e) => <Card key={e.id} e={e} />)}</div> : <p className="text-sm text-slate-400">{t('browse.empty')}</p>}
          </section>
        )
      })}
    </div>
  )
}
