import { useEffect, useMemo, useState } from 'react'
import { api, EdLog, EdRow, Me } from './api'
import { Btn, Card, inp } from './ui'
import { Index, bundledFields, byId as entById } from './model'
import { buildRegistry, BIO_DEFS } from '../editorial/records'
import { BACKLOG, REQUIRED_STEPS } from '../editorial/backlog'
import { CLASSIFICATIONS, HIST_REVIEWS, EditorialRecord, HistReview, Classification, SourceRef, TLang, TransStatus } from '../editorial/types'
import { TRANSITIONS, transStatus } from '../editorial/rules'
import { EVENTS } from '../chrono/def'
import arChrono from '../chrono/ar.json'
import frChrono from '../chrono/fr.json'
import enChrono from '../chrono/en.json'
import esChrono from '../chrono/es.json'
import umAr from '../bio/umar/ar.json'
import umFr from '../bio/umar/fr.json'
import umEn from '../bio/umar/en.json'
import umEs from '../bio/umar/es.json'
import abAr from '../bio/abubakr/ar.json'
import abFr from '../bio/abubakr/fr.json'
import abEn from '../bio/abubakr/en.json'
import abEs from '../bio/abubakr/es.json'

const REG = buildRegistry()
const REVIEW_LABEL: Record<HistReview, string> = { PENDING_REVIEW: 'Pending review', IN_REVIEW: 'In review', VERIFIED: 'Verified', NEEDS_REVISION: 'Needs revision' }
const CLASS_LABEL: Record<string, string> = { ESTABLISHED: 'Established', DISPUTED: 'Disputed', UNCERTAIN: 'Uncertain', NONE: 'Not classified' }
const TRANS_LABEL: Record<TransStatus, string> = { DRAFT: 'Draft', IN_REVIEW: 'In review', APPROVED: 'Approved' }
const TYPE_LABEL: Record<string, string> = { entity: 'Entity', stage: 'Stage', biography: 'Biography', claim: 'Claim' }
const RC: Record<HistReview, string> = { PENDING_REVIEW: 'border-line bg-ink/50 text-slate-300', IN_REVIEW: 'border-sky/50 bg-sky/10 text-sky-200', VERIFIED: 'border-jade/50 bg-jade/10 text-emerald-200', NEEDS_REVISION: 'border-rose-500/50 bg-rose-500/10 text-rose-200' }
const CC: Record<string, string> = { ESTABLISHED: 'border-jade/40 text-emerald-200', DISPUTED: 'border-amber-500/50 text-amber-200', UNCERTAIN: 'border-orange-400/50 text-orange-200', NONE: 'border-line text-slate-400' }
const TC: Record<TransStatus, string> = { DRAFT: 'border-line text-slate-300', IN_REVIEW: 'border-sky/50 text-sky-200', APPROVED: 'border-jade/50 text-emerald-200' }
const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap'
const RChip = ({ s }: { s: HistReview }) => <span className={`${chip} ${RC[s]}`} title="Historical review"><span aria-hidden>{s === 'VERIFIED' ? '✔' : s === 'IN_REVIEW' ? '🔍' : s === 'NEEDS_REVISION' ? '↩' : '⏳'}</span>{REVIEW_LABEL[s]}</span>
const CChip = ({ c }: { c: string | null }) => <span className={`${chip} ${CC[c ?? 'NONE']}`} title="Account classification (how the sources present it)">{CLASS_LABEL[c ?? 'NONE']}</span>
const TChips = ({ t }: { t: Record<TLang, TransStatus> }) => <span className="inline-flex flex-wrap gap-1" title="Translation status per language">{(['fr', 'en', 'es'] as TLang[]).map((l) => <span key={l} className={`${chip} ${TC[t[l]]}`}>{l.toUpperCase()} {TRANS_LABEL[t[l]]}</span>)}</span>

