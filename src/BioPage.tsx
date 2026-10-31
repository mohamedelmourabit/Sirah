import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BIOS, hasBio } from './bio'
import type { BioPack, Certainty } from './bio/types'
import { translationApproved, verificationOf } from './content'
import { useApp } from './ctx'
import { KIND_COLOR, Period } from './data'
import { TrTag, VerifyLabel } from './status'

const CERT: Record<Certainty, string> = {
  established: 'border-jade/50 bg-jade/10 text-emerald-200',
  disputed: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  uncertain: 'border-orange-400/50 bg-orange-400/10 text-orange-200',
}
const CICON: Record<Certainty, string> = { established: '●', disputed: '⚖', uncertain: '?' }

/** How the sources present an account. NOT the review status (that is the page-level verification). Icon + text, never colour alone. */
function CertBadge({ c }: { c: Certainty }) {
  const { t } = useTranslation()
  return <span title={t(`bio.${c}Desc`)} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${CERT[c]}`}><span aria-hidden>{CICON[c]}</span>{t(`bio.${c}`)}</span>
}

type Mode = 'original' | 'approved' | 'draft' | 'pending'

/** Reusable biography template: all content comes from src/bio/<id>/ (skeleton + per-language packs). */
export default function BioPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const { byId, all, open, readBio, browse, drafts, setDrafts, viewed } = useApp()
  const lang = i18n.resolvedLanguage ?? 'ar'
  const def = BIOS[id].def
  const entity = byId.get(id)!
  const [packs, setPacks] = useState<{ lang: string; ar: BioPack; tr?: BioPack } | null>(null)
  const [showAr, setShowAr] = useState(false)
  useEffect(() => { setShowAr(false) }, [lang, id])
  useEffect(() => {
    let live = true
    Promise.all([BIOS[id].load('ar'), lang === 'ar' ? undefined : BIOS[id].load(lang)]).then(([ar, tr]) => live && setPacks({ lang, ar, tr }))
    return () => { live = false }
  }, [id, lang])

  // ---- reading progress (scroll bar + sections read, remembered in this browser) ----
  const key = `sira.bio.${id}`
  const [read, setRead] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')) } catch { return new Set() } })
  const [active, setActive] = useState(def.sections[0].id)
  const [scroll, setScroll] = useState(0)
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const on = () => { const r = root.current?.getBoundingClientRect(); if (r) setScroll(Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight)))) }
    on(); addEventListener('scroll', on, { passive: true }); addEventListener('resize', on)
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on) }
  }, [packs])
  useEffect(() => {
    if (!packs) return
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return
      const sid = (e.target as HTMLElement).dataset.sec!
      setActive(sid)
      setRead((r) => { if (r.has(sid)) return r; const n = new Set(r).add(sid); try { localStorage.setItem(key, JSON.stringify([...n])) } catch { /* private mode */ } return n })
    }), { rootMargin: '-35% 0px -55% 0px' })
    root.current?.querySelectorAll('[data-sec]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [packs, key])

  // ---- which text is on screen (same rules as the entity drawer) ----
  const mode: Mode = useMemo(() => {
    if (lang === 'ar' || !packs) return 'original'
    if (translationApproved(packs.tr?.translation)) return 'approved'
    return drafts && packs.tr ? 'draft' : 'pending'
  }, [lang, packs, drafts])
  const canFlip = mode === 'approved' || mode === 'draft'
  const p = !packs ? null : mode === 'original' || mode === 'pending' || showAr ? packs.ar : packs.tr!
  const isAr = !!packs && p === packs.ar
  const ar = isAr ? ({ lang: 'ar', dir: 'rtl' } as const) : {}
  const verif = verificationOf(p?.verification)

  // sources, numbered in order of first use
  const srcOrder = useMemo(() => {
    const seen: string[] = []
    const add = (ids: string[]) => ids.forEach((s) => !seen.includes(s) && seen.push(s))
    def.facts.forEach((f) => add(f.src)); def.sections.forEach((s) => s.claims.forEach((c) => add(c.src)))
    return seen
  }, [def])
  const num = (s: string) => srcOrder.indexOf(s) + 1
  const book = (title: string) => (isAr ? title : p?.books[title] ?? title)
  const loc = (l: string) => (isAr ? l : p?.refs[l] ?? l)

  // every entity this page links to, by kind
  const linked = useMemo(() => {
    const ids = new Set<string>()
    def.sections.forEach((s) => { s.links?.forEach((i) => ids.add(i)); s.claims.forEach((c) => c.links?.forEach((i) => ids.add(i))) })
    def.journey.forEach((j) => j.entity && ids.add(j.entity))
    ids.delete(id)
    const es = [...ids].map((i) => byId.get(i)).filter((e): e is NonNullable<typeof e> => !!e)
    return { event: es.filter((e) => e.kind === 'event'), person: es.filter((e) => e.kind === 'person' || e.kind === 'group'), place: es.filter((e) => e.kind === 'place'), ids }
  }, [def, byId, id])
  // recommendations: entities that share relations with the people/events this page links to, not already linked
  const recs = useMemo(() => {
    const score = new Map<string, number>()
    linked.ids.forEach((i) => byId.get(i)?.rel.forEach((r) => { if (r !== id && !linked.ids.has(r)) score.set(r, (score.get(r) ?? 0) + 1) }))
    return [...score].sort((a, b) => b[1] - a[1] || (byId.get(a[0])!.y - byId.get(b[0])!.y)).slice(0, 4).map(([i]) => byId.get(i)!).filter(Boolean)
  }, [linked, byId, id])

  const Chip = ({ eid }: { eid: string }) => {
    const e = byId.get(eid); if (!e) return null
    return (
      <button data-bio-link={eid} onClick={() => (hasBio(eid) ? readBio(eid) : open(eid))} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs hover:border-gold">
        <i className="size-2 rounded-full" style={{ background: KIND_COLOR[e.kind] }} aria-hidden />{e.name}<TrTag e={e} />
      </button>
    )
  }
  const jump = (sid: string) => document.getElementById(`sec-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const sectionIds = [...def.sections.map((s) => s.id), 'connections', 'sources']
  const nRead = def.sections.filter((s) => read.has(s.id)).length

  if (!p) return <p className="py-10 text-center text-slate-400" role="status">…</p>
  return (
    <article ref={root} aria-labelledby="bio-title" className="relative">
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-line/60" role="progressbar" aria-label={t('bio.reading')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(scroll * 100)}>
        <div className="h-full bg-gold transition-[width] duration-150" style={{ width: `${scroll * 100}%` }} />
      </div>

      <button onClick={onBack} className="mb-3 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-gold">← {t('bio.back')}</button>

      <header className="rounded-2xl border border-gold/30 bg-panel/80 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded-full px-2 py-0.5 text-ink" style={{ background: KIND_COLOR[entity.kind] }}>{t(`kinds.${entity.kind}`)}</span>
          <span>{t(`periods.${entity.period}`)}</span>
        </div>
        <h2 id="bio-title" className="mt-2 text-balance font-display text-4xl text-gold2 md:text-5xl" {...ar}>{p.title}</h2>
        <p className="mt-1 text-lg text-slate-200" {...ar}>{p.subtitle}</p>

        {lang !== 'ar' && (
          <div role="note" className={`mt-4 rounded-lg border px-3 py-2 text-xs ${mode === 'approved' && !showAr ? 'border-jade/50 bg-jade/10 text-emerald-200' : mode === 'draft' && !showAr ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-line bg-ink/50 text-slate-300'}`}>
            <b>{t(showAr || mode === 'pending' ? 'tr.pillPending' : mode === 'approved' ? 'tr.pillApproved' : 'tr.pillDraft')}</b>
            {mode === 'draft' && !showAr && <> — {t('tr.draftNote')}</>}
            {mode === 'approved' && !showAr && packs?.tr?.translation && <div className="mt-0.5 opacity-80">{t('tr.reviewedBy', { by: packs.tr.translation.reviewed_by, at: packs.tr.translation.reviewed_at })}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {canFlip && <button onClick={() => setShowAr(!showAr)} aria-pressed={showAr} className="rounded-lg border border-line px-3 py-1 text-gold2 hover:border-gold">{showAr ? t('tr.viewTranslation') : t('tr.viewOriginal')}</button>}
              {mode === 'pending' && packs?.tr && <button onClick={() => setDrafts(true)} className="rounded-lg border border-gold/60 px-3 py-1 text-gold2 hover:bg-gold/10">{t('tr.preview')}</button>}
              {mode === 'draft' && !showAr && <button onClick={() => setDrafts(false)} className="rounded-lg border border-line px-3 py-1 text-slate-200 hover:border-gold">{t('tr.back')}</button>}
            </div>
          </div>
        )}
        <div className="mt-3 rounded-lg border border-line bg-ink/50 p-3 text-sm text-slate-300">
          <div className="text-[11px] uppercase tracking-wide opacity-70">{t('verification.title')}</div>
          <div className="mt-0.5"><VerifyLabel s={verif.status} /> — {t(`verification.${verif.status}.desc`)}</div>
          {verif.reviewed_by && <div className="mt-1 text-xs opacity-80">{t('verification.reviewedBy', { by: verif.reviewed_by, at: verif.reviewed_at })}</div>}
          <p className="mt-1 text-xs text-slate-400">{t('bio.pageStatus')}</p>
        </div>
      </header>

      {/* mobile: sticky chip bar · desktop: sticky side navigation */}
      <div className="mt-4 grid gap-5 lg:grid-cols-[230px_1fr]">
        <nav aria-label={t('bio.contents')} className="sticky top-1 z-30 -mx-4 overflow-x-auto border-b border-line bg-ink/95 px-4 py-2 lg:top-4 lg:mx-0 lg:self-start lg:overflow-visible lg:rounded-2xl lg:border lg:bg-panel/70 lg:p-3">
          <div className="hidden text-xs font-semibold text-gold lg:block">{t('bio.contents')}</div>
          <div className="hidden pb-2 text-[11px] text-slate-400 lg:block" aria-live="polite">{t('bio.progress', { n: nRead, total: def.sections.length })}</div>
          <ol className="flex gap-1 lg:flex-col">
            {sectionIds.map((s) => (
              <li key={s} className="shrink-0">
                <button onClick={() => jump(s)} aria-current={active === s ? 'location' : undefined} className={`w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-start text-sm lg:whitespace-normal ${active === s ? 'bg-gold/20 text-gold2' : 'text-slate-300 hover:bg-panel2'}`}>
                  <span aria-hidden className="me-1 inline-block w-3 text-emerald-300">{read.has(s) ? '✓' : ''}</span>
                  {s === 'connections' ? t('bio.connections') : s === 'sources' ? t('bio.sources') : p.sections[s]}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-5">
          <section aria-labelledby="glance" className="rounded-2xl border border-line bg-panel/70 p-4">
            <h3 id="glance" className="mb-3 text-sm font-semibold text-gold">{t('bio.glance')}</h3>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {def.facts.map((f) => (
                <div key={f.id} className="min-w-0">
                  <dt className="flex flex-wrap items-center gap-2 text-xs text-slate-400">{p.facts[f.id].label}<CertBadge c={f.certainty} /></dt>
                  <dd className="mt-0.5 text-sm text-slate-100" {...ar}>{p.facts[f.id].value}{[...f.src].sort((a, b) => num(a) - num(b)).map((s) => <sup key={s} className="ms-0.5"><a href="#sources" onClick={(e) => { e.preventDefault(); jump('sources') }} className="text-gold2" title={book(def.sources[s][0])}>[{num(s)}]</a></sup>)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="journey" className="rounded-2xl border border-line bg-panel/70 p-4">
            <h3 id="journey" className="text-sm font-semibold text-gold">{t('bio.journey')}</h3>
            <p className="mb-3 text-xs text-slate-400">{t('bio.journeyHint')}</p>
            <ol className="relative space-y-2 border-s border-gold/30 ps-4">
              {def.journey.map((j) => {
                const e = j.entity ? byId.get(j.entity) : undefined
                const inner = (<>
                  <span className="font-medium text-slate-100" {...ar}>{p.journey[j.id].label}</span>
                  <span className="text-xs text-slate-400" {...ar}><bdi>{p.journey[j.id].when}</bdi></span>
                  <CertBadge c={j.certainty} />
                </>)
                return (
                  <li key={j.id} className="relative">
                    <i className="absolute -start-[21px] top-2 size-2.5 rounded-full bg-gold" aria-hidden />
                    {e ? <button data-bio-link={e.id} onClick={() => (hasBio(e.id) ? readBio(e.id) : open(e.id))} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-start hover:bg-panel2">{inner}</button> : <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5">{inner}</div>}
                  </li>
                )
              })}
            </ol>
          </section>

          {def.sections.map((s) => (
            <section key={s.id} id={`sec-${s.id}`} data-sec={s.id} aria-labelledby={`h-${s.id}`} className="scroll-mt-16 rounded-2xl border border-line bg-panel/70 p-4 md:p-5">
              <h3 id={`h-${s.id}`} className="font-display text-2xl text-gold2" {...ar}>{p.sections[s.id]}</h3>
              <div className="mt-3 space-y-4">
                {s.claims.map((c) => (
                  <div key={c.id} className="border-s-2 border-line ps-3">
                    <p className="leading-8 text-slate-200" {...ar}>{p.claims[c.id]}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <CertBadge c={c.certainty} />
                      {c.src.length ? [...c.src].sort((a, b) => num(a) - num(b)).map((x) => <a key={x} href="#sources" onClick={(e) => { e.preventDefault(); jump('sources') }} title={`${book(def.sources[x][0])} — ${loc(def.sources[x][1])}`} className="rounded border border-line px-1.5 text-gold2 hover:border-gold">[{num(x)}]</a>) : <span className="text-slate-500">{t('bio.noSource')}</span>}
                      {c.links?.map((l) => <Chip key={l} eid={l} />)}
                    </div>
                  </div>
                ))}
              </div>
              {!!s.links?.length && <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">{s.links.map((l) => <Chip key={l} eid={l} />)}</div>}
            </section>
          ))}

          <section id="sec-connections" data-sec="connections" aria-labelledby="h-conn" className="scroll-mt-16 rounded-2xl border border-line bg-panel/70 p-4 md:p-5">
            <h3 id="h-conn" className="font-display text-2xl text-gold2">{t('bio.connections')}</h3>
            {([['events', linked.event], ['people', linked.person], ['places', linked.place]] as const).map(([k, es]) => !!es.length && (
              <div key={k} className="mt-3"><h4 className="mb-1.5 text-xs font-semibold text-gold">{t(`bio.${k}`)}</h4><div className="flex flex-wrap gap-2">{es.map((e) => <Chip key={e.id} eid={e.id} />)}</div></div>
            ))}
            <div className="mt-3"><h4 className="mb-1.5 text-xs font-semibold text-gold">{t('bio.periods')}</h4>
              <div className="flex flex-wrap gap-2">{def.periods.map((pe: Period) => <button key={pe} onClick={() => browse(pe)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-gold">{t(`periods.${pe}`)}</button>)}</div></div>
          </section>

          <section id="sec-sources" data-sec="sources" aria-labelledby="h-src" className="scroll-mt-16 rounded-2xl border border-line bg-panel/70 p-4 md:p-5">
            <h3 id="h-src" className="font-display text-2xl text-gold2">{t('bio.sources')}</h3>
            <p className="mt-1 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-200">{t('bio.sourceNote')}</p>
            <ol className="mt-3 space-y-1.5 text-sm text-slate-300" {...ar}>
              {srcOrder.map((s, i) => <li key={s} id={`src-${i + 1}`}><span className="text-gold2">[{i + 1}]</span> <b>{book(def.sources[s][0])}</b> — {loc(def.sources[s][1])}</li>)}
            </ol>
            <h4 className="mb-1 mt-4 text-xs font-semibold text-gold">{t('detail.sources')}</h4>
            <ul className="list-disc space-y-1 ps-5 text-sm text-slate-400" lang="ar" dir="rtl">{entity.sources.map(([ti, r]) => <li key={ti + r}><b>{ti}</b> — {r}</li>)}</ul>
          </section>

          <nav aria-label={`${t('bio.prev')} / ${t('bio.next')}`} className="grid gap-3 sm:grid-cols-2">
            {(['prev', 'next'] as const).map((k) => {
              const e = def.neighbors?.[k] ? byId.get(def.neighbors[k]!) : undefined
              return e ? (
                <button key={k} data-bio-link={e.id} data-nav={k} onClick={() => (hasBio(e.id) ? readBio(e.id) : open(e.id))} className={`rounded-2xl border border-line bg-panel/70 p-4 text-start hover:border-gold ${k === 'next' ? 'sm:text-end' : ''}`}>
                  <div className="text-xs text-slate-400">{k === 'prev' ? '← ' : ''}{t(`bio.${k}`)}{k === 'next' ? ' →' : ''}</div>
                  <div className="mt-1 font-display text-xl text-gold2">{e.name}</div>
                </button>
              ) : <span key={k} />
            })}
          </nav>

          {!!recs.length && (
            <section aria-labelledby="h-rec"><h3 id="h-rec" className="mb-2 font-display text-2xl text-gold2">{t('bio.recommended')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {recs.map((e) => (
                  <button key={e.id} data-bio-link={e.id} data-rec onClick={() => (hasBio(e.id) ? readBio(e.id) : open(e.id))} className="rounded-xl border border-line bg-panel p-3 text-start hover:border-gold/60">
                    <div className="flex items-center justify-between gap-2"><b className="font-medium text-gold2">{e.name}</b><span className="flex gap-1"><TrTag e={e} />{!viewed.has(e.id) && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-gold2">{t('progress.new')}</span>}</span></div>
                    <div className="mt-0.5 text-xs text-slate-400">{t(`kinds.${e.kind}`)} · {t(`periods.${e.period}`)}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-300">{e.summary}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="text-center"><button onClick={() => scrollTo({ top: 0, behavior: 'smooth' })} className="rounded-full border border-line px-4 py-1.5 text-xs text-slate-300 hover:border-gold">↑ {t('bio.top')}</button></div>
        </div>
      </div>
    </article>
  )
}
