import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, Me, sb } from './api'
import { ENTITIES, KIND_LABEL, Index, LANGS, LANG_NAME, PERIOD_LABEL, TR_LABEL, TR_STATUS, V_LABEL, V_STATUS, index, trStatus, vStatus, byId, Lang } from './model'
import { Bar, Btn, Card, TChip, VChip, inp } from './ui'
import Editor from './Editor'

type Phase = 'loading' | 'login' | 'denied' | 'ready' | 'error'
const TR_LANGS: Lang[] = ['fr', 'en', 'es']
const route = () => decodeURIComponent(location.hash.replace(/^#\/?/, ''))

export default function Admin() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [ix, setIx] = useState<Index | null>(null)
  const [err, setErr] = useState('')
  const [hash, setHash] = useState(route())

  useEffect(() => { const h = () => setHash(route()); addEventListener('hashchange', h); return () => removeEventListener('hashchange', h) }, [])

  const reload = useCallback(async () => { const d = await api.load(); const n = index(d.tr, d.ver); setIx(n); return n }, [])
  const enter = useCallback(async (signedIn: boolean) => {
    if (!signedIn) { setMe(null); setIx(null); return setPhase('login') }
    try {
      const m = await api.me()
      if (!m) { setMe(null); return setPhase('denied') } // signed in but not on the reviewers list
      setMe(m); await reload(); setPhase('ready')
    } catch (e) { setErr((e as Error).message); setPhase('error') }
  }, [reload])

  useEffect(() => {
    if (!sb) return
    const { data } = sb.auth.onAuthStateChange((_ev, s) => { setTimeout(() => enter(!!s), 0) }) // fires INITIAL_SESSION too
    return () => data.subscription.unsubscribe()
  }, [enter])

  if (!sb) return <Center title="Not configured"><p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (anon key only) and rebuild. The dashboard needs Supabase for sign-in and storage; the public app keeps working without it.</p></Center>
  if (phase === 'loading') return <Center title="Loading…" />
  if (phase === 'login') return <Login />
  if (phase === 'denied') return <Center title="Not authorized"><p>This account is signed in but is not on the reviewers list, so it cannot see or change any editorial content. Ask an administrator to add you.</p><Btn className="mt-4" onClick={() => api.signOut()}>Sign out</Btn></Center>
  if (phase === 'error') return <Center title="Could not load"><p role="alert">{err}</p><Btn className="mt-4" onClick={() => location.reload()}>Retry</Btn></Center>
  if (!me || !ix) return null

  const [path, q] = hash.split('?')
  const id = path.startsWith('entity/') ? path.slice(7) : null
  const view = id ? 'entities' : (['overview', 'queue', 'entities'].includes(path) ? path : 'overview')
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-3 border-b border-line py-4">
        <h1 className="font-display text-2xl text-gold2">Content Review</h1>
        <nav aria-label="Dashboard" className="flex gap-1">
          {[['overview', 'Overview'], ['queue', 'Review queue'], ['entities', 'Entities']].map(([k, l]) => (
            <a key={k} href={`#/${k}`} aria-current={view === k ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 text-sm ${view === k ? 'bg-gold/20 text-gold2' : 'text-slate-300 hover:bg-panel2'}`}>{l}</a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-3 text-sm text-slate-300">
          <span><b className="text-slate-100">{me.display_name}</b> · {me.role}</span>
          <Btn onClick={() => api.signOut()}>Sign out</Btn>
        </div>
      </header>
      <main className="pt-5">
        {id && byId.has(id) ? <Editor key={id} id={id} lang0={q} me={me} ix={ix} reload={reload} /> : view === 'queue' ? <Queue ix={ix} /> : view === 'entities' ? <Entities ix={ix} /> : <Overview ix={ix} />}
      </main>
    </div>
  )
}

function Center({ title, children }: { title: string; children?: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center px-4"><Card className="max-w-md text-sm text-slate-300"><h1 className="mb-2 font-display text-2xl text-gold2">{title}</h1>{children}</Card></main>
}

function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const go = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { await api.signIn(email, pw) } catch (x) { setErr((x as Error).message) } setBusy(false) }
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={go} className="w-full max-w-sm space-y-3 rounded-2xl border border-gold/40 bg-panel p-6">
        <h1 className="font-display text-2xl text-gold2">Content Review</h1>
        <p className="text-sm text-slate-400">Editorial dashboard — authorized editors and reviewers only. The public app needs no login.</p>
        <label className="block text-sm">Email<input className={inp + ' mt-1'} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block text-sm">Password<input className={inp + ' mt-1'} type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
        <Btn kind="gold" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Btn>
      </form>
    </main>
  )
}

function Overview({ ix }: { ix: Index }) {
  const count = (langs: Lang[], f: (id: string, l: Lang) => string) => { const c: Record<string, number> = {}; for (const e of ENTITIES) for (const l of langs) c[f(e.id, l)] = (c[f(e.id, l)] ?? 0) + 1; return c }
  const T = count(TR_LANGS, (id, l) => trStatus(ix, id, l)!), V = count(LANGS, (id, l) => vStatus(ix, id, l))
  const n = ENTITIES.length
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{n} entities × 4 languages = {n * 4} review records ({n * 3} translations + {n * 4} historical checks). The two tracks are independent.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Translations approved', `${T.reviewed ?? 0} / ${n * 3}`], ['Waiting for review', `${T.submitted ?? 0}`], ['Historically verified', `${V.VERIFIED ?? 0} / ${n * 4}`]].map(([l, v]) => (
          <Card key={l}><div className="text-xs text-slate-400">{l}</div><div className="mt-1 text-3xl text-gold2">{v}</div></Card>
        ))}
      </div>
      <Card><h2 className="mb-3 text-sm font-semibold text-gold">Translation review, by language</h2>
        <div className="space-y-4">{TR_LANGS.map((l) => <div key={l}><div className="mb-1 text-sm">{LANG_NAME[l]}</div><Bar counts={count([l], (id, x) => trStatus(ix, id, x)!)} order={TR_STATUS} label={TR_LABEL} /></div>)}</div></Card>
      <Card><h2 className="mb-3 text-sm font-semibold text-gold">Historical verification, by language</h2>
        <div className="space-y-4">{LANGS.map((l) => <div key={l}><div className="mb-1 text-sm">{LANG_NAME[l]}</div><Bar counts={count([l], (id, x) => vStatus(ix, id, x))} order={V_STATUS} label={V_LABEL} /></div>)}</div></Card>
    </div>
  )
}

function Queue({ ix }: { ix: Index }) {
  const [s, setS] = useState<string>('submitted')
  const rows = ENTITIES.flatMap((e) => TR_LANGS.filter((l) => trStatus(ix, e.id, l) === s).map((l) => ({ e, l, r: ix.tr.get(e.id + '/' + l) })))
    .sort((a, b) => (a.r?.updated_at ?? '').localeCompare(b.r?.updated_at ?? ''))
  const counts = Object.fromEntries(TR_STATUS.map((k) => [k, ENTITIES.reduce((a, e) => a + TR_LANGS.filter((l) => trStatus(ix, e.id, l) === k).length, 0)]))
  return (
    <div>
      <div role="tablist" aria-label="Translation status" className="mb-4 flex flex-wrap gap-1">
        {(['submitted', 'rejected', 'reviewed', 'draft'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={s === k} onClick={() => setS(k)} className={`rounded-lg px-3 py-1.5 text-sm ${s === k ? 'bg-gold/20 text-gold2' : 'text-slate-300 hover:bg-panel2'}`}>
            {k === 'submitted' ? 'Pending review' : k === 'reviewed' ? 'Approved' : TR_LABEL[k]} <span className="text-slate-400">({counts[k]})</span>
          </button>
        ))}
      </div>
      {!rows.length ? <p className="text-sm text-slate-400">Nothing here.</p> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-panel/70">
          {rows.map(({ e, l, r }) => (
            <li key={e.id + l}><a href={`#/entity/${e.id}?${l}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-panel2">
              <span className="font-display text-lg text-gold2" lang="ar" dir="rtl">{e.name}</span>
              <span className="rounded border border-line px-1.5 text-xs">{l.toUpperCase()}</span>
              <TChip s={s} />
              <span className="ms-auto text-xs text-slate-400">{s === 'reviewed' && r ? `by ${r.translation_reviewed_by}` : r ? new Date(r.updated_at).toLocaleDateString('en-CA') : 'not in database yet'}</span>
            </a></li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Entities({ ix }: { ix: Index }) {
  const [f, setF] = useState({ q: '', kind: '', period: '', lang: '', t: '', v: '' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const ls = (f.lang ? [f.lang] : LANGS) as Lang[]
    return ENTITIES.filter((e) =>
      (!f.kind || e.kind === f.kind) && (!f.period || e.period === f.period) &&
      (!q || [e.name, e.id, ...TR_LANGS.map((l) => String(ix.tr.get(e.id + '/' + l)?.fields.name ?? ''))].join(' ').toLowerCase().includes(q)) &&
      (!f.t || ls.some((l) => l !== 'ar' && trStatus(ix, e.id, l) === f.t)) && (!f.v || ls.some((l) => vStatus(ix, e.id, l) === f.v)))
  }, [f, ix])
  const sel = 'rounded-lg border border-line bg-ink/60 px-2 py-2 text-sm'
  const S = (k: string, label: string, opts: [string, string][]) => (
    <select aria-label={label} className={sel} value={f[k as keyof typeof f]} onChange={set(k)}><option value="">{label}: all</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  )
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="search" aria-label="Search entities" placeholder="Search name or id…" className={inp + ' max-w-xs'} value={f.q} onChange={set('q')} />
        {S('kind', 'Type', Object.entries(KIND_LABEL))}
        {S('period', 'Period', Object.entries(PERIOD_LABEL))}
        {S('lang', 'Language', LANGS.map((l) => [l, LANG_NAME[l]]))}
        {S('t', 'Translation', TR_STATUS.map((k) => [k, TR_LABEL[k]]))}
        {S('v', 'History', V_STATUS.map((k) => [k, V_LABEL[k]]))}
      </div>
      <p className="mb-2 text-xs text-slate-400" aria-live="polite">{rows.length} of {ENTITIES.length} entities</p>
      <ul className="space-y-2">
        {rows.map((e) => (
          <li key={e.id}><a href={`#/entity/${e.id}`} className="block rounded-2xl border border-line bg-panel/70 p-3 hover:border-gold">
            <div className="flex flex-wrap items-baseline gap-x-3"><span className="font-display text-xl text-gold2" lang="ar" dir="rtl">{e.name}</span><span className="text-xs text-slate-400">{KIND_LABEL[e.kind]} · {PERIOD_LABEL[e.period]} · {e.id}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {LANGS.map((l) => (
                <div key={l} className="space-y-1 rounded-lg bg-ink/40 p-2"><div className="text-[11px] text-slate-400">{l.toUpperCase()}</div>
                  {l !== 'ar' ? <div><TChip s={trStatus(ix, e.id, l)!} /></div> : <div className="text-[11px] text-slate-500">original</div>}
                  <div><VChip s={vStatus(ix, e.id, l)} /></div></div>
              ))}
            </div>
          </a></li>
        ))}
      </ul>
    </div>
  )
}
