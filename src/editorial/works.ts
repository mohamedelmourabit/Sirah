import type { SourceRef } from './types'

/** Works cited in the data. `author` is the well-known author of the work as named in its title; edition / volume / page are NOT known and stay empty. */
export const WORKS: Record<string, { author?: string; kind: SourceRef['kind'] }> = {
  'القرآن الكريم': { kind: 'quran' },
  'صحيح البخاري': { author: 'Muḥammad ibn Ismāʿīl al-Bukhārī', kind: 'hadith' },
  'صحيح مسلم': { author: 'Muslim ibn al-Ḥajjāj', kind: 'hadith' },
  'السيرة النبوية — ابن هشام': { author: 'ʿAbd al-Malik ibn Hishām', kind: 'sira' },
  'الطبقات الكبرى — ابن سعد': { author: 'Muḥammad ibn Saʿd', kind: 'biographical' },
  'تاريخ الرسل والملوك — الطبري': { author: 'Muḥammad ibn Jarīr al-Ṭabarī', kind: 'history' },
  'البداية والنهاية — ابن كثير': { author: 'Ismāʿīl ibn ʿUmar Ibn Kathīr', kind: 'history' },
  'الإصابة في تمييز الصحابة — ابن حجر': { author: 'Aḥmad ibn ʿAlī Ibn Ḥajar al-ʿAsqalānī', kind: 'biographical' },
  'الرحيق المختوم — المباركفوري': { author: 'Ṣafī al-Raḥmān al-Mubārakfūrī', kind: 'modern' },
}
