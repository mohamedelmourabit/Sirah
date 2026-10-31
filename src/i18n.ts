import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import fr from './locales/fr.json'
import en from './locales/en.json'
import es from './locales/es.json'

export const LANGS = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
] as const
export type Lang = (typeof LANGS)[number]['code']

const KEY = 'sira.lang'
const stored = (() => { try { return localStorage.getItem(KEY) } catch { return null } })()
const initial: Lang = LANGS.some((l) => l.code === stored) ? (stored as Lang) : 'ar'

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, fr: { translation: fr }, en: { translation: en }, es: { translation: es } },
  lng: initial,
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
})

// keep <html lang/dir> and the page title in sync; persist the choice
const apply = (code: string) => {
  const l = LANGS.find((x) => x.code === code) ?? LANGS[0]
  document.documentElement.lang = l.code
  document.documentElement.dir = l.dir
  document.title = i18n.t('app.title')
  try { localStorage.setItem(KEY, l.code) } catch { /* private mode */ }
}
i18n.on('languageChanged', apply)
apply(initial)

export default i18n
