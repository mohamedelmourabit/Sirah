import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import cytoscape from 'cytoscape'
import { useApp } from './ctx'
import { Kind, KIND_COLOR, Period } from './data'

const MAIN = ['makkah', 'madinah', 'badr', 'uhud', 'hudaybiyyah', 'fath', 'companions', 'hijra']
// gold line icons (24x24) drawn inside the main circular nodes
const ICONS: Record<string, string> = {
  makkah: '<rect x="4" y="7" width="16" height="13" rx="1"/><path d="M4 11h16M10 14h4v6h-4z"/>',
  madinah: '<path d="M5 20v-8a7 7 0 0 1 14 0v8M3 20h18M12 3v2M10 20v-4a2 2 0 0 1 4 0v4"/>',
  badr: '<path d="M5 19 17 7M19 19 7 7M15 5h4v4M9 5H5v4M4 20l2-2M20 20l-2-2"/>',
  uhud: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 8v6M9 11h6"/>',
  hudaybiyyah: '<path d="M7 3h8l3 3v15H7zM15 3v3h3M10 10h5M10 14h5M10 18h3"/>',
  fath: '<path d="M5 21V9a7 7 0 0 1 14 0v12M9 21v-8h6v8M3 21h18"/>',
  companions: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 1.5 6 5"/>',
  hijra: '<path d="M3 17c4-1 6-6 9-6s4 3 9 2M17 8l4 5-5 3"/><circle cx="5" cy="19" r="1.5"/>',
}
const icon = (id: string) =>
  ICONS[id] ? 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f0cf8a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[id]}</svg>`) : undefined

const PERIOD_KEYS: Period[] = ['pre', 'mecca', 'hijra', 'medina']
const TOGGLES: { k: Kind | 'rel'; label: string; color: string }[] = [
  { k: 'event', label: 'map.events', color: KIND_COLOR.event },
  { k: 'person', label: 'map.people', color: KIND_COLOR.person },
  { k: 'place', label: 'map.places', color: KIND_COLOR.place },
  { k: 'rel', label: 'map.relations', color: '#6b7f9e' },
]

export default function MapPanel({ tall }: { tall?: boolean }) {
  const { t } = useTranslation()
  const { all, sel, open } = useApp()
  const box = useRef<HTMLDivElement>(null)
  const cy = useRef<cytoscape.Core>()
  const [off, setOff] = useState<Set<string>>(new Set())
  const [period, setPeriod] = useState<Period | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; name: string; sub: string } | null>(null)

  const elements = useMemo(() => {
    const ids = new Set(all.map((e) => e.id))
    const rest = all.filter((e) => e.id !== 'muhammad' && !MAIN.includes(e.id)).sort((a, b) => a.y - b.y)
    const pos = new Map<string, { x: number; y: number }>([['muhammad', { x: 0, y: 0 }]])
    const ring = (list: string[], r: number, phase = 0) =>
      list.forEach((id, i) => {
        const a = phase + (i / list.length) * Math.PI * 2 - Math.PI / 2
        pos.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r })
      })
    ring(MAIN.filter((i) => ids.has(i)), 270)
    // chronological neighbours alternate between two radii: more room for labels, nothing overlaps
    rest.forEach((e, i) => {
      const a = 0.2 + (i / rest.length) * Math.PI * 2 - Math.PI / 2, r = rest.length % 2 && i === rest.length - 1 ? 515 : i % 2 ? 590 : 440 // odd count: the last node (next to the first) gets a middle radius
      pos.set(e.id, { x: Math.cos(a) * r, y: Math.sin(a) * r })
    })
    // label side: outward, away from the centre (right/left on the flanks, above/below at top/bottom)
    const side = (id: string) => { const p = pos.get(id) ?? { x: 0, y: 0 }, c = p.x / (Math.hypot(p.x, p.y) || 1); return c > 0.35 ? 'r' : c < -0.35 ? 'l' : p.y < 0 ? 't' : 'b' }
    const nodes = all.map((e) => ({
      data: { id: e.id, label: e.id === 'muhammad' ? t('map.center') : e.name, tip: `${t(`kinds.${e.kind}`)} · ${t(`periods.${e.period}`)}`, kind: e.kind, period: e.period, main: MAIN.includes(e.id) ? 1 : 0, icon: icon(e.id), side: side(e.id) },
      position: pos.get(e.id) ?? { x: 0, y: 0 },
    }))
    const seen = new Set<string>()
    const edges = all.flatMap((e) =>
      e.rel
        .filter((r) => ids.has(r))
        .map((r) => ({ data: { id: [e.id, r].sort().join('~'), source: e.id, target: r } }))
        .filter((x) => !seen.has(x.data.id) && seen.add(x.data.id)),
    )
    return [...nodes, ...edges]
  }, [all, t])

  // init
  useEffect(() => {
    const c = cytoscape({
      container: box.current,
      elements,
      layout: { name: 'preset' },
      minZoom: 0.25,
      maxZoom: 2.5,
      style: [
        { selector: 'node', style: { label: 'data(label)', color: '#e6ecf5', 'font-size': 25, 'font-family': 'IBM Plex Sans Arabic', 'text-valign': 'bottom', 'text-margin-y': 8, 'text-wrap': 'wrap', 'text-max-width': '130px', 'min-zoomed-font-size': 9, width: 34, height: 34, 'border-width': 2, 'border-color': '#0a1830', 'background-color': '#3f86d6' } },
        { selector: 'node[side="r"]', style: { 'text-halign': 'right', 'text-valign': 'center', 'text-margin-x': 8, 'text-margin-y': 0, 'text-justification': 'left' } },
        { selector: 'node[side="l"]', style: { 'text-halign': 'left', 'text-valign': 'center', 'text-margin-x': -8, 'text-margin-y': 0, 'text-justification': 'right' } },
        { selector: 'node[side="t"]', style: { 'text-valign': 'top', 'text-margin-y': -8 } },
        { selector: 'node[kind="event"]', style: { 'background-color': KIND_COLOR.event } },
        { selector: 'node[kind="place"]', style: { 'background-color': KIND_COLOR.place } },
        { selector: 'node[kind="group"]', style: { 'background-color': KIND_COLOR.group } },
        { selector: 'node[main=1]', style: { width: 84, height: 84, 'font-size': 26, 'font-weight': 600, 'min-zoomed-font-size': 0, 'text-halign': 'center', 'text-valign': 'bottom', 'text-margin-x': 0, 'text-margin-y': 12, 'border-color': '#f0cf8a', 'background-color': '#0e2140', 'border-width': 3, 'background-image': 'data(icon)', 'background-width': '62%', 'background-height': '62%', 'underlay-color': '#d9a94a', 'underlay-opacity': 0.18, 'underlay-padding': 8, 'underlay-shape': 'ellipse' } },
        { selector: 'node#muhammad', style: { width: 150, height: 150, 'underlay-shape': 'ellipse', 'background-color': '#0a1830', 'border-color': '#d9a94a', 'border-width': 5, 'text-valign': 'center', 'text-halign': 'center', 'text-margin-x': 0, 'text-margin-y': 0, 'min-zoomed-font-size': 0, color: '#f0cf8a', 'font-size': 26, 'text-max-width': '120px', 'font-family': 'Amiri', 'underlay-color': '#d9a94a', 'underlay-opacity': 0.25, 'underlay-padding': 12 } },
        { selector: 'edge', style: { width: 1, 'line-color': '#2a4a7a', opacity: 0.22, 'curve-style': 'straight' } },
        { selector: 'node.dim', style: { opacity: 0.25 } },
        { selector: 'edge.dim', style: { display: 'none' } }, // only the selected node's direct relations stay visible
        { selector: 'node.nb, node.sel', style: { 'min-zoomed-font-size': 0, 'z-index': 10, 'text-background-color': '#060d1a', 'text-background-opacity': 0.85, 'text-background-padding': '3px', 'text-background-shape': 'roundrectangle' } },
        { selector: 'node.sel', style: { 'border-color': '#fff', 'border-width': 4, 'underlay-color': '#d9a94a', 'underlay-opacity': 0.4, 'underlay-padding': 10, 'underlay-shape': 'ellipse' } },
        { selector: 'edge.hl', style: { 'line-color': '#d9a94a', opacity: 0.9, width: 2 } },
      ],
    })
    c.on('tap', 'node', (ev) => open(ev.target.id()))
    const hideTip = () => setTip(null)
    c.on('mouseover', 'node', (ev) => { const n = ev.target; setTip({ x: ev.renderedPosition.x, y: ev.renderedPosition.y, name: n.data('label'), sub: n.id() === 'muhammad' ? '' : n.data('tip') }) })
    c.on('mouseout', 'node', hideTip)
    c.on('viewport drag', hideTip)
    c.fit(undefined, 80)
    const ro = new ResizeObserver(() => { c.resize(); c.fit(undefined, 80) })
    ro.observe(box.current!)
    cy.current = c
    return () => { ro.disconnect(); c.destroy() }
  }, [elements])

  // selection highlight
  useEffect(() => {
    const c = cy.current
    if (!c) return
    box.current!.dataset.selected = sel && c.getElementById(sel).nonempty() ? sel : '' // what is highlighted (also read by the browser tests)
    c.batch(() => {
      c.elements().removeClass('sel dim hl nb')
      const n = sel ? c.getElementById(sel) : null
      if (n && n.nonempty()) {
        const hood = n.closedNeighborhood()
        c.elements().not(hood).addClass('dim')
        n.addClass('sel')
        n.neighborhood('node').addClass('nb')
        n.connectedEdges().addClass('hl')
      }
    })
    if (sel) {
      const n = c.getElementById(sel)
      if (n.nonempty()) c.animate({ center: { eles: n.closedNeighborhood() } }, { duration: 300 }) // neighbourhood stays in view
    }
  }, [sel, elements])

  // filters
  useEffect(() => {
    const c = cy.current
    if (!c) return
    c.batch(() => {
      c.nodes().forEach((n) => {
        const hide = off.has(n.data('kind')) && n.id() !== 'muhammad'
        n.style('display', hide ? 'none' : 'element')
        n.style('opacity', period && n.data('period') !== period && n.id() !== 'muhammad' ? 0.18 : 1)
      })
      c.edges().style('display', off.has('rel') ? 'none' : 'element')
    })
  }, [off, period, elements])

  const zoom = (f: number) => cy.current?.zoom({ level: cy.current.zoom() * f, renderedPosition: { x: box.current!.clientWidth / 2, y: box.current!.clientHeight / 2 } })
  const flip = (k: string) => setOff((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_240px]" aria-label={t('map.aria')}>
      <div className={`rings relative overflow-hidden rounded-2xl border border-line bg-panel/70 ${tall ? 'h-[70vh]' : 'h-[520px] md:h-[calc(100vh-290px)] md:min-h-[600px]'}`}>
        <div className="absolute start-3 top-3 z-10 max-w-[220px] rounded-xl border border-line bg-panel/90 p-3 text-xs">
          <b className="text-sm text-gold2">{t('map.discoverTitle')}</b>
          <p className="mt-1 text-slate-400">{t('map.discoverText')}</p>
        </div>
        <div className="absolute inset-0">
          <div ref={box} style={{ width: '100%', height: '100%' }} role="application" aria-label={t('map.canvas')} />
        </div>
        <div className="absolute bottom-3 end-3 z-10 flex flex-col gap-1">
          {[['+', () => zoom(1.3), t('map.zoomIn')], ['−', () => zoom(1 / 1.3), t('map.zoomOut')], ['◎', () => cy.current?.fit(undefined, 80), t('map.fit')]].map(([t, fn, l]) => (
            <button key={l as string} aria-label={l as string} onClick={fn as () => void} className="grid size-9 place-items-center rounded-lg border border-line bg-panel text-gold2 hover:bg-panel2">{t as string}</button>
          ))}
        </div>
        {tip && (
          <div role="tooltip" className="pointer-events-none absolute z-20 max-w-[220px] -translate-x-1/2 rounded-lg border border-gold/50 bg-panel px-3 py-1.5 text-xs shadow-lg" style={{ left: tip.x, top: tip.y + 22 }}>
            <b className="block text-gold2">{tip.name}</b>{tip.sub && <span className="text-slate-300">{tip.sub}</span>}
          </div>
        )}
        <p className="absolute bottom-3 start-3 z-10 max-w-[70%] rounded-lg border border-line bg-panel/90 px-3 py-1.5 text-[11px] text-slate-400">{t('map.hint')} · {t('map.zoomHint')}</p>
      </div>

      <aside className="rounded-2xl border border-line bg-panel/70 p-4">
        <div role="group" aria-label={t('map.filter')} className="space-y-2">
          {TOGGLES.map((f) => (
            <label key={f.k} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#d9a94a]" checked={!off.has(f.k)} onChange={() => flip(f.k)} />
              <i className="size-2.5 rounded-full" style={{ background: f.color }} />
              {t(f.label)}
            </label>
          ))}
        </div>
        <h3 className="mb-2 mt-5 text-sm font-semibold text-gold2">{t('map.periods')}</h3>
        <ul className="space-y-1">
          <li><button onClick={() => setPeriod(null)} className={`w-full rounded-lg px-2 py-1.5 text-start text-sm ${!period ? 'bg-gold/20 text-gold2' : 'text-slate-300 hover:bg-panel2'}`}>{t('map.all')}</button></li>
          {PERIOD_KEYS.map((p) => (
            <li key={p}>
              <button onClick={() => setPeriod(period === p ? null : p)} className={`w-full rounded-lg px-2 py-1.5 text-start text-sm ${period === p ? 'bg-gold/20 text-gold2' : 'text-slate-300 hover:bg-panel2'}`}>{t(`periods.${p}`)}</button>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  )
}
