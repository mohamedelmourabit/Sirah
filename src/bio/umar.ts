import type { BioDef } from './types'

// Source titles are the same Arabic strings as in src/data.ts. Locators are chapter-level and still PENDING_REVIEW.
const IH = 'السيرة النبوية — ابن هشام', BK = 'صحيح البخاري', MS = 'صحيح مسلم', IK = 'البداية والنهاية — ابن كثير'
const TB = 'تاريخ الرسل والملوك — الطبري', SD = 'الطبقات الكبرى — ابن سعد', IB = 'الإصابة في تمييز الصحابة — ابن حجر'

export const umar: BioDef = {
  id: 'umar',
  neighbors: { prev: 'abubakr', next: 'uthman' },
  periods: ['mecca', 'hijra', 'medina'],
  sources: {
    ih_islam: [IH, 'ذكر إسلام عمر بن الخطاب'],
    sd: [SD, 'ترجمة عمر بن الخطاب'],
    ib: [IB, 'ترجمة عمر بن الخطاب في الإصابة'],
    bk_manaqib: [BK, 'كتاب فضائل الصحابة، باب مناقب عمر بن الخطاب'],
    bk_shurut: [BK, 'كتاب الشروط، باب الشروط في الجهاد والمصالحة'],
    bk_hijra: [BK, 'كتاب مناقب الأنصار، باب مقدم النبي ﷺ وأصحابه إلى المدينة'],
    bk_death: [BK, 'كتاب المغازي، باب مرض النبي ﷺ ووفاته'],
    bk_bayah: [BK, 'كتاب فضائل الصحابة، باب قصة البيعة والاتفاق على عثمان'],
    bk_taraweeh: [BK, 'كتاب صلاة التراويح، باب فضل من قام رمضان'],
    ms_badr: [MS, 'كتاب الجهاد والسير، باب الإمداد بالملائكة في غزوة بدر'],
    ik_umar: [IK, 'خلافة عمر بن الخطاب'],
    tb_11: [TB, 'حوادث سنة 11هـ: خبر السقيفة'],
    tb_15: [TB, 'حوادث السنوات 15–17هـ: بيت المقدس والتأريخ'],
    tb_23: [TB, 'حوادث سنة 23هـ: مقتل عمر'],
  },
  facts: [
    { id: 'name', certainty: 'established', src: ['sd', 'ib'] },
    { id: 'kunya', certainty: 'established', src: ['sd', 'bk_manaqib'] },
    { id: 'clan', certainty: 'established', src: ['sd'] },
    { id: 'birth', certainty: 'uncertain', src: ['sd'] },
    { id: 'death', certainty: 'established', src: ['tb_23', 'ik_umar'] },
    { id: 'burial', certainty: 'established', src: ['bk_bayah'] },
  ],
  sections: [
    { id: 'identity', claims: [
      { id: 'identity.lineage', certainty: 'established', src: ['sd', 'ib'] },
      { id: 'identity.names', certainty: 'established', src: ['sd', 'bk_manaqib'] },
      { id: 'identity.mother', certainty: 'disputed', src: ['sd', 'ib'] },
      { id: 'identity.amir', certainty: 'established', src: ['ik_umar'] },
    ] },
    { id: 'early', links: ['makkah', 'elephant'], claims: [
      { id: 'early.birth', certainty: 'uncertain', src: ['sd'], links: ['elephant', 'makkah'] },
      { id: 'early.clan', certainty: 'established', src: ['sd'] },
      { id: 'early.work', certainty: 'uncertain', src: ['sd'] },
    ] },
    { id: 'conversion', links: ['dawah', 'hamza', 'makkah'], claims: [
      { id: 'conv.islam', certainty: 'established', src: ['ih_islam', 'sd'] },
      { id: 'conv.date', certainty: 'uncertain', src: ['ih_islam'], links: ['hamza', 'dawah'] },
      { id: 'conv.story', certainty: 'disputed', src: ['ih_islam'] },
    ] },
    { id: 'prophet', links: ['muhammad'], claims: [
      { id: 'proph.closeness', certainty: 'established', src: ['bk_manaqib'], links: ['muhammad', 'abubakr'] },
      { id: 'proph.hafsa', certainty: 'established', src: ['sd'], links: ['muhammad'] },
      { id: 'proph.battles', certainty: 'established', src: ['sd'], links: ['badr', 'uhud', 'khandaq', 'fath'] },
      { id: 'proph.hudaybiyyah', certainty: 'established', src: ['bk_shurut'], links: ['hudaybiyyah'] },
      { id: 'proph.death', certainty: 'established', src: ['bk_death'], links: ['death', 'abubakr'] },
    ] },
    { id: 'events', links: ['hijra', 'badr', 'madinah'], claims: [
      { id: 'events.hijra', certainty: 'established', src: ['bk_hijra'], links: ['hijra', 'madinah'] },
      { id: 'events.badr', certainty: 'established', src: ['ms_badr'], links: ['badr', 'abubakr'] },
    ] },
    { id: 'companions', links: ['abubakr', 'khalid', 'uthman', 'ali', 'abdurrahman'], claims: [
      { id: 'comp.abubakr', certainty: 'established', src: ['tb_11', 'ik_umar'], links: ['abubakr'] },
      { id: 'comp.khalid', certainty: 'disputed', src: ['ik_umar'], links: ['khalid'] },
      { id: 'comp.shura', certainty: 'established', src: ['bk_bayah'], links: ['uthman', 'ali', 'abdurrahman'] },
    ] },
    { id: 'caliphate', links: ['madinah', 'hijra'], claims: [
      { id: 'cal.start', certainty: 'established', src: ['ik_umar', 'tb_15'], links: ['abubakr'] },
      { id: 'cal.conquests', certainty: 'established', src: ['ik_umar'] },
      { id: 'cal.jerusalem', certainty: 'established', src: ['tb_15', 'ik_umar'] },
      { id: 'cal.admin', certainty: 'established', src: ['ik_umar', 'tb_15'] },
      { id: 'cal.calendar', certainty: 'disputed', src: ['tb_15'], links: ['hijra'] },
      { id: 'cal.taraweeh', certainty: 'established', src: ['bk_taraweeh'], links: ['madinah'] },
    ] },
    { id: 'death', links: ['madinah', 'aisha'], claims: [
      { id: 'death.attack', certainty: 'established', src: ['tb_23', 'ik_umar'], links: ['madinah'] },
      { id: 'death.date', certainty: 'uncertain', src: ['tb_23'] },
      { id: 'death.age', certainty: 'uncertain', src: ['sd'] },
      { id: 'death.burial', certainty: 'established', src: ['bk_bayah'], links: ['aisha', 'muhammad', 'abubakr', 'madinah'] },
    ] },
    { id: 'legacy', claims: [
      { id: 'leg.second', certainty: 'established', src: ['bk_manaqib', 'ik_umar'] },
      { id: 'leg.justice', certainty: 'established', src: ['ik_umar'] },
    ] },
  ],
  journey: [
    { id: 'birth', certainty: 'uncertain', entity: 'elephant' },
    { id: 'conversion', certainty: 'uncertain', entity: 'dawah' },
    { id: 'hijra', certainty: 'established', entity: 'hijra' },
    { id: 'badr', certainty: 'established', entity: 'badr' },
    { id: 'uhud', certainty: 'established', entity: 'uhud' },
    { id: 'khandaq', certainty: 'disputed', entity: 'khandaq' },
    { id: 'hudaybiyyah', certainty: 'established', entity: 'hudaybiyyah' },
    { id: 'fath', certainty: 'established', entity: 'fath' },
    { id: 'prophet_death', certainty: 'established', entity: 'death' },
    { id: 'caliphate', certainty: 'established', entity: 'abubakr' },
    { id: 'jerusalem', certainty: 'uncertain' },
    { id: 'death', certainty: 'established', entity: 'madinah' },
  ],
}
