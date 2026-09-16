import { supabase } from './supabase.js';

const PRIMARY_MODEL = 'gemini-3.6-flash';

async function callGeminiApi(payload) {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error || `AI service error (status ${response.status})`;
      console.warn(`[Gemini Proxy Error] Status: ${response.status} | Message: ${msg}`);
      throw new Error(msg);
    }

    return await response.json();
  } catch (err) {
    console.warn(`[Gemini Proxy Fetch Error] Action: ${payload?.action} | Details:`, err?.message || err);
    throw new Error(err?.message || 'AI request failed');
  }
}

export class GeminiService {
  /**
   * Primary conversational chat assistant
   */
  static async chat(prompt, systemInstruction = '', enableSearch = false) {
    const result = await callGeminiApi({
      action: 'chat',
      prompt,
      systemInstruction,
      enableSearch,
    });
    return result?.text || '';
  }

  /**
   * Conversational chat assistant with intent-sensitive brevity and profile privacy
   */
  static async chatAssistant(messages, userProfile, language = 'en') {
    const langName = LANGUAGE_NAMES[language] || 'English';
    const systemInstruction = `You are Sahayak, a citizen-focused AI assistant for discovering and understanding Indian government schemes and support.

Answer the user's actual question directly.

Do not proactively list unrelated schemes, user profile information, documents, applications, government opportunities, waiting lists, or platform features.

Use user profile information silently for personalization when relevant. Do NOT automatically repeat, enumerate, or recite the user's entire profile.

For greetings and casual conversation:
→ Respond naturally and briefly (e.g., "Hello! How can I help you today?"). Do not list schemes.

For simple factual questions (e.g. "Who are you?", "What is Sahayak?"):
→ Provide a direct, one-sentence answer (e.g., "I'm Sahayak, an AI assistant that helps you find and understand government schemes and support.").

For scheme requests:
→ Provide only schemes relevant to the user's specific request.

For eligibility questions:
→ Explain the relevant eligibility result and specific reasons.

For application questions:
→ Answer application-specific information only.

For document questions:
→ Address relevant documents only.

For government opportunity questions:
→ Address relevant opportunities only.

Do not invent eligibility, benefits, deadlines, or government requirements.

When current information is required, research official sources.

Do not expose internal reasoning.

Default response length: 1 to 4 short paragraphs OR a concise list when appropriate. Only provide extensive detail when explicitly requested by the user.

Respond fluently in ${langName} (language code: ${language}) using its native script.

User Profile Context (use silently for personalization):
- Category: ${userProfile?.community_category || 'Not specified'}
- State: ${userProfile?.state || 'Not specified'}
- Business Type: ${userProfile?.business_type || 'Not specified'}
- Gender: ${userProfile?.gender || 'Not specified'}
- Annual Income: ${userProfile?.annual_income || 'Not specified'}`;

    const formattedMessages = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    return await this.chat(formattedMessages, systemInstruction, true);
  }

  /**
   * Smart Dashboard AI Search returning structured responses
   */
  static async searchDashboard(query, userProfile, language = 'en') {
    return await callGeminiApi({
      action: 'dashboard-search',
      query,
      userProfile,
      language,
    });
  }

  /**
   * Researches government schemes relevant to query and profile (backwards compatible)
   */
  static async researchSchemes(query, userProfile, language = 'en') {
    try {
      const result = await this.searchDashboard(query, userProfile, language);
      return result?.schemes || result?.recommendations || [];
    } catch {
      return [];
    }
  }

  /**
   * Analyzes scheme eligibility
   */
  static async analyzeEligibility(scheme, userProfile, userDocuments) {
    try {
      const result = await callGeminiApi({
        action: 'analyze-eligibility',
        scheme,
        userProfile,
        userDocuments,
      });
      return result?.analysis || {
        status: 'MORE_INFORMATION_REQUIRED',
        readiness_percentage: 0,
        checks: [],
        missing_documents: [],
        missing_requirements: ['Automated analysis unavailable'],
        action_items: ['Please review eligibility on the official scheme portal'],
        alternatives_note: '',
      };
    } catch {
      return {
        status: 'MORE_INFORMATION_REQUIRED',
        readiness_percentage: 0,
        checks: [],
        missing_documents: [],
        missing_requirements: ['Automated analysis unavailable'],
        action_items: ['Please review eligibility on the official scheme portal'],
        alternatives_note: '',
      };
    }
  }

  /**
   * Multilingual translation with Supabase cache lookup
   */
  static async translateText(text, sourceLang, targetLang) {
    if (!text || sourceLang === targetLang) return text;

    // Check Supabase cache first
    try {
      const { data: cached } = await supabase
        .from('translations_cache')
        .select('translated_text')
        .eq('source_language', sourceLang)
        .eq('target_language', targetLang)
        .eq('source_text', text.trim())
        .limit(1)
        .maybeSingle();

      if (cached?.translated_text) {
        return cached.translated_text;
      }
    } catch (e) {
      // Continue to live translation
    }

    try {
      const result = await callGeminiApi({
        action: 'translate',
        text,
        sourceLang,
        targetLang,
      });

      const translated = result?.translatedText || text;

      // Cache result in Supabase
      if (translated && translated !== text) {
        supabase
          .from('translations_cache')
          .insert({
            source_text: text.trim(),
            source_language: sourceLang,
            target_language: targetLang,
            translated_text: translated,
          })
          .then(() => {})
          .catch(() => {});
      }

      return translated;
    } catch {
      return text;
    }
  }

  /**
   * Voice transcript profile parameter extraction
   */
  static async extractProfileFromSpeech(transcript, language) {
    try {
      const result = await callGeminiApi({
        action: 'extract-speech',
        transcript,
        language: LANGUAGE_NAMES[language] || language,
      });
      return result?.profileData || null;
    } catch {
      return null;
    }
  }

  /**
   * Searches for government opportunities
   */
  static async researchOpportunities(userProfile) {
    try {
      const result = await callGeminiApi({
        action: 'research-schemes',
        query: 'Government procurement tenders and opportunities for MSMEs',
        userProfile,
      });
      return result?.recommendations || [];
    } catch {
      return [];
    }
  }
}

const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada',
  ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi',
  or: 'Odia', as: 'Assamese', ur: 'Urdu', ne: 'Nepali', kok: 'Konkani',
  ks: 'Kashmiri', sd: 'Sindhi', sa: 'Sanskrit', mai: 'Maithili', brx: 'Bodo',
  doi: 'Dogri', mni: 'Manipuri', sat: 'Santali'
};
