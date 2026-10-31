import { useTranslation } from 'react-i18next'
import { useApp } from './ctx'
import { Entity, Period } from './data'
import { TrTag } from './status'

const PERIOD_KEYS: Period[] = ['pre', 'mecca', 'hijra', 'medina']

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

function Card({ e }: { e: Entity }) {
  const { t } = useTranslation()
  const { open, sel } = useApp()
  return (
    <button onClick={() => open(e.id)} className={`w-44 shrink-0 snap-start overflow-hidden rounded-xl border bg-panel text-start transition hover:-translate-y-0.5 md:w-auto md:shrink ${sel === e.id ? 'border-gold ring-1 ring-gold' : 'border-line'}`}>
      <div className={`flex h-16 items-end justify-between bg-gradient-to-br p-2 text-[11px] text-white/80 ${GRAD[e.period]}`}>
        <span>{t(`periods.${e.period}`)}</span>
        <span className="flex items-center gap-1"><TrTag e={e} /><Badge id={e.id} /></span>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium">{e.name}</div>
        <div className="mt-1 text-xs text-slate-400">{e.when}</div>
      </div>
    </button>
  )
}

/** compact = horizontal strip for the dashboard; otherwise a full grouped page. */
export default function Timeline({ compact }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { all, go } = useApp()
  const events = all.filter((e) => e.kind === 'event').sort((a, b) => a.y - b.y)

  if (compact)
    return (
      <section className="rounded-2xl border border-line bg-panel/70 p-4" aria-label={t('timeline.title')}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-gold2">{t('timeline.title')}</h2>
          <button onClick={() => go('timeline')} className="text-sm text-sky hover:underline">{t('timeline.viewAll')}</button>
        </div>
        <div className="scroll-thin flex snap-x gap-3 overflow-x-auto pb-2">
          {events.map((e) => <Card key={e.id} e={e} />)}
        </div>
      </section>
    )

  return (
    <div className="space-y-8">
      {PERIOD_KEYS.map((p) => {
        const list = events.filter((e) => e.period === p)
        return list.length ? (
          <section key={p}>
            <h2 className="mb-3 flex items-center gap-3 font-display text-2xl text-gold2"><i className="size-3 rounded-full bg-gold" />{t(`periods.${p}`)}</h2>
            <div className="grid gap-3 border-s border-line ps-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((e) => <Card key={e.id} e={e} />)}
            </div>
          </section>
        ) : null
      })}
    </div>
  )
}
