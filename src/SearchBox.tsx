import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from './ctx'
import { KIND_COLOR, Period } from './data'
import { onNamesLoaded, searchHits, suggestions, warmNames } from './lib'
import { Cat, highlight } from './search'
import { TrTag } from './status'

const ORDER: Cat[] = ['person', 'event', 'place', 'period']
const COLOR: Record<Cat, string> = { person: KIND_COLOR.person, event: KIND_COLOR.event, place: KIND_COLOR.place, period: '#8aa0c0' }

function Hl({ text, q }: { text: string; q: string }) {
  return <>{highlight(text, q).map(([s, m], i) => (m ? <mark key={i} className="rounded-sm bg-gold/30 px-0.5 text-gold2">{s}</mark> : <span key={i}>{s}</span>))}</>
}

/** Global search: grouped results, highlighted matches, keyboard navigation (↑ ↓ Enter Esc). */
export default function SearchBox({ onPick, onPeriod }: { onPick: (id: string) => void; onPeriod: (p: Period) => void }) {
  const { t } = useTranslation()
  const { all, byId } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [, tick] = useState(0)
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { warmNames(); return onNamesLoaded(() => tick((n) => n + 1)) }, []) // fr/en/es names join the index once loaded

  const query = q.trim()
  const flat = useMemo(() => {
    if (!query) return []
    const hits = searchHits(all, query)
    return ORDER.flatMap((c) => hits.filter((h) => h.doc.cat === c).slice(0, 6))
  }, [all, query, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const sugg = useMemo(() => (query && !flat.length ? suggestions(all, query) : []), [all, query, flat.length])
  useEffect(() => setActive(0), [query])

  const pick = (i: number) => {
    const h = flat[i]; if (!h) return
    if (h.doc.cat === 'period') onPeriod(h.doc.id.slice(7) as Period); else onPick(h.doc.id)
    setQ(''); setOpen(false)
  }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => (flat.length ? (a + 1) % flat.length : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0)) }
    else if (e.key === 'Enter') { if (flat.length) { e.preventDefault(); pick(active) } }
    else if (e.key === 'Escape') { if (open && query) setOpen(false); else setQ('') }
  }
  const show = open && !!query

  return (
    <div ref={box} className="relative mx-auto w-full max-w-xl" onBlur={(e) => !box.current?.contains(e.relatedTarget as Node) && setOpen(false)}>
      <input
        role="combobox" aria-expanded={show} aria-controls={id} aria-autocomplete="list" aria-activedescendant={show && flat.length ? `${id}-${active}` : undefined}
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={key}
        placeholder={t('search.placeholder')} aria-label={t('search.aria')} autoComplete="off" enterKeyHint="search"
        className="w-full rounded-full border border-sky/60 bg-ink/70 px-12 py-3 text-sm outline-none backdrop-blur focus:border-gold"
      />
      <span className="absolute start-4 top-1/2 -translate-y-1/2 opacity-70" aria-hidden>🔍</span>
      {q && <button onClick={() => { setQ(''); setOpen(false); (box.current?.querySelector('input') as HTMLInputElement).focus() }} aria-label={t('search.clear')} className="absolute end-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-slate-300 hover:bg-panel2">✕</button>}
      <p className="sr-only" role="status" aria-live="polite">{show ? (flat.length ? t('search.count', { count: flat.length }) : t('search.noResults')) : ''}</p>

      {show && (
        <div id={id} role="listbox" aria-label={t('search.aria')} className="absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-panel text-start shadow-xl">
          {!flat.length && (
            <div className="space-y-2 p-4 text-sm">
              <p className="font-semibold text-gold2">{t('search.noResults')}</p>
              <p className="text-slate-400">{t('search.noResultsHint')}</p>
              {!!sugg.length && (
                <p className="flex flex-wrap items-center gap-2 text-slate-300">{t('search.didYouMean')}
                  {sugg.map((s) => <button key={s} onClick={() => setQ(s)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-gold">{s}</button>)}</p>
              )}
              <button onClick={() => setQ('')} className="rounded-lg border border-gold/60 px-3 py-1.5 text-xs text-gold2 hover:bg-gold/10">{t('search.clear')}</button>
            </div>
          )}
          {ORDER.map((c) => {
            const rows = flat.map((h, i) => ({ h, i })).filter(({ h }) => h.doc.cat === c)
            if (!rows.length) return null
            return (
              <div key={c} role="group" aria-label={t(`cat.${c}`)}>
                <div className="sticky top-0 border-b border-line bg-panel2 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-gold">{t(`cat.${c}`)}</div>
                {rows.map(({ h, i }) => {
                  const e = byId.get(h.doc.id)
                  return (
                    <div key={h.doc.id} id={`${id}-${i}`} data-id={h.doc.id} role="option" aria-selected={i === active}>
                      <button tabIndex={-1} onMouseDown={(ev) => ev.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}
                        className={`flex w-full items-start gap-3 px-4 py-2.5 text-start text-sm ${i === active ? 'bg-panel2' : ''}`}>
                        <i className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: COLOR[c] }} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2"><b className="font-medium text-slate-100"><Hl text={h.doc.display} q={query} /></b>
                            {e && <><span className="text-[11px] text-slate-400">{t(`kinds.${e.kind}`)} · {t(`periods.${e.period}`)}{e.kind === 'event' ? <> · <bdi>{e.when}</bdi></> : null}</span><TrTag e={e} /></>}</span>
                          {h.via && <span className="block text-xs text-gold2/80" dir="auto">{t('search.alsoKnown', { name: '' })}<Hl text={h.via} q={query} /></span>}
                          {e && <span className="mt-0.5 line-clamp-1 block text-xs text-slate-400">{e.summary}</span>}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <p className="border-t border-line px-4 py-1.5 text-[11px] text-slate-500">{t('search.hint')}</p>
        </div>
      )}
    </div>
  )
}
