import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from './ctx'
import { Kind, Period } from './data'

const PERIOD_KEYS: Period[] = ['pre', 'mecca', 'hijra', 'medina']
import { search } from './lib'
import { Badge } from './Timeline'
import { TrTag } from './status'

/** Searchable, filterable list for one kind (companions / events / places). */
export default function Directory({ kind }: { kind: Kind }) {
  const { t } = useTranslation()
  const { all, open } = useApp()
  const [q, setQ] = useState('')
  const [period, setPeriod] = useState<Period | undefined>()
  const list = useMemo(() => search(all, q, { kind, period }), [all, q, kind, period])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('directory.placeholder')} aria-label={t('directory.aria')} className="min-w-0 flex-1 rounded-xl border border-line bg-panel px-4 py-2 text-sm outline-none focus:border-gold" />
        {[undefined, ...PERIOD_KEYS].map((p) => (
          <button key={p ?? 'all'} onClick={() => setPeriod(p)} className={`rounded-full border px-3 py-1.5 text-xs ${period === p ? 'border-gold bg-gold/20 text-gold2' : 'border-line text-slate-300 hover:bg-panel2'}`}>{p ? t(`periods.${p}`) : t('directory.all')}</button>
        ))}
      </div>
      <p className="mb-3 text-xs text-slate-400" aria-live="polite">{t('directory.results', { count: list.length })}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => (
          <button key={e.id} onClick={() => open(e.id)} className="rounded-xl border border-line bg-panel p-4 text-start transition hover:border-gold/60">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-gold2">{e.name}</h3>
              <span className="flex shrink-0 items-center gap-1"><TrTag e={e} /><Badge id={e.id} /></span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{t(`periods.${e.period}`)} · <bdi>{e.when}</bdi></div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-300">{e.summary}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
