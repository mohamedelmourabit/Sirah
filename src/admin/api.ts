import { createClient } from '@supabase/supabase-js'
import type { Lang } from './model'

// Browser client: anon key only. Every write goes through the RLS-checked SQL functions in supabase/schema.sql.
// No privileged key may ever be used in the browser.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const sb = url && key ? createClient(url, key) : null

export interface Me { user_id: string; role: 'editor' | 'reviewer'; display_name: string }
export interface TrRow {
  entity_id: string; lang: Exclude<Lang, 'ar'>; fields: Record<string, unknown>
  translation_status: 'draft' | 'submitted' | 'reviewed' | 'rejected'
  translation_reviewed_by: string | null; translation_reviewed_at: string | null
  last_edited_by: string | null; submitted_by: string | null; updated_at: string
}
export interface Ref { title: string; ref: string }
export interface VerRow { entity_id: string; lang: Lang; status: string; reviewed_by: string | null; reviewed_at: string | null; note: string | null; refs: Ref[] }
export interface LogRow { id: number; lang: Lang; track: 'translation' | 'verification'; action: string; status: string | null; fields: Record<string, unknown> | null; note: string | null; actor_name: string; at: string }

const must = <T,>(r: { data: T | null; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T }

export const api = {
  signIn: async (email: string, password: string) => { const { error } = await sb!.auth.signInWithPassword({ email, password }); if (error) throw new Error(error.message) },
  signOut: () => sb!.auth.signOut(),
  me: async (): Promise<Me | null> => must(await sb!.from('reviewers').select('*').maybeSingle()),
  load: async () => {
    const [tr, ver] = await Promise.all([sb!.from('entity_translations').select('*'), sb!.from('entity_verification').select('*')])
    return { tr: must(tr) as TrRow[], ver: must(ver) as VerRow[] }
  },
  log: async (entity: string) => must(await sb!.from('review_log').select('*').eq('entity_id', entity).order('id', { ascending: false })) as LogRow[],
  save: async (entity: string, lang: string, fields: object, note?: string) => must(await sb!.rpc('save_translation', { p_entity: entity, p_lang: lang, p_fields: fields, p_note: note || null })),
  submit: async (entity: string, lang: string, note?: string) => must(await sb!.rpc('submit_translation', { p_entity: entity, p_lang: lang, p_note: note || null })),
  review: async (entity: string, lang: string, decision: 'approve' | 'reject', note?: string) => must(await sb!.rpc('review_translation', { p_entity: entity, p_lang: lang, p_decision: decision, p_note: note || null })),
  verify: async (entity: string, lang: string, status: string, refs: Ref[], note?: string) => must(await sb!.rpc('set_verification', { p_entity: entity, p_lang: lang, p_status: status, p_refs: refs, p_note: note || null })),
  note: async (entity: string, lang: string, track: string, note: string) => must(await sb!.rpc('add_review_note', { p_entity: entity, p_lang: lang, p_track: track, p_note: note })),
}
