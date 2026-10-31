import { useEffect, useState } from 'react'
import { api, LogRow, Me, Ref } from './api'
import { FIELDS, Field, Fields, Index, LANGS, LANG_NAME, TR_LABEL, V_STATUS, V_LABEL, bundledFields, byId, KIND_LABEL, PERIOD_LABEL, Lang } from './model'
import { Btn, Card, TChip, VChip, inp } from './ui'

const FIELD_LABEL: Record<Field, string> = { name: 'Name', when: 'Date', summary: 'Summary', bio: 'Biography', context: 'Context', disputed: 'Note on differing accounts (optional)' }
const today = () => new Date().toLocaleDateString('en-CA')

export default function Editor({ id, lang0, me, ix, reload }: { id: string; lang0?: string; me: Me; ix: Index; reload: () => Promise<Index> }) {
  const e = byId.get(id)!
  const [lang, setLang] = useState<Lang>(LANGS.includes(lang0 as Lang) ? (lang0 as Lang) : 'fr')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [note, setNote] = useState('')
  const [log, setLog] = useState<LogRow[]>([])
  const isAr = lang === 'ar'
  const row = isAr ? undefined : ix.tr.get(id + '/' + lang)
  const status = row?.translation_status ?? 'draft'
  const isReviewer = me.role === 'reviewer'

  // ---- translation form ----
  const initial = (): Fields => (row ? (row.fields as Fields) : bundledFields(id, lang))
  const [form, setForm] = useState<Fields>(initial)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { setForm(initial()); setDirty(false) }, [lang, row?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (k: Field, v: string) => { setForm({ ...form, [k]: v }); setDirty(true) }

  // ---- verification form ----
  const v = ix.ver.get(id + '/' + lang)
  const [vs, setVs] = useState(v?.status ?? 'PENDING_REVIEW'), [vnote, setVnote] = useState(v?.note ?? ''), [refs, setRefs] = useState<Ref[]>(v?.refs ?? [])
  useEffect(() => { setVs(v?.status ?? 'PENDING_REVIEW'); setVnote(v?.note ?? ''); setRefs(v?.refs ?? []) }, [lang, v?.reviewed_at, v?.status, v?.note]) // eslint-disable-line react-hooks/exhaustive-deps
  const vNeeds = vs !== 'PENDING_REVIEW'

  const loadLog = () => api.log(id).then(setLog).catch(() => setLog([]))
  useEffect(() => { loadLog() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (label: string, fn: () => Promise<unknown>, clearNote = true) => {
    setBusy(true); setMsg(null)
    try { await fn(); await reload(); await loadLog(); setMsg({ ok: true, text: label }); if (clearNote) setNote('') }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    setBusy(false)
  }
  const clean = () => Object.fromEntries(Object.entries(form).filter(([k, v]) => k === 'sources' || (typeof v === 'string' && v.trim() !== '')))
  const own = !!row && [row.last_edited_by, row.submitted_by].includes(me.user_id)
  const goLang = (l: Lang) => { if (dirty && !confirm('Discard unsaved changes?')) return; setLang(l) }
  const back = () => { if (dirty && !confirm('Discard unsaved changes?')) return; location.hash = '#/entities' }
  const entries = log.filter((l) => l.lang === lang)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Btn onClick={back}>← Back</Btn>
        <h2 className="font-display text-3xl text-gold2" lang="ar" dir="rtl">{e.name}</h2>
        <span className="text-sm text-slate-400">{KIND_LABEL[e.kind]} · {PERIOD_LABEL[e.period]} · {e.id}</span>
      </div>

      <div role="tablist" aria-label="Language" className="flex flex-wrap gap-1">
        {LANGS.map((l) => (
          <button key={l} role="tab" aria-selected={lang === l} onClick={() => goLang(l)} className={`rounded-lg border px-3 py-1.5 text-sm ${lang === l ? 'border-gold bg-gold/20 text-gold2' : 'border-line text-slate-300 hover:bg-panel2'}`}>{LANG_NAME[l]}</button>
        ))}
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg border px-3 py-2 text-sm ${msg.ok ? 'border-jade/50 bg-jade/10 text-emerald-200' : 'border-rose-500/50 bg-rose-500/10 text-rose-200'}`}>{msg.text}</p>}

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gold">{isAr ? 'Arabic original (read-only)' : `${LANG_NAME[lang]} translation vs. Arabic original`}</h3>
          {!isAr && <><TChip s={status} />{!row && <span className="text-xs text-slate-400">bundled draft — not saved to the database yet</span>}</>}
          {row?.translation_reviewed_by && status === 'reviewed' && <span className="text-xs text-slate-400">approved by {row.translation_reviewed_by} on {row.translation_reviewed_at?.slice(0, 10)}</span>}
        </div>
        {status === 'reviewed' && !isAr && <p className="mb-3 text-xs text-amber-200">Saving a change to an approved translation withdraws its approval until it is reviewed again.</p>}
        <div className="space-y-4">
          {FIELDS.map((k) => {
            const orig = (e as unknown as Record<string, string | undefined>)[k]
            if (isAr && !orig) return null
            return (
              <div key={k} className="grid gap-2 md:grid-cols-2">
                <div><div className="mb-1 text-xs text-slate-400">{FIELD_LABEL[k]} — Arabic</div>
                  <p lang="ar" dir="rtl" className="min-h-10 whitespace-pre-wrap rounded-lg border border-line bg-ink/40 p-3 text-sm leading-7">{orig || <span className="text-slate-500">—</span>}</p></div>
                {!isAr && (
                  <label className="block"><span className="mb-1 block text-xs text-slate-400">{FIELD_LABEL[k]} — {LANG_NAME[lang]}</span>
                    {k === 'name' || k === 'when'
                      ? <input className={inp} value={form[k] ?? ''} onChange={(ev) => edit(k, ev.target.value)} />
                      : <textarea className={inp + ' min-h-24 leading-6'} rows={k === 'bio' ? 7 : 3} value={form[k] ?? ''} onChange={(ev) => edit(k, ev.target.value)} />}
                  </label>
                )}
              </div>
            )
          })}
        </div>
        {!isAr && (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <label className="block text-sm">Reviewer / editor note <span className="text-slate-400">(required to reject)</span>
              <textarea className={inp + ' mt-1'} rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} /></label>
            <div className="flex flex-wrap gap-2">
              <Btn kind="gold" disabled={busy || !dirty} onClick={() => run('Draft saved.', () => api.save(id, lang, clean(), note))}>Save draft</Btn>
              <Btn disabled={busy || dirty || status !== 'draft' || !row} title={dirty ? 'Save the draft first' : !row ? 'Save the draft first' : undefined} onClick={() => run('Submitted for review.', () => api.submit(id, lang, note))}>Submit for review</Btn>
              <Btn kind="gold" disabled={busy || !isReviewer || status !== 'submitted' || own} onClick={() => run('Translation approved.', () => api.review(id, lang, 'approve', note))}>Approve translation</Btn>
              <Btn kind="danger" disabled={busy || !isReviewer || status !== 'submitted' || own || !note.trim()} onClick={() => run('Translation rejected.', () => api.review(id, lang, 'reject', note))}>Reject</Btn>
              <Btn disabled={busy || !note.trim()} onClick={() => run('Note added.', () => api.note(id, lang, 'translation', note))}>Add note only</Btn>
            </div>
            <p className="text-xs text-slate-400">
              {!isReviewer ? 'Your role is editor: you can save and submit; a reviewer must approve or reject.'
                : status !== 'submitted' ? 'Approve / reject is available once a draft has been submitted.'
                : own ? 'You edited or submitted this text, so a different reviewer must approve or reject it.' : 'Approving here says nothing about historical accuracy — that is the separate check below.'}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-gold">Historical verification — {LANG_NAME[lang]}</h3><VChip s={v?.status ?? 'PENDING_REVIEW'} />
          <span className="text-xs text-slate-400">independent of translation review</span></div>
        {v?.reviewed_by && <p className="mb-3 text-xs text-slate-400">Reviewed by {v.reviewed_by} on {v.reviewed_at?.slice(0, 10)}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">Status
            <select className={inp + ' mt-1'} disabled={!isReviewer} value={vs} onChange={(ev) => setVs(ev.target.value)}>{V_STATUS.map((k) => <option key={k} value={k}>{V_LABEL[k]}</option>)}</select></label>
          <div className="text-sm"><div>Reviewer</div><div className="mt-1 rounded-lg border border-line bg-ink/40 px-3 py-2">{vNeeds ? `${me.display_name} · ${today()}` : <span className="text-slate-500">recorded on approval</span>}</div></div>
        </div>
        <label className="mt-3 block text-sm">Reviewer note {vs === 'DISPUTED' || vs === 'UNCERTAIN' ? <span className="text-slate-400">(required: explain what is {vs.toLowerCase()})</span> : null}
          <textarea className={inp + ' mt-1'} rows={2} disabled={!isReviewer} value={vnote} onChange={(ev) => setVnote(ev.target.value)} /></label>
        <fieldset className="mt-3" disabled={!isReviewer}>
          <legend className="text-sm">Supporting references {vNeeds && <span className="text-slate-400">(at least one required)</span>}</legend>
          <div className="mt-1 space-y-2">
            {refs.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input aria-label={`Reference ${i + 1} title`} className={inp} placeholder="Source title" value={r.title} onChange={(ev) => setRefs(refs.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} />
                <input aria-label={`Reference ${i + 1} locator`} className={inp} placeholder="Book / chapter / page / hadith no." value={r.ref} onChange={(ev) => setRefs(refs.map((x, j) => (j === i ? { ...x, ref: ev.target.value } : x)))} />
                <Btn type="button" aria-label={`Remove reference ${i + 1}`} onClick={() => setRefs(refs.filter((_, j) => j !== i))}>✕</Btn>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Btn type="button" onClick={() => setRefs([...refs, { title: '', ref: '' }])}>+ Add reference</Btn>
              <Btn type="button" onClick={() => setRefs([...refs, ...e.sources.map(([title, ref]) => ({ title, ref }))])}>Copy the entity’s listed sources</Btn>
            </div>
          </div>
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn kind="gold" disabled={busy || !isReviewer || (vNeeds && !refs.some((r) => r.title.trim())) || ((vs === 'DISPUTED' || vs === 'UNCERTAIN') && !vnote.trim())}
            onClick={() => run('Verification saved.', () => api.verify(id, lang, vs, refs.filter((r) => r.title.trim()), vnote), false)}>Save verification</Btn>
          {!isReviewer && <span className="text-xs text-slate-400">Only reviewers can set historical verification.</span>}
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-gold">History and notes — {LANG_NAME[lang]}</h3>
        {!entries.length ? <p className="text-sm text-slate-400">No recorded activity yet.</p> : (
          <ol className="space-y-2">
            {entries.map((l) => (
              <li key={l.id} className="rounded-lg border border-line bg-ink/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><b className="capitalize">{l.track} · {l.action}</b>
                  {l.status && (l.track === 'translation' ? <TChip s={l.status} /> : <VChip s={l.status} />)}
                  <span className="ms-auto text-xs text-slate-400">{l.actor_name} · {new Date(l.at).toLocaleString('en-CA', { hour12: false }).slice(0, 16)}</span></div>
                {l.note && <p className="mt-1 whitespace-pre-wrap text-slate-300">{l.note}</p>}
                {l.track === 'translation' && l.action === 'save' && l.fields && !isAr && (
                  <Btn className="mt-2 !py-0.5 text-xs" onClick={() => { setForm(l.fields as Fields); setDirty(true); window.scrollTo({ top: 0 }) }}>Load this revision into the editor</Btn>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