/** Bundled defaults overlaid with the database row (if any) and the live translation rows. Three axes stay separate. */
export function effective(r: EditorialRecord, ix: Index): EditorialRecord {
  const row = ix.ed.get(r.id)
  const out: EditorialRecord = { ...r }
  if (row) {
    out.review = row.review_status as HistReview
    out.classification = (row.classification as Classification | null) ?? r.classification
    out.reviewer = row.reviewed_by ? { name: row.reviewed_by, role: (row.reviewer_role as 'editor' | 'reviewer') ?? 'reviewer' } : undefined
    out.reviewedAt = row.reviewed_at ?? undefined; out.reviewedSources = row.reviewed_sources ?? []; out.notes = row.review_notes ?? undefined
  }
  if (r.type === 'entity') out.translations = Object.fromEntries((['fr', 'en', 'es'] as TLang[]).map((l) => [l, ix.tr.has(r.key + '/' + l) ? transStatus(ix.tr.get(r.key + '/' + l)!.translation_status) : r.translations[l]])) as Record<TLang, TransStatus>
  return out
}
const incompleteCount = (r: EditorialRecord) => r.sourceIds.filter((i) => REG.sources.get(i)?.completeness === 'incomplete').length
const link = (id: string) => `#/record/${encodeURIComponent(id)}`

export function Editorial({ ix }: { ix: Index }) {
  const [f, setF] = useState({ type: '', review: '', cls: '', trans: '', inc: '', q: '' })
  const [more, setMore] = useState(100)
  const recs = useMemo(() => REG.records.map((r) => effective(r, ix)), [ix])
  const rows = recs.filter((r) =>
    (!f.type || r.type === f.type) && (!f.review || r.review === f.review) && (!f.cls || (f.cls === 'NONE' ? !r.classification : r.classification === f.cls)) &&
    (!f.trans || (['fr', 'en', 'es'] as TLang[]).some((l) => r.translations[l] === f.trans)) && (!f.inc || (f.inc === 'yes' ? incompleteCount(r) > 0 : incompleteCount(r) === 0)) &&
    (!f.q.trim() || (r.id + ' ' + r.label).toLowerCase().includes(f.q.trim().toLowerCase())))
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setMore(100) }
  const S = (k: keyof typeof f, label: string, opts: [string, string][]) => <select aria-label={label} className="rounded-lg border border-line bg-ink/60 px-2 py-2 text-sm" value={f[k]} onChange={set(k)}><option value="">{label}: all</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  const cnt = (g: (r: EditorialRecord) => string) => recs.reduce<Record<string, number>>((a, r) => ((a[g(r)] = (a[g(r)] ?? 0) + 1), a), {})
  const byReview = cnt((r) => r.review), byClass = cnt((r) => r.classification ?? 'NONE')
  const incompleteSources = [...REG.sources.values()].filter((s) => s.completeness === 'incomplete').length
  const approvedTr = recs.reduce((a, r) => a + (['fr', 'en', 'es'] as TLang[]).filter((l) => r.translations[l] === 'APPROVED').length, 0)
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-line bg-panel/60 p-3 text-xs leading-6 text-slate-300">
        Three separate axes: <b>historical review</b> (has a qualified reviewer checked it?), <b>classification</b> (how do the sources present it?) and <b>translation status</b> (per language). None is ever derived from another: an established account is not verified, and an approved translation is not a verified history.
        Review decisions made here are stored in the database tables <code>editorial_records</code> / <code>editorial_log</code>; the public app does not read them yet.
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-slate-400">Records</div><div className="mt-1 text-3xl text-gold2">{recs.length}</div><div className="text-[11px] text-slate-400">{Object.entries(cnt((r) => TYPE_LABEL[r.type])).map(([k, v]) => `${k} ${v}`).join(' · ')}</div></Card>
        <Card><div className="text-xs text-slate-400">Historical review</div><div className="mt-1 text-xs leading-6">{HIST_REVIEWS.map((s) => <div key={s}>{REVIEW_LABEL[s]}: <b>{byReview[s] ?? 0}</b></div>)}</div></Card>
        <Card><div className="text-xs text-slate-400">Classification</div><div className="mt-1 text-xs leading-6">{['ESTABLISHED', 'DISPUTED', 'UNCERTAIN', 'NONE'].map((s) => <div key={s}>{CLASS_LABEL[s]}: <b>{byClass[s] ?? 0}</b></div>)}</div></Card>
        <Card><div className="text-xs text-slate-400">Sources &amp; translations</div><div className="mt-1 text-xs leading-6"><div>Incomplete references: <b>{incompleteSources}</b> of {REG.sources.size}</div><div>Approved translations: <b>{approvedTr}</b> of {recs.length * 3}</div></div></Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <input type="search" aria-label="Search records" placeholder="Search id or Arabic label…" className={inp + ' max-w-xs'} value={f.q} onChange={set('q')} />
        {S('type', 'Type', Object.entries(TYPE_LABEL))}
        {S('review', 'Review', HIST_REVIEWS.map((s) => [s, REVIEW_LABEL[s]]))}
        {S('cls', 'Classification', Object.entries(CLASS_LABEL))}
        {S('trans', 'Translation', (['DRAFT', 'IN_REVIEW', 'APPROVED'] as TransStatus[]).map((s) => [s, TRANS_LABEL[s]]))}
        {S('inc', 'Sources', [['yes', 'Has incomplete'], ['no', 'All complete']])}
      </div>
      <p className="text-xs text-slate-400" aria-live="polite">{rows.length} of {recs.length} records</p>
      <ul className="space-y-2">
        {rows.slice(0, more).map((r) => (
          <li key={r.id}><a href={link(r.id)} className="block rounded-2xl border border-line bg-panel/70 p-3 hover:border-gold">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="rounded border border-line px-1.5 text-[11px] text-slate-300">{TYPE_LABEL[r.type]}{r.subtype ? ` · ${r.subtype}` : ''}</span>
              <span className="font-display text-lg text-gold2" lang="ar" dir="rtl">{r.label}</span><span className="text-xs text-slate-400">{r.id}</span></div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><RChip s={r.review} /><CChip c={r.classification} /><TChips t={r.translations} />
              {incompleteCount(r) > 0 && <span className={`${chip} border-amber-500/40 text-amber-200`}>⚠ {incompleteCount(r)} incomplete source{incompleteCount(r) > 1 ? 's' : ''}</span>}</div>
          </a></li>
        ))}
      </ul>
      {rows.length > more && <Btn onClick={() => setMore(more + 100)}>Show more</Btn>}
    </div>
  )
}

