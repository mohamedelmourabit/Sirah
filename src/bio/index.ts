import type { BioDef, BioPack } from './types'
import { umar } from './umar'

/** Registry. To add a biography: skeleton .ts + ar/fr/en/es .json in src/bio/<id>/, then one line each here. */
export const BIOS: Record<string, { def: BioDef; load: (lang: string) => Promise<BioPack> }> = {
  umar: {
    def: umar,
    load: async (lang) => {
      const m = { ar: () => import('./umar/ar.json'), fr: () => import('./umar/fr.json'), en: () => import('./umar/en.json'), es: () => import('./umar/es.json') }[lang as 'ar']
      return (await (m ?? (() => import('./umar/ar.json')))()).default as unknown as BioPack
    },
  },
}
export const hasBio = (id: string) => id in BIOS
