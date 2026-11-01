import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translationApproved, verificationOf, type TrMeta, type Verif } from '../content'
import { useApp } from '../ctx'

export interface TimelinePack { translation?: TrMeta; verification?: Partial<Verif>; groups: Record<string, { title: string; range: string; intro: string }> }
const texts = import.meta.glob('./*.json') as Record<string, () => Promise<{ default: unknown }>>
const load = async (lang: string) => (await (texts[`./${lang}.json`] ?? texts['./ar.json'])()).default as TimelinePack

/** Group titles / date ranges, with the same translation rules as everything else: approved -> translation; draft only when previewing; otherwise Arabic. */
export function useTimelineText() {
  const { i18n } = useTranslation()
  const { drafts } = useApp()
  const lang = i18n.resolvedLanguage ?? 'ar'
  const [p, setP] = useState<{ lang: string; ar: TimelinePack; tr?: TimelinePack } | null>(null)
  useEffect(() => {
    let live = true
    Promise.all([load('ar'), lang === 'ar' ? undefined : load(lang)]).then(([ar, tr]) => live && setP({ lang, ar, tr }))
    return () => { live = false }
  }, [lang])
  const mode = useMemo(() => (lang === 'ar' || !p ? 'original' : translationApproved(p.tr?.translation) ? 'approved' : drafts && p.tr ? 'draft' : 'pending'), [lang, p, drafts]) as 'original' | 'approved' | 'draft' | 'pending'
  const pack = !p ? null : mode === 'approved' || mode === 'draft' ? p.tr! : p.ar
  return { groups: pack?.groups ?? {}, mode, isAr: !!p && pack === p.ar, verif: verificationOf(pack?.verification) }
}