type Block = { label: string; text: string }
const BIO_TEXT: Record<string, Record<string, { claims: Record<string, string>; title: string; subtitle: string }>> = { umar: { ar: umAr, fr: umFr, en: umEn, es: umEs }, abubakr: { ar: abAr, fr: abFr, en: abEn, es: abEs } } as never
const CHRONO: Record<string, { groups: Record<string, { title: string; range: string; intro: string }> }> = { ar: arChrono, fr: frChrono, en: enChrono, es: esChrono }

/** Arabic original + a translation as plain labelled blocks, for side-by-side comparison. */
function texts(r: EditorialRecord, lang: string, ix: Index): Block[] {
  if (r.type === 'entity') {
    const e = entById.get(r.key)!
    const f = lang === 'ar' ? (e as unknown as Record<string, string>) : ((ix.tr.get(r.key + '/' + lang)?.fields ?? bundledFields(r.key, lang as never)) as Record<string, string>)
    return (['name', 'when', 'summary', 'bio', 'context', 'disputed'] as const).filter((k) => f[k]).map((k) => ({ label: k, text: f[k] }))
  }
  if (r.type === 'stage') { const g = CHRONO[lang].groups[r.key]; return [{ label: 'title', text: g.title }, { label: 'range', text: g.range }, { label: 'intro', text: g.intro }] }
  const b = BIO_TEXT[r.key.split(':')[0]][lang]
  if (r.type === 'biography') return [{ label: 'title', text: b.title }, { label: 'subtitle', text: b.subtitle }]
  return [{ label: 'claim', text: b.claims[r.key.split(':')[1]] }]
}

