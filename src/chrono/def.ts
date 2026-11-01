import type { Certainty } from '../bio/types'

/** Master chronological order of the Prophet's life. Every id is an entity in src/data.ts (kind 'event'); dates, summaries, sources and
 *  "reports differ" notes come from the entity itself, group titles from src/timeline/<lang>.json. This file only adds order, group,
 *  category and how the sources present the event (certainty) — never review status (that stays PENDING_REVIEW). */
export type Cat = 'background' | 'life' | 'revelation' | 'hardship' | 'migration' | 'community' | 'military' | 'diplomacy' | 'final'
export const CATS: Cat[] = ['background', 'life', 'revelation', 'hardship', 'migration', 'community', 'military', 'diplomacy', 'final']
export interface TEvent { id: string; group: string; cat: Cat; certainty: Certainty }
const e = (id: string, group: string, cat: Cat, certainty: Certainty): TEvent => ({ id, group, cat, certainty })

export const GROUPS = Array.from({ length: 17 }, (_, i) => `g${i + 1}`)
export const EVENTS: TEvent[] = [
  e('arabia_pre', 'g1', 'background', 'established'), e('elephant', 'g1', 'background', 'established'),
  e('birth', 'g2', 'life', 'disputed'), e('childhood', 'g2', 'life', 'disputed'),
  e('youth', 'g3', 'life', 'uncertain'),
  e('marriage', 'g4', 'life', 'disputed'), e('kaaba_rebuild', 'g4', 'life', 'uncertain'),
  e('revelation', 'g5', 'revelation', 'disputed'),
  e('secret_dawah', 'g6', 'revelation', 'uncertain'),
  e('dawah', 'g7', 'revelation', 'established'), e('persecution', 'g7', 'hardship', 'established'),
  e('habasha_hijra', 'g8', 'migration', 'established'),
  e('boycott', 'g9', 'hardship', 'uncertain'), e('sorrow', 'g9', 'hardship', 'established'), e('taif_trip', 'g9', 'hardship', 'established'),
  e('isra', 'g10', 'revelation', 'disputed'),
  e('aqaba', 'g11', 'diplomacy', 'established'), e('hijra', 'g11', 'migration', 'established'),
  e('madina_state', 'g12', 'community', 'disputed'),
  e('badr', 'g13', 'military', 'established'), e('uhud', 'g13', 'military', 'established'), e('khandaq', 'g13', 'military', 'disputed'),
  e('hudaybiyyah', 'g14', 'diplomacy', 'established'), e('khaybar', 'g14', 'military', 'uncertain'),
  e('muta', 'g15', 'military', 'established'), e('fath', 'g15', 'military', 'established'), e('hunayn', 'g15', 'military', 'established'),
  e('tabuk', 'g16', 'military', 'established'), e('farewell', 'g16', 'final', 'established'),
  e('illness', 'g17', 'final', 'uncertain'), e('death', 'g17', 'final', 'disputed'),
]
export const eventOf = new Map(EVENTS.map((x) => [x.id, x]))
export const orderOf = new Map(EVENTS.map((x, i) => [x.id, i]))
/** previous / next event in the master chronology */
export const neighbors = (id: string) => { const i = orderOf.get(id); return i === undefined ? null : { prev: EVENTS[i - 1]?.id, next: EVENTS[i + 1]?.id, n: i + 1, total: EVENTS.length } }
