import type { BioDef, BioPack } from './types'
import { abubakr } from './abubakr'
import { umar } from './umar'

// Per-language text is lazy-loaded: src/bio/<id>/<lang>.json
const texts = import.meta.glob('./*/*.json') as Record<string, () => Promise<{ default: unknown }>>
const entry = (def: BioDef) => ({
  def,
  load: async (lang: string): Promise<BioPack> => (await (texts[`./${def.id}/${lang}.json`] ?? texts[`./${def.id}/ar.json`])()).default as BioPack,
})

/** Registry. To add a biography: skeleton .ts + ar/fr/en/es .json in src/bio/<id>/, then one line here. */
export const BIOS: Record<string, { def: BioDef; load: (lang: string) => Promise<BioPack> }> = {
  umar: entry(umar),
  abubakr: entry(abubakr),
}
export const hasBio = (id: string) => id in BIOS
