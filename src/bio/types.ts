import type { TrMeta, Verif } from '../content'

/** How the sources present an account. Independent of review status (Verif), which is PENDING_REVIEW until a reviewer says otherwise. */
export type Certainty = 'established' | 'disputed' | 'uncertain'
export interface Claim { id: string; certainty: Certainty; src: string[]; links?: string[] }
export interface Section { id: string; claims: Claim[]; links?: string[] }
export interface Milestone { id: string; certainty: Certainty; entity?: string }
/** Language-neutral skeleton of one biography: structure, links, certainty and source ids. No prose. */
export interface BioDef {
  id: string // = entity id in src/data.ts
  neighbors?: { prev?: string; next?: string } // previous / next entry in the story (entity ids)
  periods: ('pre' | 'mecca' | 'hijra' | 'medina')[]
  sources: Record<string, [title: string, locator: string]> // Arabic originals; translated via the pack's books/refs
  facts: { id: string; certainty: Certainty; src: string[] }[]
  sections: Section[]
  journey: Milestone[] // chronological milestones with an optional entity to open
}
/** Per-language prose. Same ids as the skeleton; ar.json is the original, the others are translations with their own review state. */
export interface BioPack {
  translation?: TrMeta
  verification?: Partial<Verif>
  title: string
  subtitle: string
  sections: Record<string, string>
  facts: Record<string, { label: string; value: string }>
  claims: Record<string, string>
  journey: Record<string, { label: string; when: string }>
  refs: Record<string, string>
  books: Record<string, string>
}
