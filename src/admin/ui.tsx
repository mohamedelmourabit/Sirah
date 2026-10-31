import { ReactNode } from 'react'
import { TR_LABEL, V_LABEL } from './model'

// status is always text + symbol, never colour alone
const TC: Record<string, string> = {
  draft: 'border-line bg-ink/50 text-slate-300', submitted: 'border-sky/50 bg-sky/10 text-sky-200',
  rejected: 'border-rose-500/50 bg-rose-500/10 text-rose-200', reviewed: 'border-jade/50 bg-jade/10 text-emerald-200',
}
const VC: Record<string, string> = {
  PENDING_REVIEW: 'border-line bg-ink/50 text-slate-300', UNCERTAIN: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
  DISPUTED: 'border-orange-500/50 bg-orange-500/10 text-orange-200', VERIFIED: 'border-jade/50 bg-jade/10 text-emerald-200',
}
const SYM: Record<string, string> = { draft: '✎', submitted: '⏳', rejected: '✕', reviewed: '✔', PENDING_REVIEW: '…', UNCERTAIN: '?', DISPUTED: '⚠', VERIFIED: '✔' }
const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap'

export const TChip = ({ s }: { s: string }) => <span className={`${chip} ${TC[s]}`} title="Translation review"><span aria-hidden>{SYM[s]}</span>{TR_LABEL[s]}</span>
export const VChip = ({ s }: { s: string }) => <span className={`${chip} ${VC[s]}`} title="Historical verification"><span aria-hidden>{SYM[s]}</span>{V_LABEL[s]}</span>

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <section className={`rounded-2xl border border-line bg-panel/70 p-4 ${className}`}>{children}</section>
export const Btn = ({ kind = 'plain', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'plain' | 'gold' | 'danger' }) => (
  <button {...p} className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${kind === 'gold' ? 'border-gold bg-gold/20 text-gold2 hover:bg-gold/30' : kind === 'danger' ? 'border-rose-500/60 text-rose-200 hover:bg-rose-500/10' : 'border-line hover:border-gold'} ${p.className ?? ''}`} />
)
export const inp = 'w-full rounded-lg border border-line bg-ink/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-gold'

export function Bar({ counts, order, label }: { counts: Record<string, number>; order: readonly string[]; label: Record<string, string> }) {
  const total = order.reduce((a, k) => a + (counts[k] ?? 0), 0) || 1
  const col: Record<string, string> = { draft: 'bg-slate-500', submitted: 'bg-sky', rejected: 'bg-rose-500', reviewed: 'bg-jade', PENDING_REVIEW: 'bg-slate-500', UNCERTAIN: 'bg-amber-500', DISPUTED: 'bg-orange-500', VERIFIED: 'bg-jade' }
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-ink" role="img" aria-label={order.map((k) => `${label[k]} ${counts[k] ?? 0}`).join(', ')}>
        {order.map((k) => <i key={k} className={col[k]} style={{ width: `${((counts[k] ?? 0) / total) * 100}%` }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        {order.map((k) => <li key={k}><i className={`me-1 inline-block size-2 rounded-full ${col[k]}`} />{label[k]} <b>{counts[k] ?? 0}</b></li>)}
      </ul>
    </div>
  )
}
