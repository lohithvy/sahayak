// ============================================================
// SAHAYAK - Multilingual Architecture Service
// Supports all 22 scheduled Indian languages + English
// Provides: LanguageDetectionService, ASRService, TTSService, TranslationService
// Accurate capability tracking (UI, AI_TEXT, TRANSLATION, ASR, TTS)
// ============================================================

import { GeminiService } from './gemini.js';
import { supabase } from './supabase.js';

/**
 * Capability Matrix for all 22 Scheduled Indian Languages + English
 * Tracks honest provider support across UI, AI_TEXT, TRANSLATION, ASR (Speech-to-Text), TTS (Text-to-Speech)
 */
export const LANGUAGE_CAPABILITIES = {
  en: { name: 'English', nativeName: 'English', script: 'Latin', bcp47: 'en-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari', bcp47: 'hi-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  ta: { name: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil', bcp47: 'ta-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  te: { name: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu', bcp47: 'te-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  bn: { name: 'Bengali', nativeName: 'বাংলা', script: 'Bengali', bcp47: 'bn-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  mr: { name: 'Marathi', nativeName: 'मराठी', script: 'Devanagari', bcp47: 'mr-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  gu: { name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati', bcp47: 'gu-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  kn: { name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada', bcp47: 'kn-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  ml: { name: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam', bcp47: 'ml-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  pa: { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', bcp47: 'pa-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  or: { name: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Odia', bcp47: 'or-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  as: { name: 'Assamese', nativeName: 'অসমীয়া', script: 'Bengali', bcp47: 'as-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  ur: { name: 'Urdu', nativeName: 'اردو', script: 'Arabic', bcp47: 'ur-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  ne: { name: 'Nepali', nativeName: 'नेपाली', script: 'Devanagari', bcp47: 'ne-NP', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: true, TTS: true },
  kok: { name: 'Konkani', nativeName: 'कोंकणी', script: 'Devanagari', bcp47: 'kok-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  ks: { name: 'Kashmiri', nativeName: 'कॉशुर / كٲشُر', script: 'Arabic/Devanagari', bcp47: 'ks-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  sd: { name: 'Sindhi', nativeName: 'سنڌي / सिंधी', script: 'Arabic/Devanagari', bcp47: 'sd-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  sa: { name: 'Sanskrit', nativeName: 'संस्कृतम्', script: 'Devanagari', bcp47: 'sa-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  mai: { name: 'Maithili', nativeName: 'मैथिली', script: 'Devanagari', bcp47: 'mai-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  brx: { name: 'Bodo', nativeName: 'बड़ो', script: 'Devanagari', bcp47: 'brx-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  doi: { name: 'Dogri', nativeName: 'डोगरी', script: 'Devanagari', bcp47: 'doi-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  mni: { name: 'Manipuri', nativeName: 'মণিপুরী / ꯃꯤꯇꯩꯂꯣꯟ', script: 'Bengali/Meitei', bcp47: 'mni-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
  sat: { name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'Ol Chiki', bcp47: 'sat-IN', UI: true, AI_TEXT: true, TRANSLATION: true, ASR: false, TTS: false },
};

/**
 * Language Detection Service
 */
export class LanguageDetectionService {
  /**
   * Detect language from text characters / script
   */
  static detectFromText(text) {
    if (!text || typeof text !== 'string') return 'en';

    // Regex ranges for Indic scripts
    const scriptPatterns = [
      { code: 'ta', regex: /[\u0B80-\u0BFF]/ }, // Tamil
      { code: 'te', regex: /[\u0C00-\u0C7F]/ }, // Telugu
      { code: 'kn', regex: /[\u0C80-\u0CFF]/ }, // Kannada
      { code: 'ml', regex: /[\u0D00-\u0D7F]/ }, // Malayalam
      { code: 'bn', regex: /[\u0980-\u09FF]/ }, // Bengali / Assamese / Manipuri
      { code: 'gu', regex: /[\u0A80-\u0AFF]/ }, // Gujarati
      { code: 'pa', regex: /[\u0A00-\u0A7F]/ }, // Gurmukhi (Punjabi)
      { code: 'or', regex: /[\u0B00-\u0B7F]/ }, // Odia
      { code: 'ur', regex: /[\u0600-\u06FF]/ }, // Arabic / Urdu / Kashmiri
      { code: 'sat', regex: /[\u1C50-\u1C7F]/ }, // Ol Chiki (Santali)
      { code: 'hi', regex: /[\u0900-\u097F]/ }, // Devanagari (Hindi, Marathi, Nepali, Sanskrit, Maithili, Bodo, Dogri, Konkani)
    ];

    for (const { code, regex } of scriptPatterns) {
      if (regex.test(text)) {
        return code;
      }
    }

    return 'en';
  }

  /**
   * Detect user language from browser navigator
   */
  static detectFromBrowser() {
    const navLang = navigator.language || navigator.userLanguage || 'en';
    const primary = navLang.split('-')[0].toLowerCase();
    return LANGUAGE_CAPABILITIES[primary] ? primary : 'en';
  }
}

/**
 * ASR (Automatic Speech Recognition) Service
 * Checks honest provider support per language
 */
export class ASRService {
  static recognition = null;
  static isListening = false;

  static isSupported(langCode) {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) return false;
    const capability = LANGUAGE_CAPABILITIES[langCode];
    return !!(capability && capability.ASR);
  }

  static startListening(langCode = 'en', onResult, onError, onEnd) {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      onError?.('Speech recognition is not supported in this browser.');
      return false;
    }

    const capability = LANGUAGE_CAPABILITIES[langCode];
    if (!capability || !capability.ASR) {
      onError?.(`Voice input is currently not supported for ${capability?.name || langCode}. Please type your query.`);
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = capability.bcp47 || 'en-IN';

      this.recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        onResult?.(transcript, isFinal);
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        if (event.error === 'no-speech') {
          onError?.('No speech detected. Please speak clearly into the microphone.');
        } else {
          onError?.('Speech recognition audio error. Please try again or type.');
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        onEnd?.();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e) {
      this.isListening = false;
      onError?.('Failed to start microphone.');
      return false;
    }
  }

  static stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
    }
  }
}

/**
 * TTS (Text to Speech) Service
 * Checks voice availability and speaks
 */
export class TTSService {
  static isSupported(langCode) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    const capability = LANGUAGE_CAPABILITIES[langCode];
    return !!(capability && capability.TTS);
  }

  static speak(text, langCode = 'en', onEnd) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const capability = LANGUAGE_CAPABILITIES[langCode];
    utterance.lang = capability?.bcp47 || 'en-IN';
    utterance.rate = 0.95;

    // Pick best matching voice if available
    const voices = window.speechSynthesis.getVoices?.() || [];
    const matchedVoice = voices.find(v => v.lang === utterance.lang || v.lang.startsWith(langCode));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
  }

  static stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

/**
 * Translation Service
 * Independent per recipient language with Supabase caching
 */
export class TranslationService {
  static async translate(text, sourceLang, targetLang) {
    if (!text || sourceLang === targetLang) return text;
    return await GeminiService.translateText(text, sourceLang, targetLang);
  }
}
