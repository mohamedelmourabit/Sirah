import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hasBio } from './bio'
import { useApp } from './ctx'
import { Entity, KIND_COLOR, Period } from './data'
import { search } from './lib'
import { CertBadge, IncTag, TrTag, VerifyLabel } from './status'
import { Cat, CATS, EVENTS, GROUPS, TEvent, eventOf, neighbors } from './chrono/def'
import { useTimelineText } from './chrono'

const PERIOD_KEYS: Period[] = ['pre', 'mecca', 'hijra', 'medina']
const CAT_COLOR: Record<Cat, string> = { background: '#8aa0c0', life: '#3f86d6', revelation: '#f0cf8a', hardship: '#d06a5a', migration: '#2fb589', community: '#7fb3e6', military: '#d9a94a', diplomacy: '#a98ae0', final: '#e6ecf5' }
const GRAD: Record<Period, string> = {
  pre: 'from-[#5b4326] to-[#2a2a3a]',
  mecca: 'from-[#8a5a2b] to-[#1d2c47]',
  hijra: 'from-[#2c6a63] to-[#1d2c47]',
  medina: 'from-[#3b6e9a] to-[#1d2c47]',
}

export function Badge({ id }: { id: string }) {
  const { t } = useTranslation()
  const { viewed } = useApp()
  const v = viewed.has(id)
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${v ? 'bg-slate-600/40 text-slate-300' : 'bg-gold/20 text-gold2'}`}>{v ? t('progress.viewed') : t('progress.new')}</span>
  )
}

/** People and places related to an entity (relations are read in both directions, as on the map). */
function useLinked(e: Entity) {
  const { all } = useApp()
  return useMemo(() => {
    const rel = all.filter((r) => r.id !== e.id && (e.rel.includes(r.id) || r.rel.includes(e.id)))
    return { who: rel.filter((r) => r.kind === 'person' || r.kind === 'group'), where: rel.filter((r) => r.kind === 'place') }
  }, [all, e])
}
function LinkChip({ r }: { r: Entity }) {
  const { open, readBio } = useApp()
  return (
    <button data-tl-link={r.id} onClick={() => (hasBio(r.id) ? readBio(r.id) : open(r.id))} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs hover:border-gold">
      <i className="size-2 rounded-full" style={{ background: KIND_COLOR[r.kind] }} aria-hidden />{r.name}<TrTag e={r} />
    </button>
  )
}

function Card({ e, d, n }: { e: Entity; d: TEvent; n: number }) {
  const { t } = useTranslation()
  const { open, sel } = useApp()
  return (
    <button data-ev={e.id} onClick={() => open(e.id)} aria-current={sel === e.id ? 'true' : undefined}
      className={`flex min-h-[11rem] w-60 shrink-0 snap-start flex-col overflow-hidden rounded-xl border bg-panel text-start transition hover:-translate-y-0.5 md:w-64 ${sel === e.id ? 'border-gold ring-2 ring-gold' : 'border-line'}`}>
      <div className={`flex items-end justify-between gap-2 bg-gradient-to-br p-2 text-[11px] text-white/85 ${GRAD[e.period]}`}>
        <span className="font-semibold">{n}</span>
        <span className="flex items-center gap-1"><TrTag e={e} /><Badge id={e.id} /></span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="text-sm font-semibold text-gold2">{e.name}</div>
        <div className="text-xs text-slate-300"><bdi>{e.when}</bdi></div>
        <p className="line-clamp-2 text-xs text-slate-400">{e.summary}</p>
        {e.disputed && <p className="line-clamp-2 rounded bg-amber-500/10 px-1.5 py-1 text-[11px] text-amber-200"><span aria-hidden>⚖ </span>{e.disputed}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <CertBadge c={d.certainty} />
          <span className="text-[10px] text-slate-400"><i className="me-1 inline-block size-1.5 rounded-full" style={{ background: CAT_COLOR[d.cat] }} aria-hidden />{t(`timeline.cat.${d.cat}`)}</span>
        </div>
        <div className="text-[11px] text-slate-300"><VerifyLabel s={e.verification?.status ?? 'PENDING_REVIEW'} /></div>
      </div>
    </button>
  )
}

/** Vertical reading mode: one full block per event, in order. */
function Reading({ e, d, n, total }: { e: Entity; d: TEvent; n: number; total: number }) {
  const { t } = useTranslation()
  const { open, go, sel, orig } = useApp()
  const { who, where } = useLinked(e)
  const nb = neighbors(e.id)
  return (
    <article data-ev={e.id} aria-labelledby={`r-${e.id}`} className={`scroll-mt-24 rounded-2xl border bg-panel/70 p-4 md:p-5 ${sel === e.id ? 'border-gold' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{t('timeline.position', { n, total })}</span><span aria-hidden>·</span><bdi className="text-slate-200">{e.when}</bdi>
        <CertBadge c={d.certainty} /><TrTag e={e} /><Badge id={e.id} />
      </div>
      <h4 id={`r-${e.id}`} className="mt-1 font-display text-2xl text-gold2">{e.name}</h4>
      <p className="mt-1 text-slate-200">{e.summary}</p>
      <p className="mt-2 leading-8 text-slate-300">{e.bio}</p>
      {e.disputed && <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-200"><b>⚖ {t('timeline.alt')}: </b>{e.disputed}</p>}
      <div className="mt-2 text-xs"><VerifyLabel s={e.verification?.status ?? 'PENDING_REVIEW'} /></div>
      {!!who.length && <div className="mt-3"><div className="mb-1 text-[11px] font-semibold text-gold">{t('timeline.who')}</div><div className="flex flex-wrap gap-2">{who.map((r) => <LinkChip key={r.id} r={r} />)}</div></div>}
      {!!where.length && <div className="mt-2"><div className="mb-1 text-[11px] font-semibold text-gold">{t('timeline.where')}</div><div className="flex flex-wrap gap-2">{where.map((r) => <LinkChip key={r.id} r={r} />)}</div></div>}
      <ul className="mt-3 list-disc ps-5 text-xs text-slate-400">{e.sources.map(([ti, r], i) => { const o = orig.get(e.id)?.sources[i] ?? [ti, r]; return <li key={ti + r}><b>{ti}</b> — {r}<IncTag work={o[0]} locator={o[1]} /></li> })}</ul>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button onClick={() => open(e.id)} className="rounded-lg bg-gold/20 px-3 py-1.5 text-gold2 hover:bg-gold/30">{t('timeline.openDetails')}</button>
        <button onClick={() => { open(e.id); go('map') }} className="rounded-lg border border-line px-3 py-1.5 hover:border-gold">🕸 {t('timeline.onMap')}</button>
        {nb?.prev && <button onClick={() => open(nb.prev!)} className="rounded-lg border border-line px-3 py-1.5 hover:border-gold">← {t('timeline.prevEvent')}</button>}
        {nb?.next && <button onClick={() => open(nb.next!)} className="rounded-lg border border-line px-3 py-1.5 hover:border-gold">{t('timeline.nextEvent')} →</button>}
      </div>
    </article>
  )
}

/** Stage, certainty and previous / next navigation inside the entity drawer. */
export function TimelineInfo({ e }: { e: Entity }) {
  const { t, i18n } = useTranslation()
  const { byId, open, go } = useApp()
  const { groups, isAr } = useTimelineText()
  const d = eventOf.get(e.id), nb = neighbors(e.id)
  if (!d || !nb) return null
  const g = groups[d.group]
  const ar = isAr ? ({ lang: 'ar', dir: 'rtl' } as const) : {}
  const nav = (id: string | undefined, label: string, arrow: string) => id && byId.get(id) ? (
    <button data-tl-nav={label} onClick={() => open(id)} className="min-w-0 flex-1 rounded-lg border border-line p-2 text-start text-xs hover:border-gold">
      <span className="text-slate-400">{arrow === '←' ? '← ' : ''}{t(label)}{arrow === '→' ? ' →' : ''}</span><b className="block truncate text-gold2">{byId.get(id)!.name}</b>
    </button>
  ) : <span className="flex-1" />
  return (
    <section aria-label={t('timeline.title')} className="mt-4 rounded-lg border border-line bg-ink/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{t('timeline.stage', { n: Number(d.group.slice(1)), total: GROUPS.length })}</span><span aria-hidden>·</span><span>{t('timeline.position', { n: nb.n, total: nb.total })}</span><CertBadge c={d.certainty} />
      </div>
      {g && <div className="mt-1 font-medium text-gold2" {...ar}>{g.title} <span className="text-xs text-slate-400">({g.range})</span>{isAr && i18n.resolvedLanguage !== 'ar' && <span className="ms-2 rounded border border-line px-1.5 text-[10px] font-normal text-slate-300">{t('tr.tagAr')}</span>}</div>}
      <div className="mt-2 flex gap-2">{nav(nb.prev, 'timeline.prevEvent', '←')}{nav(nb.next, 'timeline.nextEvent', '→')}</div>
      <button onClick={() => go('timeline')} className="mt-2 text-xs text-sky hover:underline">⏳ {t('timeline.showInTimeline')}</button>
    </section>
  )
}

const chipCls = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs ${on ? 'border-gold bg-gold/20 text-gold2' : 'border-line text-slate-300 hover:bg-panel2'}`

/** compact = horizontal strip for the dashboard; otherwise the master timeline. */
export default function Timeline({ compact }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const { all, byId, go, sel, open } = useApp()
  const { groups, mode: tmode, isAr } = useTimelineText()
  const [view, setViewState] = useState<'track' | 'reading'>(() => { try { return localStorage.getItem('sira.tlview') === 'reading' ? 'reading' : 'track' } catch { return 'track' } })
  const setView = (v: 'track' | 'reading') => { setViewState(v); try { localStorage.setItem('sira.tlview', v) } catch { /* private mode */ } }
  const [period, setPeriod] = useState<Period | ''>('')
  const [cat, setCat] = useState<Cat | ''>('')
  const [q, setQ] = useState('')
  const [fopen, setFopen] = useState(false) // filter chips fold away on phones
  const scroller = useRef<HTMLDivElement>(null)
  const hits = useMemo(() => (q.trim() ? new Set(search(all, q).map((x) => x.id)) : null), [all, q])
  const list = useMemo(() => EVENTS.filter((d) => { const e = byId.get(d.id); return !!e && (!period || e.period === period) && (!cat || d.cat === cat) && (!hits || hits.has(d.id)) }), [byId, period, cat, hits])
  const rows = useMemo(() => GROUPS.map((g) => ({ g, items: list.filter((d) => d.group === g) })).filter((x) => x.items.length), [list])
  const filtered = !!(period || cat || q.trim())
  const num = (id: string) => EVENTS.findIndex((x) => x.id === id) + 1

  // keep the selected event in view (drawer prev/next, search, map, ...)
  useEffect(() => {
    if (compact || !sel) return
    document.querySelector(`[data-ev="${sel}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: view === 'reading' ? 'center' : 'nearest' })
  }, [sel, view, compact])

  if (compact)
    return (
      <section className="rounded-2xl border border-line bg-panel/70 p-4" aria-label={t('timeline.title')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-gold2">{t('timeline.title')}</h2>
          <button onClick={() => go('timeline')} className="text-sm text-sky hover:underline">{t('timeline.viewAll')}</button>
        </div>
        <div className="scroll-thin flex snap-x gap-3 overflow-x-auto pb-2">
          {EVENTS.map((d, i) => { const e = byId.get(d.id); return e ? <Card key={d.id} e={e} d={d} n={i + 1} /> : null })}
        </div>
      </section>
    )

  const by = (dir: 1 | -1) => { const el = scroller.current; if (!el) return; const rtl = getComputedStyle(el).direction === 'rtl'; el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' }) }
  const jump = (g: string) => document.getElementById(`tg-${g}`)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: view === 'reading' ? 'start' : 'nearest' })
  const nb = sel ? neighbors(sel) : null
  const GroupTitle = ({ g }: { g: string }) => {
    const x = groups[g]; if (!x) return null
    return (<>
      <span {...(isAr && i18n.resolvedLanguage !== 'ar' ? { lang: 'ar', dir: 'rtl' } : {})}>{x.title}</span>
      {i18n.resolvedLanguage !== 'ar' && (tmode === 'pending' ? <span className="ms-2 rounded border border-line px-1.5 text-[10px] text-slate-300 align-middle">{t('tr.tagAr')}</span> : tmode === 'draft' ? <span className="ms-2 rounded border border-amber-500/50 px-1.5 text-[10px] text-amber-200 align-middle">{t('tr.tagDraft')}</span> : null)}
    </>)
  }

  return (
    <div className="space-y-4">
      <details open={typeof matchMedia !== 'undefined' && matchMedia('(min-width: 768px)').matches} className="rounded-xl border border-line bg-panel/60 p-3 text-xs leading-6 text-slate-300">
        <summary className="cursor-pointer font-semibold text-gold2">ⓘ {t('verification.title')} · {t('verification.PENDING_REVIEW.label')}</summary>
        <p className="mt-1">{t('timeline.legend')}</p>
      </details>

      <div role="group" aria-label={t('timeline.filters')} className="space-y-3 rounded-2xl border border-line bg-panel/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('timeline.searchPlaceholder')} aria-label={t('timeline.searchAria')} className="min-w-0 flex-1 rounded-xl border border-line bg-ink/60 px-4 py-2 text-sm outline-none focus:border-gold md:max-w-sm" />
          <label className="flex items-center gap-2 text-xs text-slate-300">{t('timeline.jump')}
            <select aria-label={t('timeline.jump')} value="" onChange={(e) => e.target.value && jump(e.target.value)} className="max-w-[16rem] rounded-lg border border-line bg-ink/60 px-2 py-1.5 text-sm">
              <option value="">—</option>
              {rows.map(({ g }) => <option key={g} value={g}>{Number(g.slice(1))}. {groups[g]?.title}</option>)}
            </select></label>
          <button aria-expanded={fopen} onClick={() => setFopen(!fopen)} className="rounded-full border border-line px-3 py-1.5 text-xs text-gold2 md:hidden">☰ {t('timeline.filters')}{filtered ? ' •' : ''}</button>
          <div role="group" aria-label={t('timeline.modeLabel')} className="ms-auto inline-flex rounded-full border border-line bg-ink/50 p-1">
            {(['track', 'reading'] as const).map((m) => <button key={m} aria-pressed={view === m} onClick={() => setView(m)} className={`rounded-full px-3 py-1 text-xs ${view === m ? 'bg-gold/25 text-gold2' : 'text-slate-300 hover:bg-panel2'}`}>{t(m === 'track' ? 'timeline.modeTrack' : 'timeline.modeReading')}</button>)}
          </div>
        </div>
        <div className={`${fopen ? 'flex' : 'hidden'} flex-wrap items-center gap-1.5 md:flex`} role="group" aria-label={t('timeline.period')}>
          <span className="text-xs text-slate-400">{t('timeline.period')}:</span>
          <button aria-pressed={!period} onClick={() => setPeriod('')} className={chipCls(!period)}>{t('timeline.all')}</button>
          {PERIOD_KEYS.map((p) => <button key={p} aria-pressed={period === p} onClick={() => setPeriod(period === p ? '' : p)} className={chipCls(period === p)}>{t(`periods.${p}`)}</button>)}
        </div>
        <div className={`${fopen ? 'flex' : 'hidden'} flex-wrap items-center gap-1.5 md:flex`} role="group" aria-label={t('timeline.category')}>
          <span className="text-xs text-slate-400">{t('timeline.category')}:</span>
          <button aria-pressed={!cat} onClick={() => setCat('')} className={chipCls(!cat)}>{t('timeline.all')}</button>
          {CATS.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)} className={chipCls(cat === c)}><i className="me-1 inline-block size-2 rounded-full" style={{ background: CAT_COLOR[c] }} aria-hidden />{t(`timeline.cat.${c}`)}</button>)}
          {filtered && <button onClick={() => { setPeriod(''); setCat(''); setQ('') }} className="ms-auto rounded-full border border-gold/60 px-3 py-1.5 text-xs text-gold2 hover:bg-gold/10">{t('timeline.reset')}</button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span aria-live="polite">{t('timeline.events', { count: list.length })}</span>
        {nb && sel && byId.get(sel) && (
          <span className="ms-auto flex items-center gap-2" role="group" aria-label={t('timeline.selected')}>
            <button disabled={!nb.prev} onClick={() => nb.prev && open(nb.prev)} className="rounded-lg border border-line px-3 py-1.5 text-slate-200 hover:border-gold disabled:opacity-30">← {t('timeline.prevEvent')}</button>
            <b className="max-w-[10rem] truncate text-gold2">{byId.get(sel)!.name}</b>
            <button disabled={!nb.next} onClick={() => nb.next && open(nb.next)} className="rounded-lg border border-line px-3 py-1.5 text-slate-200 hover:border-gold disabled:opacity-30">{t('timeline.nextEvent')} →</button>
          </span>
        )}
      </div>

      {!rows.length ? <p className="rounded-xl border border-line p-6 text-center text-sm text-slate-400">{t('timeline.empty')}</p> : view === 'track' ? (
        <div className="relative">
          <div className="mb-2 flex justify-end gap-2">
            <button onClick={() => by(-1)} aria-label={t('timeline.scrollPrev')} className="grid size-9 place-items-center rounded-full border border-line text-gold2 hover:bg-panel2">‹</button>
            <button onClick={() => by(1)} aria-label={t('timeline.scrollNext')} className="grid size-9 place-items-center rounded-full border border-line text-gold2 hover:bg-panel2">›</button>
          </div>
          <div ref={scroller} role="region" aria-label={t('timeline.title')} tabIndex={0} className="scroll-thin flex snap-x snap-proximity items-start gap-8 overflow-x-auto pb-4">
            {rows.map(({ g, items }) => (
              <section key={g} id={`tg-${g}`} aria-labelledby={`tgh-${g}`} className="shrink-0 scroll-ms-2">
                <div className="mb-2 flex items-center gap-2"><i className="size-3 shrink-0 rounded-full bg-gold" aria-hidden /><div className="h-px w-8 bg-gold/50" aria-hidden />
                  <div><h3 id={`tgh-${g}`} className="font-display text-xl text-gold2"><span className="text-sm text-slate-400">{t('timeline.stageLabel')} {Number(g.slice(1))} · </span><GroupTitle g={g} /></h3>
                    <div className="text-xs text-slate-400" {...(isAr && i18n.resolvedLanguage !== 'ar' ? { lang: 'ar', dir: 'rtl' } : {})}><bdi>{groups[g]?.range}</bdi></div></div></div>
                <div className="flex gap-3 border-t border-gold/30 pt-3">{items.map((d) => <Card key={d.id} e={byId.get(d.id)!} d={d} n={num(d.id)} />)}</div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {rows.map(({ g, items }) => (
            <section key={g} id={`tg-${g}`} aria-labelledby={`tgh-${g}`} className="scroll-mt-20">
              <h3 id={`tgh-${g}`} className="mb-1 flex flex-wrap items-baseline gap-x-3 font-display text-2xl text-gold2"><i className="size-3 self-center rounded-full bg-gold" aria-hidden /><span className="text-sm text-slate-400">{t('timeline.stageLabel')} {Number(g.slice(1))}</span><GroupTitle g={g} /></h3>
              <p className="mb-3 ps-6 text-xs text-slate-400" {...(isAr && i18n.resolvedLanguage !== 'ar' ? { lang: 'ar', dir: 'rtl' } : {})}><bdi>{groups[g]?.range}</bdi> — {groups[g]?.intro}</p>
              <div className="space-y-3 border-s border-gold/30 ps-4">{items.map((d) => <Reading key={d.id} e={byId.get(d.id)!} d={d} n={num(d.id)} total={EVENTS.length} />)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
