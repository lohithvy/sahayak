// ============================================================
// SAHAYAK - Internationalization (i18n) Engine
// Supports all 22 scheduled Indian languages + English (23 total)
// Honest Capability Tracking: UI, AI Text, Translation, ASR, TTS
// ============================================================

import en from './locales/en.js';
import hi from './locales/hi.js';
import ta from './locales/ta.js';
import te from './locales/te.js';
import bn from './locales/bn.js';
import mr from './locales/mr.js';
import gu from './locales/gu.js';
import kn from './locales/kn.js';
import ml from './locales/ml.js';
import pa from './locales/pa.js';
import or from './locales/or.js';
import as from './locales/as.js';
import ur from './locales/ur.js';
import ne from './locales/ne.js';
import kok from './locales/kok.js';
import ks from './locales/ks.js';
import sd from './locales/sd.js';
import sa from './locales/sa.js';
import mai from './locales/mai.js';
import brx from './locales/brx.js';
import doi from './locales/doi.js';
import mni from './locales/mni.js';
import sat from './locales/sat.js';

export const LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    script: 'Tamil',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    script: 'Telugu',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    script: 'Bengali',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    script: 'Gujarati',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    script: 'Kannada',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    script: 'Malayalam',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    script: 'Gurmukhi',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    script: 'Odia',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'as',
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    script: 'Bengali',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    script: 'Arabic',
    dir: 'rtl',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'ne',
    name: 'Nepali',
    nativeName: 'नेपाली',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'provider-supported',
    tts: 'provider-supported',
  },
  {
    code: 'kok',
    name: 'Konkani',
    nativeName: 'कोंकणी',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'ks',
    name: 'Kashmiri',
    nativeName: 'कॉशुर / كٲشُر',
    script: 'Arabic/Devanagari',
    dir: 'rtl',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'sd',
    name: 'Sindhi',
    nativeName: 'سنڌي / सिंधी',
    script: 'Arabic/Devanagari',
    dir: 'rtl',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'sa',
    name: 'Sanskrit',
    nativeName: 'संस्कृतम्',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'mai',
    name: 'Maithili',
    nativeName: 'मैथिली',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'brx',
    name: 'Bodo',
    nativeName: 'बड़ो',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'doi',
    name: 'Dogri',
    nativeName: 'डोगरी',
    script: 'Devanagari',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'mni',
    name: 'Manipuri',
    nativeName: 'মণিপুরী',
    script: 'Bengali/Meitei',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
  {
    code: 'sat',
    name: 'Santali',
    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',
    script: 'Ol Chiki',
    dir: 'ltr',
    ui: true,
    aiText: true,
    translation: true,
    asr: 'unavailable',
    tts: 'unavailable',
  },
];

// Unified translation dictionary
export const translations = {
  en,
  hi,
  ta,
  te,
  bn,
  mr,
  gu,
  kn,
  ml,
  pa,
  or,
  as,
  ur,
  ne,
  kok,
  ks,
  sd,
  sa,
  mai,
  brx,
  doi,
  mni,
  sat,
};

/**
 * Get translation with controlled fallback to English
 * Never returns a raw dot-key if an English equivalent exists.
 */
export function t(key, lang = 'en') {
  if (!key) return '';
  const cleanLang = (lang || 'en').toLowerCase().split('-')[0];
  
  if (translations[cleanLang] && translations[cleanLang][key]) {
    return translations[cleanLang][key];
  }
  
  if (translations.en && translations.en[key]) {
    return translations.en[key];
  }
  
  // Format key to human-readable string if completely missing
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getLanguageName(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.nativeName : code;
}

export function getLanguageEnglishName(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code;
}

export function getLanguageDir(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.dir : 'ltr';
}

export function isRtlLanguage(code) {
  return getLanguageDir(code) === 'rtl';
}

export function getLanguageConfig(code) {
  return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
}
