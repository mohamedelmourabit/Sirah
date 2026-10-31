import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGS } from './i18n'
import { Ctx, View, useApp } from './ctx'
import { SAMPLE } from './data'
import { loadEntities, loadPack, sb, useProgress } from './lib'
import { localize, Pack } from './content'
import { TrTag, VerifyLabel, VSTATUS_ORDER } from './status'
import MapPanel from './MapPanel'
import Timeline from './Timeline'
import Directory from './Directory'
import Detail from './Detail'
import SearchBox from './SearchBox'
import Browse, { ViewToggle } from './Browse'
import type { Period } from './data'

const NAV: [View, string][] = [
  ['home', '🏠'],
  ['timeline', '⏳'],
  ['map', '🕸'],
  ['browse', '🗂'],
  ['people', '👥'],
  ['events', '📅'],
  ['places', '📍'],
  ['sources', '📖'],
]

function Skyline() {
  return (
    <svg viewBox="0 0 600 160" preserveAspectRatio="xMaxYMax slice" className="absolute inset-0 size-full opacity-80" aria-hidden>
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d2a3a" /><stop offset="1" stopColor="#050b16" /></linearGradient></defs>
      <path d="M0 160V120l60-18 60 25 70-35 60 40V160zM380 160v-60q40-60 80 0v60zM470 160V40l8-22 8 22v120zM520 160V70l6-18 6 18v90zM560 160V90l5-14 5 14v70z" fill="url(#g)" />
      <path d="M410 100q0-30 30-30t30 30z" fill="#1f6b52" />
      <circle cx="500" cy="22" r="1.5" fill="#f0cf8a" />
    </svg>
  )
}

function AuthModal({ onClose, user }: { onClose: () => void; user: string | null }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const send = async () => {
    const { error } = await sb!.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } })
    setMsg(error ? error.message : t('account.sent'))
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-gold/40 bg-panel p-5">
        <h2 className="font-display text-2xl text-gold2">{t('account.title')}</h2>
        <p className="mt-1 text-sm text-slate-400">{t('account.desc')}</p>
        {!sb ? (
          <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">{t('account.off')}</p>
        ) : user ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>{t('account.signedAs')} <b>{user}</b></p>
            <button onClick={() => sb!.auth.signOut().then(onClose)} className="w-full rounded-lg border border-line py-2 hover:bg-panel2">{t('account.signOut')}</button>
          </div>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); send() }}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('account.email')} dir="ltr" className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold" />
            <button className="w-full rounded-lg bg-gold py-2 text-sm font-semibold text-ink">{t('account.send')}</button>
            {msg && <p className="text-sm text-gold2" aria-live="polite">{msg}</p>}
          </form>
        )}
        <button onClick={onClose} className="mt-3 w-full text-sm text-slate-400 hover:text-white">{t('account.continue')}</button>
      </div>
    </div>
  )
}