export function RecordView({ rid, me, ix, reload }: { rid: string; me: Me; ix: Index; reload: () => Promise<Index> }) {
  const base = REG.byId.get(rid)
  const r = base ? effective(base, ix) : null
  const [lang, setLang] = useState<TLang>('fr')
  const [log, setLog] = useState<EdLog[]>([])
  const [checked, setChecked] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [cls, setCls] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const loadLog = () => api.edLog(rid).then(setLog).catch(() => setLog([]))
  useEffect(() => { loadLog() }, [rid]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setChecked(r?.reviewedSources ?? []) }, [r?.review, r?.reviewedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!r || !base) return <Card>Unknown record. <a className="text-gold2 underline" href="#/editorial">Back to the list</a></Card>

  const isReviewer = me.role === 'reviewer'
  const can = (to: HistReview) => TRANSITIONS[r.review].includes(to)
  const run = async (label: string, to: HistReview, classification: string | null = null) => {
    setBusy(true); setMsg(null)
    try { await api.edReview(rid, r.type, to, classification, to === 'VERIFIED' ? checked : [], notes); await reload(); await loadLog(); setMsg({ ok: true, text: label }); setNotes('') }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    setBusy(false)
  }
  const srcs = r.sourceIds.map((i) => REG.sources.get(i)).filter((s): s is SourceRef => !!s)
  const ar = texts(r, 'ar', ix), tl = texts(r, lang, ix)
  const verifyOk = checked.length > 0 && notes.trim().length > 0
  const claims = r.type === 'biography' ? REG.records.filter((c) => c.type === 'claim' && c.subtype === r.key).map((c) => effective(c, ix)) : []
  const ev = r.type === 'entity' ? EVENTS.find((x) => x.id === r.key) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Btn onClick={() => (location.hash = '#/editorial')}>← Back</Btn>
        <h2 className="font-display text-3xl text-gold2" lang="ar" dir="rtl">{r.label}</h2>
        <span className="text-sm text-slate-400">{TYPE_LABEL[r.type]}{r.subtype ? ` · ${r.subtype}` : ''} · {r.id}</span>
        {r.type === 'entity' && <a className="text-xs text-sky hover:underline" href={`#/entity/${r.key}?${lang}`}>Open in the translation editor →</a>}
      </div>
      <div className="flex flex-wrap items-center gap-2"><RChip s={r.review} /><CChip c={r.classification} /><TChips t={r.translations} /></div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg border px-3 py-2 text-sm ${msg.ok ? 'border-jade/50 bg-jade/10 text-emerald-200' : 'border-rose-500/50 bg-rose-500/10 text-rose-200'}`}>{msg.text}</p>}

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-gold">Arabic original vs translation</h3>
          <div role="tablist" aria-label="Translation language" className="flex gap-1">{(['fr', 'en', 'es'] as TLang[]).map((l) => <button key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)} className={`rounded-lg border px-3 py-1 text-xs ${lang === l ? 'border-gold bg-gold/20 text-gold2' : 'border-line text-slate-300'}`}>{l.toUpperCase()}</button>)}</div>
          <span className={`${chip} ${TC[r.translations[lang]]}`}>{lang.toUpperCase()} translation: {TRANS_LABEL[r.translations[lang]]}</span>
          <span className="text-xs text-slate-400">Translation status is independent of the historical review.</span></div>
        <div className="space-y-3">
          {ar.map((b, i) => (
            <div key={b.label} className="grid gap-2 md:grid-cols-2">
              <div><div className="mb-1 text-xs text-slate-400">{b.label} — Arabic (original)</div><p lang="ar" dir="rtl" className="whitespace-pre-wrap rounded-lg border border-line bg-ink/40 p-3 text-sm leading-7">{b.text}</p></div>
              <div><div className="mb-1 text-xs text-slate-400">{b.label} — {lang.toUpperCase()} (read-only)</div><p className="whitespace-pre-wrap rounded-lg border border-line bg-ink/40 p-3 text-sm leading-7">{tl[i]?.text ?? <span className="text-slate-500">—</span>}</p></div>
            </div>
          ))}
        </div>
      </Card>

      {!!claims.length && (
        <Card><h3 className="mb-2 text-sm font-semibold text-gold">Claims in this biography ({claims.length})</h3>
          <ul className="grid gap-1 sm:grid-cols-2">{claims.map((c) => <li key={c.id}><a href={link(c.id)} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-panel2"><RChip s={c.review} /><CChip c={c.classification} /><span className="truncate text-slate-300">{c.key.split(':')[1]}</span></a></li>)}</ul></Card>
      )}
      {r.type === 'biography' && <Card><h3 className="mb-1 text-sm font-semibold text-gold">Biography structure</h3><p className="text-xs text-slate-400">{BIO_DEFS.find((b) => b.id === r.key)!.sections.length} sections; each claim is its own record with its own classification and sources.</p></Card>}
      {ev && <Card><h3 className="mb-1 text-sm font-semibold text-gold">Timeline</h3><p className="text-xs text-slate-300">Stage {ev.group.slice(1)} · category {ev.cat} · classification as presented by the sources: {ev.certainty}. <a className="text-sky hover:underline" href={link(`stage:${ev.group}`)}>Stage record →</a></p></Card>}

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-gold">Source references ({srcs.length})</h3>
        <p className="mb-2 text-xs text-slate-400">Fields stay empty until someone checks the edition. Existing chapter-level references are kept and marked incomplete. Tick the references you actually checked before verifying.</p>
        {!srcs.length ? <p className="text-sm text-slate-400">No sources recorded for this record.</p> : (
          <ul className="space-y-2">
            {srcs.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-ink/40 p-3 text-xs">
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-[#d9a94a]" checked={checked.includes(s.id)} disabled={!isReviewer || !can('VERIFIED')} onChange={(e) => setChecked(e.target.checked ? [...checked, s.id] : checked.filter((x) => x !== s.id))} aria-label={`Reviewed: ${s.work} — ${s.locator}`} />
                  <span className="min-w-0 flex-1"><span lang="ar" dir="rtl" className="block text-sm text-slate-100"><b>{s.work}</b> — {s.locator}</span>
                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-slate-400">
                      {([['Author', s.author], ['Chapter / section', s.chapter], ['Volume', s.volume], ['Page', s.page], ['Hadith no.', s.hadithNo], ['Verse', s.verse], ['Edition', s.edition], ['Publisher', s.publisher], ['URL', s.url]] as [string, string | undefined][]).map(([k, v]) => <span key={k}>{k}: {v ? <b className="text-slate-200">{v}</b> : <i className="text-slate-500">—</i>}</span>)}
                      <span>Passage: <i className="text-slate-500">{s.passage?.verified ? s.passage.text : 'none verified'}</i></span></span>
                    <span className="mt-1 flex flex-wrap items-center gap-2"><span className={`${chip} ${s.completeness === 'complete' ? 'border-jade/40 text-emerald-200' : 'border-amber-500/40 text-amber-200'}`}>{s.completeness === 'complete' ? '✔ complete locator' : '⚠ incomplete'}</span>
                      <span className="text-slate-500">supports {s.supports.length} record{s.supports.length > 1 ? 's' : ''}</span></span></span></label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-gold">Historical review</h3>
        {r.review === 'VERIFIED' && r.reviewer && <p className="mb-2 rounded-lg border border-jade/40 bg-jade/10 p-2 text-xs text-emerald-200">Verified by {r.reviewer.name} ({r.reviewer.role}) on {r.reviewedAt?.slice(0, 10)} · {r.reviewedSources.length} reviewed source(s). {r.notes}</p>}
        {r.review === 'NEEDS_REVISION' && r.notes && <p className="mb-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">Returned for revision: {r.notes}</p>}
        <label className="block text-sm">Reviewer notes <span className="text-slate-400">(required to verify or return for revision)</span><textarea className={inp + ' mt-1'} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn disabled={busy || !can('IN_REVIEW')} onClick={() => run('Review started.', 'IN_REVIEW')}>Start review</Btn>
          <Btn kind="gold" disabled={busy || !isReviewer || !can('VERIFIED') || !verifyOk} title={!isReviewer ? 'Only a reviewer can verify' : !checked.length ? 'Tick the sources you checked' : !notes.trim() ? 'Notes are required' : undefined} onClick={() => run('Marked as verified.', 'VERIFIED')}>Mark VERIFIED</Btn>
          <Btn kind="danger" disabled={busy || !isReviewer || !can('NEEDS_REVISION') || !notes.trim()} onClick={() => run('Returned for revision.', 'NEEDS_REVISION')}>Return for revision</Btn>
          <Btn disabled={busy || !can('PENDING_REVIEW')} onClick={() => run('Moved back to pending.', 'PENDING_REVIEW')}>Back to pending</Btn>
          <Btn disabled={busy || !notes.trim()} onClick={async () => { setBusy(true); try { await api.edNote(rid, notes); await loadLog(); setMsg({ ok: true, text: 'Note added.' }); setNotes('') } catch (x) { setMsg({ ok: false, text: (x as Error).message }) } setBusy(false) }}>Add note only</Btn>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><label className="flex items-center gap-2">Classification
          <select aria-label="Classification" className="rounded-lg border border-line bg-ink/60 px-2 py-1.5 text-sm" disabled={!isReviewer || r.review === 'VERIFIED'} value={cls || r.classification || ''} onChange={(e) => setCls(e.target.value)}><option value="" disabled>Not classified</option>{CLASSIFICATIONS.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}</select></label>
          <Btn disabled={busy || !isReviewer || !cls || cls === r.classification || !notes.trim() || r.review === 'VERIFIED'} onClick={() => run('Classification saved.', r.review, cls)}>Save classification</Btn></div>
        <p className="mt-2 text-xs text-slate-400">
          {r.review === 'PENDING_REVIEW' ? 'A record must be put IN REVIEW before it can be verified — there is no shortcut, and an ESTABLISHED classification never verifies a record.' : !isReviewer ? 'Your role is editor: you can start a review and add notes; a reviewer verifies or returns records.' : 'Reviewer name and date are recorded by the server, not typed in.'}
          {' '}Changing a classification needs a note and a reviewer; a VERIFIED record must be reopened first.
        </p>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-gold">Review history</h3>
        {!log.length ? <p className="text-sm text-slate-400">No recorded activity yet.</p> : (
          <ol className="space-y-2">{log.map((l) => (
            <li key={l.id} className="rounded-lg border border-line bg-ink/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><b className="capitalize">{l.action}</b>{l.to_status && <span className="text-xs text-slate-300">{l.from_status} → {l.to_status}</span>}{l.classification && <CChip c={l.classification} />}
                <span className="ms-auto text-xs text-slate-400">{l.actor_name} · {new Date(l.at).toLocaleString('en-CA', { hour12: false }).slice(0, 16)}</span></div>
              {!!l.reviewed_sources?.length && <p className="mt-1 text-xs text-slate-400">Reviewed sources: {l.reviewed_sources.length}</p>}
              {l.notes && <p className="mt-1 whitespace-pre-wrap text-slate-300">{l.notes}</p>}
            </li>))}</ol>
        )}
      </Card>
    </div>
  )
}

export function Backlog() {
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-line bg-panel/60 p-3 text-xs leading-6 text-slate-300">Events that are <b>not represented yet</b>. This list holds no historical detail on purpose: no dates, no accounts, no outcomes. It is a local file (<code>src/editorial/backlog.ts</code>), not a database table.</p>
      <Card><h3 className="mb-2 text-sm font-semibold text-gold">Required before an item can be added</h3><ol className="list-decimal space-y-1 ps-5 text-sm text-slate-300">{REQUIRED_STEPS.map((s) => <li key={s}>{s}</li>)}</ol></Card>
      <ul className="space-y-2">{BACKLOG.map((b) => (
        <li key={b.id} className="rounded-2xl border border-line bg-panel/70 p-3">
          <div className="flex flex-wrap items-baseline gap-x-3"><span className="font-display text-xl text-gold2" lang="ar" dir="rtl">{b.nameAr}</span><span className="text-sm text-slate-200">{b.nameLatin}</span><code className="text-xs text-slate-400">{b.id}</code>
            <span className={`${chip} border-line text-slate-300 ms-auto`}>{b.status}</span><span className="text-xs text-slate-400">stage hint: {b.stageHint}</span></div>
          <p className="mt-1 text-xs text-slate-400">{b.rationale}</p>
          <p className="mt-1 text-xs text-slate-500">Identified sources: {b.sources.length ? b.sources.join('; ') : 'none yet'}</p>
        </li>))}</ul>
    </div>
  )
}
