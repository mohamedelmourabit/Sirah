import { createContext, useContext } from 'react'
import type { Entity } from './data'

export type View = 'home' | 'timeline' | 'map' | 'people' | 'events' | 'places' | 'browse' | 'sources'

export interface AppCtx {
  all: Entity[]
  byId: Map<string, Entity>
  orig: Map<string, Entity> // Arabic originals, for "view original"
  viewed: Set<string>
  sel: string | null
  open: (id: string) => void
  go: (v: View) => void
}
export const Ctx = createContext<AppCtx>(null!)
export const useApp = () => useContext(Ctx)