function Sources() {
  const { t } = useTranslation()
  const { all, open } = useApp()
  const by = useMemo(() => {
    const m = new Map<string, { id: string; name: string; ref: string }[]>()
    all.forEach((e) => e.sources.forEach(([t, ref]) => m.set(t, [...(m.get(t) ?? []), { id: e.id, name: e.name, ref }])))
    return [...m].sort((a, b) => b[1].length - a[1].length)
  }, [all])
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel p-4 text-sm text-slate-300">
        <p>{t('sourcesPage.legend')}</p>
        <ul className="mt-2 space-y-1.5">
          {VSTATUS_ORDER.map((v) => <li key={v}><VerifyLabel s={v} /> — {t(`verification.${v}.desc`)}</li>)}
        </ul>
      </section>
      {by.map(([title, items]) => (
        <section key={title} className="rounded-xl border border-line bg-panel p-4">
          <h3 className="font-display text-xl text-gold2">{title}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {items.map((i) => <li key={i.id}><button onClick={() => open(i.id)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-gold" title={i.ref}>{i.name}</button></li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function LangSwitch() {
  const { t, i18n } = useTranslation()
  return (
    <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-ink/60 px-3 py-1 text-xs hover:border-gold">
      <span aria-hidden>🌐</span>
      <span className="sr-only">{t('lang.label')}</span>
      <select value={i18n.resolvedLanguage} onChange={(e) => i18n.changeLanguage(e.target.value)} className="cursor-pointer bg-transparent outline-none">
        {LANGS.map((l) => <option key={l.code} value={l.code} lang={l.code} dir={l.dir} className="bg-ink text-white">{l.label}</option>)}
      </select>
    </label>
  )
}

/** Non-Arabic UI: says which text is shown and lets the reader preview unreviewed drafts. */
function TranslationBar({ drafts, setDrafts, approved, total }: { drafts: boolean; setDrafts: (v: boolean) => void; approved: number; total: number }) {
  const { t, i18n } = useTranslation()
  if (i18n.resolvedLanguage === 'ar') return null
  return (
    <div role="region" aria-label={t('lang.label')} className={`mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5 text-xs ${drafts ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-line bg-panel/60 text-slate-300'}`}>
      <p className="min-w-0 flex-1" aria-live="polite">{drafts ? t('tr.barDraft') : t('tr.bar', { n: approved, total })}</p>
      <button onClick={() => setDrafts(!drafts)} aria-pressed={drafts} className="rounded-full border border-gold/60 px-3 py-1 text-gold2 hover:bg-gold/10">
        {drafts ? t('tr.back') : t('tr.preview')}
      </button>
    </div>
  )
}

export default function App() {
  const { t, i18n } = useTranslation()
  const [base, setAll] = useState(SAMPLE)
  const [packSt, setPackSt] = useState<{ lang: string; p: Pack | null }>({ lang: 'ar', p: null })
  const pack = packSt.lang === (i18n.resolvedLanguage ?? 'ar') ? packSt.p : null // never apply another language's pack
  const [view, setView] = useState<View>('home')
  const [sel, setSel] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [bperiod, setBperiod] = useState<Period | undefined>() // period chosen from search -> list filter
  const [auth, setAuth] = useState(false)
  const { viewed, mark, user } = useProgress()
  useEffect(() => { loadEntities().then(setAll) }, [])
  const [arPack, setArPack] = useState<Pack | null>(null)
  useEffect(() => {
    let live = true
    const lang = i18n.resolvedLanguage ?? 'ar'
    // Arabic pack (verification of the original) + the selected language's pack; any failure -> bundled content
    Promise.all([loadPack('ar'), lang === 'ar' ? null : loadPack(lang)])
      .then(([a, p]) => live && (setArPack(a), setPackSt({ lang, p })))
      .catch(() => live && (setArPack(null), setPackSt({ lang, p: null })))
    return () => { live = false }
  }, [i18n.resolvedLanguage])
  const [drafts, setDraftsState] = useState(() => { try { return localStorage.getItem('sira.drafts') === '1' } catch { return false } })
  const setDrafts = (v: boolean) => { setDraftsState(v); try { localStorage.setItem('sira.drafts', v ? '1' : '0') } catch { /* private mode */ } }
  const all = useMemo(() => localize(base, arPack, pack, drafts), [base, arPack, pack, drafts])
  const orig = useMemo(() => new Map(localize(base, arPack, null).map((e) => [e.id, e])), [base, arPack])
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e])), [all])

  const ctx = {
    all, byId, orig, viewed, sel,
    open: (id: string) => { setSel(id); setDrawer(true); mark(id) },
    go: (v: View) => { setView(v); setDrawer(false); scrollTo({ top: 0 }) },
  }
  // search result -> map highlight + detail drawer (switch to the map unless it is already on screen)
  const pickEntity = (id: string) => { if (view !== 'home' && view !== 'map') setView('map'); ctx.open(id) }
  const pickPeriod = (p: Period) => { setBperiod(p); ctx.go('browse') }
  const title = t(`nav.${view}`)
  const pct = Math.round((all.filter((e) => viewed.has(e.id)).length / all.length) * 100)

  return (
    <Ctx.Provider value={ctx}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-ink/90 md:flex">
        <div className="p-5 text-center">
          <div className="font-display text-3xl text-gold2">{t('app.title')}</div>
          <div className="text-[11px] text-slate-400">{t('app.tagline')}</div>
        </div>
        <nav className="flex-1" aria-label={t('nav.label')}>
          {NAV.map(([v, ic]) => (
            <button key={v} onClick={() => ctx.go(v)} aria-current={view === v} className={`flex w-full items-center gap-3 border-l-4 px-5 py-3 text-start text-sm ${view === v ? 'border-gold bg-gold/15 text-gold2' : 'border-transparent text-slate-300 hover:bg-panel2'}`}>
              <span aria-hidden>{ic}</span>{t(`nav.${v}`)}
            </button>
          ))}
        </nav>
        <div className="p-4 text-xs text-slate-400">
          <div className="mb-1 flex justify-between"><span>{t('progress.yours')}</span><span>{pct}%</span></div>
          <div className="h-1.5 rounded bg-line"><div className="h-full rounded bg-gold" style={{ width: `${pct}%` }} /></div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-ink/95 py-1.5 md:hidden" aria-label={t('nav.label')}>
        {NAV.slice(0, 5).map(([v, ic]) => (
          <button key={v} onClick={() => ctx.go(v)} aria-current={view === v} className={`flex flex-col items-center px-2 text-[10px] ${view === v ? 'text-gold2' : 'text-slate-400'}`}>
            <span className="text-lg" aria-hidden>{ic}</span>{t(`nav.${v}`)}
          </button>
        ))}
      </nav>

      <main className="pb-24 md:pl-56 md:pb-8">
        <header className="relative z-20 border-b border-line bg-gradient-to-b from-[#16305a] via-[#0b1a33] to-ink">
          <div className="absolute inset-0 overflow-hidden" aria-hidden><Skyline /></div>
          <div className="relative flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setAuth(true)} className="rounded-full border border-line bg-ink/60 px-3 py-1 text-xs hover:border-gold">{user ? `👤 ${user}` : t('account.browse')}</button>
              <LangSwitch />
            </div>
            <span className="rounded-full bg-ink/60 px-3 py-1 text-xs text-slate-300">{t('progress.count', { n: viewed.size, total: all.length })}</span>
          </div>
          <div className="relative px-4 pb-8 pt-2 text-center">
            <h1 className="text-balance break-words font-display text-5xl text-gold2 drop-shadow md:text-6xl">{view === 'home' ? t('app.title') : title}</h1>
            <p className="mb-5 mt-1 text-slate-200">{t('app.tagline')}</p>
            <SearchBox onPick={pickEntity} onPeriod={pickPeriod} />
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-5 p-4">
          <TranslationBar drafts={drafts} setDrafts={setDrafts} approved={all.filter((e) => e.tr === 'approved').length} total={all.length} />
          {view === 'home' && (<>
            <ViewToggle view="map" go={ctx.go} />
            <MapPanel />
            <Timeline compact />
            <section className="grid gap-4 rounded-2xl border border-line bg-panel/50 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {(t('features', { returnObjects: true }) as { icon: string; title: string; desc: string }[]).map(({ icon, title: ft, desc }) => (
                <div key={ft} className="text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-full border border-gold/60 text-xl" aria-hidden>{icon}</div>
                  <h3 className="mt-2 font-semibold text-gold2">{ft}</h3>
                  <p className="mt-1 text-xs leading-6 text-slate-400">{desc}</p>
                </div>
              ))}
            </section>
            <p className="py-2 text-center font-display text-xl text-gold">◆ {t('app.slogan')} ◆</p>
          </>)}
          {view === 'timeline' && <Timeline />}
          {view === 'map' && <><ViewToggle view="map" go={ctx.go} /><MapPanel tall /></>}
          {view === 'browse' && <><ViewToggle view="browse" go={ctx.go} /><Browse key={bperiod} period={bperiod} /></>}
          {view === 'people' && <Directory kind="person" />}
          {view === 'events' && <Directory kind="event" />}
          {view === 'places' && <Directory kind="place" />}
          {view === 'sources' && <Sources />}
        </div>
      </main>

      {drawer && <Detail onClose={() => setDrawer(false)} />}
      {auth && <AuthModal user={user} onClose={() => setAuth(false)} />}
    </Ctx.Provider>
  )
}
