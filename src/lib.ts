import { createClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import { Entity, PERIODS, SAMPLE } from './data'
import { ALIASES } from './aliases'
import { buildDocs, Doc, norm, searchDocs, suggest } from './search'
import i18n from './i18n'
import { arPack, mergeRemote, Pack } from './content'

// ---- Supabase (optional: app works fully without it) ----
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const sb = url && key ? createClient(url, key) : null

/** Public content: anonymous read. Falls back to bundled sample data. */
export async function loadEntities(): Promise<Entity[]> {
  if (!sb) return SAMPLE
  // ponytail: one request caps at 1000 rows; page with .range() once content grows
  const { data, error } = await sb.from('entities').select('*').limit(1000)
  return error || !data?.length ? SAMPLE : (data as Entity[])
}

// ---- Translations + verification: bundled packs, optionally overlaid with reviewed rows from Supabase ----
const packs: Record<string, () => Promise<{ default: unknown }>> = {
  fr: () => import('./locales/content/fr.json'),
  en: () => import('./locales/content/en.json'),
  es: () => import('./locales/content/es.json'),
}
export const loadPack = async (lang: string): Promise<Pack | null> => {
  const local = lang === 'ar' ? arPack : packs[lang] ? ((await packs[lang]()).default as Pack) : null
  if (!local || !sb) return local
  // RLS only serves reviewed translations; mergeRemote re-checks. Any error -> bundled content.
  const [tr, ver] = await Promise.all([
    lang === 'ar' ? { data: [], error: null } : sb.from('entity_translations').select('*').eq('lang', lang).eq('translation_status', 'reviewed'),
    sb.from('entity_verification').select('*').eq('lang', lang),
  ])
  return tr.error || ver.error ? local : mergeRemote(local, tr.data ?? [], ver.data ?? [])
}

// ---- Search: index = Arabic + fr/en/es names + aliases + id (never only the displayed title) ----
let extraNames: Record<string, string[]> = {}
let warmed: Promise<void> | null = null
const listeners = new Set<() => void>()
/** Load the fr/en/es names (a few KB, cached) so every language's spelling is searchable. */
export const warmNames = () =>
  (warmed ??= Promise.all(Object.values(packs).map(async (l) => (await l()).default as Pack)).then((ps) => {
    const m: Record<string, string[]> = {}
    for (const p of ps) for (const [id, t] of Object.entries(p.entities)) if (t.name) (m[id] ??= []).push(t.name)
    extraNames = m
    listeners.forEach((f) => f())
  }).catch(() => {}))
export const onNamesLoaded = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))

const ar = new Map(SAMPLE.map((e) => [e.id, e.name]))
const cache = new WeakMap<Entity[], { ev: typeof extraNames; lang?: string; docs: Doc[] }>()
const LANG_CODES = ['ar', 'fr', 'en', 'es']
const docsFor = (all: Entity[]): Doc[] => {
  const c = cache.get(all)
  if (c && c.ev === extraNames && c.lang === i18n.resolvedLanguage) return c.docs
  const periods = (['pre', 'mecca', 'hijra', 'medina'] as const).map((p, i) => ({
    id: 'period:' + p, display: i18n.t(`periods.${p}`), y: i * 100,
    names: [PERIODS[p], ...LANG_CODES.map((l) => i18n.getResource(l, 'translation', `periods.${p}`) as string)].filter(Boolean),
  }))
  const docs = buildDocs(all, (id) => ar.get(id) ?? '', extraNames, ALIASES, (e) => `${i18n.t(`periods.${e.period}`)} ${i18n.t(`kinds.${e.kind}`)}`, periods)
  cache.set(all, { ev: extraNames, lang: i18n.resolvedLanguage, docs })
  return docs
}

export function search(all: Entity[], q: string, f: { kind?: Entity['kind']; period?: Entity['period'] } = {}) {
  const byId = new Map(all.map((e) => [e.id, e]))
  const ok = (e?: Entity): e is Entity => !!e && (!f.kind || e.kind === f.kind) && (!f.period || e.period === f.period)
  if (!norm(q)) return all.filter(ok).sort((a, b) => a.y - b.y) // empty query = everything
  return searchDocs(docsFor(all), q).map((h) => byId.get(h.doc.id)).filter(ok)
}
/** Global search box: entity hits and period hits, best first. */
export const searchHits = (all: Entity[], q: string) => searchDocs(docsFor(all), q)
export const suggestions = (all: Entity[], q: string) => suggest(docsFor(all), q)

// ---- Reading progress: IndexedDB always, Supabase sync when signed in ----
export function useProgress() {
  const [viewed, setViewed] = useState<Set<string>>(new Set())
  const [user, setUser] = useState<string | null>(null)
  const ref = useRef(viewed)
  const uid = useRef<string | null>(null)

  const apply = (n: Set<string>) => {
    ref.current = n
    setViewed(n)
    set('viewed', [...n]).catch(() => {})
  }

  useEffect(() => {
    get<string[]>('viewed').then((v) => v && apply(new Set([...v, ...ref.current]))).catch(() => {})
    if (!sb) return
    const sync = async (s: { user: { id: string; email?: string } } | null) => {
      uid.current = s?.user.id ?? null
      setUser(s?.user.email ?? s?.user.id ?? null)
      if (!s) return
      const { data } = await sb.from('progress').select('entity_id')
      const remote = new Set((data ?? []).map((r) => r.entity_id as string))
      const merged = new Set([...ref.current, ...remote])
      const missing = [...ref.current].filter((id) => !remote.has(id))
      if (missing.length) await sb.from('progress').upsert(missing.map((entity_id) => ({ user_id: s.user.id, entity_id })))
      apply(merged)
    }
    sb.auth.getSession().then(({ data }) => sync(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => sync(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const mark = (id: string) => {
    if (ref.current.has(id)) return
    apply(new Set(ref.current).add(id))
    if (sb && uid.current) sb.from('progress').upsert({ user_id: uid.current, entity_id: id }).then(() => {})
  }
  return { viewed, mark, user }
}
