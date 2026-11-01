import { WORKS } from './works'
import { completeness } from './rules'
import type { SourceRef } from './types'

export const sourceId = (work: string, locator: string) => `${work}§${locator}`

/** Build a SourceRef from an existing [title, locator] pair. Only what the locator literally says is extracted; nothing is invented. */
export function toSourceRef(work: string, locator: string, supports: string[] = []): SourceRef {
  const w = WORKS[work]
  const kind = w?.kind ?? 'history'
  const verse = kind === 'quran' ? locator.match(/:\s*([\d–\-]+)\s*$/)?.[1] : undefined
  const ref: SourceRef = { id: sourceId(work, locator), work, author: w?.author, kind, locator, chapter: kind === 'quran' ? undefined : locator, verse, supports, completeness: 'incomplete' }
  ref.completeness = completeness(ref)
  return ref
}

/** Quick check used by the public app: is this [title, locator] pair only chapter-level? */
export const isIncomplete = (work: string, locator: string) => toSourceRef(work, locator).completeness === 'incomplete'

/** Merge many citations of the same reference into one SourceRef with all the records it supports. */
export function registry(cites: { work: string; locator: string; record: string }[]): Map<string, SourceRef> {
  const m = new Map<string, SourceRef>()
  for (const c of cites) {
    const id = sourceId(c.work, c.locator)
    const cur = m.get(id) ?? toSourceRef(c.work, c.locator)
    if (!cur.supports.includes(c.record)) cur.supports.push(c.record)
    m.set(id, cur)
  }
  return m
}
