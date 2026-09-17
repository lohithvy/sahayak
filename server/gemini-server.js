import { GoogleGenAI } from '@google/genai';

const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];

const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada',
  ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi',
  or: 'Odia', as: 'Assamese', ur: 'Urdu', ne: 'Nepali', kok: 'Konkani',
  ks: 'Kashmiri', sd: 'Sindhi', sa: 'Sanskrit', mai: 'Maithili', brx: 'Bodo',
  doi: 'Dogri', mni: 'Manipuri', sat: 'Santali'
};

function getAI(apiKey) {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured on the server.');
  }
  return new GoogleGenAI({ apiKey });
}

async function generateWithFallback(ai, contents, baseConfig, enableSearch = false) {
  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    // 1. Try with search if requested
    if (enableSearch) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            ...baseConfig,
            tools: [{ googleSearch: {} }],
          },
        });
        const candidates = response.candidates;
        const groundingChunks = candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const citations = groundingChunks.map(chunk => chunk.web?.uri).filter(Boolean);
        return { text: response.text, citations, modelUsed: model };
      } catch (err) {
        console.warn(`[Gemini Server] Search on ${model} failed (${err?.status || err?.message?.slice(0, 80)}). Retrying ${model} without search...`);
      }
    }

    // 2. Standard generation without search
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: baseConfig,
      });
      return { text: response.text, citations: [], modelUsed: model };
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.code || err?.statusCode;
      console.warn(`[Gemini Server] Model ${model} failed with ${status}. Trying next available model...`);
    }
  }

  throw lastError || new Error('All Gemini model fallbacks exhausted.');
}

function parseSmartResponse(rawText, defaultLang = 'en') {
  if (!rawText) {
    return {
      type: 'general',
      response: 'Hello! How can I help you today?'
    };
  }

  const cleaned = rawText.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.type) return parsed;
    if (Array.isArray(parsed)) {
      return {
        type: 'scheme_results',
        summary: 'Here are the recommended schemes matching your query:',
        schemes: parsed
      };
    }
    if (parsed.schemes) {
      return {
        type: 'scheme_results',
        summary: parsed.summary || 'Here are the recommended schemes matching your query:',
        schemes: parsed.schemes
      };
    }
    if (parsed.response) {
      return {
        type: parsed.status ? 'eligibility' : 'general',
        response: parsed.response,
        status: parsed.status,
        missing_requirements: parsed.missing_requirements || []
      };
    }
    return parsed;
  } catch {
    // If not parseable JSON, cleanly treat as general text response
    return {
      type: 'general',
      response: cleaned
    };
  }
}

export async function handleGeminiRequest(reqBody, apiKey) {
  const {
    action,
    prompt,
    systemInstruction,
    enableSearch,
    query,
    userProfile,
    scheme,
    userDocuments,
    text,
    sourceLang,
    targetLang,
    transcript,
    language = 'en'
  } = reqBody;

  const ai = getAI(apiKey);

  switch (action) {
    case 'chat': {
      const config = {
        systemInstruction: systemInstruction || 'You are Sahayak, an AI assistant for Indian government schemes. Respond helpfully and accurately.',
        temperature: 0.3,
      };

      const result = await generateWithFallback(ai, prompt, config, !!enableSearch);
      return { text: result.text, citations: result.citations };
    }

    case 'dashboard-search':
    case 'research-schemes': {
      const langName = LANGUAGE_NAMES[language] || 'English';
      const sysInst = `You are Sahayak (सहायक), an official, citizen-focused AI assistant for discovering and understanding Indian government schemes and support.

CORE BEHAVIOR RULES:
1. Answer the user's actual query directly and concisely in ${langName} (language code: ${language}) using its native script.
2. For greetings (e.g. "Hi", "Hello", "Namaste", "வணக்கம்", "नमस्ते"):
   Return a "general" response type with a brief natural greeting. Do NOT dump schemes.
3. For scheme search requests (e.g. tailoring, dairy, loans, subsidies, women entrepreneur):
   Recommend 2 to 4 verifiable, official Indian government schemes (e.g. PMMY Mudra, PM Vishwakarma, Stand-Up India, PMEGP, State MSME schemes).
4. For eligibility questions:
   Analyze the user's profile and return an "eligibility" response type with clear explanation.
5. Use profile context silently for personalization. Never repeat or dump the user's raw profile.
6. Return your response as a valid JSON object matching ONE of these structures:

For Scheme Search:
{
  "type": "scheme_results",
  "summary": "Concise 1-2 sentence overview in ${langName}",
  "schemes": [
    {
      "name": "Scheme Name",
      "ministry": "Ministry or Department",
      "benefit": "Key financial or material benefit",
      "status": "eligible" | "not_eligible" | "more_information_required",
      "reason": "Why this matches user profile in ${langName}",
      "missing_documents": [],
      "official_url": "Official portal URL"
    }
  ]
}

For Greetings or Casual Inquiries:
{
  "type": "general",
  "response": "Brief natural greeting or response in ${langName}"
}

For Eligibility Inquiries:
{
  "type": "eligibility",
  "response": "Clear explanation in ${langName}",
  "status": "eligible" | "not_eligible" | "more_information_required",
  "missing_requirements": []
}

User Profile Context (use silently for personalization):
- Category: ${userProfile?.community_category || 'Not specified'}
- State: ${userProfile?.state || 'Not specified'}
- Business Type: ${userProfile?.business_type || 'Not specified'}
- Gender: ${userProfile?.gender || 'Not specified'}
- Annual Income: ${userProfile?.annual_income || 'Not specified'}

Return ONLY valid JSON. No markdown backticks, no commentary outside the JSON.`;

      const promptText = `User Query: "${query || ''}"`;

      const config = {
        systemInstruction: sysInst,
        temperature: 0.2,
      };

      const result = await generateWithFallback(ai, promptText, config, true);
      const parsed = parseSmartResponse(result.text, language);

      return {
        ...parsed,
        recommendations: parsed.schemes || [], // for backwards compatibility
        citations: result.citations || []
      };
    }

    case 'translate': {
      if (!text || sourceLang === targetLang) return { translatedText: text };
      const srcName = LANGUAGE_NAMES[sourceLang] || sourceLang;
      const tgtName = LANGUAGE_NAMES[targetLang] || targetLang;
      const p = `Translate the following text from ${srcName} (${sourceLang}) to ${tgtName} (${targetLang}). Return ONLY the translated text in the native script of ${tgtName}, nothing else.\n\nText: ${text}`;
      const config = {
        systemInstruction: `You are a professional translator specializing in Indian languages. Translate accurately from ${srcName} to ${tgtName} preserving meaning, tone, and cultural nuance. Return ONLY the translated text in the native script of ${tgtName}. Do not include quotes, explanations, markdown formatting, or notes.`,
        temperature: 0.1,
      };
      const result = await generateWithFallback(ai, p, config, false);
      let translated = (result.text || '').trim();
      if ((translated.startsWith('"') && translated.endsWith('"')) || (translated.startsWith('“') && translated.endsWith('”'))) {
        translated = translated.slice(1, -1).trim();
      }
      return { translatedText: translated || text };
    }

    case 'extract-speech': {
      const p = `Extract structured business profile information from this spoken input.
Language: ${language}
Input: "${transcript}"

Return a JSON object:
{
  "business_type": "",
  "business_category": "",
  "capital_required": 0,
  "business_status": "starting" or "existing",
  "business_location": "",
  "intent": "brief description of what user wants"
}

Return ONLY the JSON object.`;

      const config = {
        systemInstruction: 'You are a profile extraction engine. Extract structured data from natural language input in any Indian language.',
        temperature: 0.1,
      };

      const result = await generateWithFallback(ai, p, config, false);
      const cleaned = result.text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      try {
        return { profileData: JSON.parse(cleaned) };
      } catch {
        return { profileData: null };
      }
    }

    case 'analyze-eligibility': {
      const sysInst = `You are an eligibility analysis engine for Indian government schemes. Be precise and factual.`;
      const p = `Analyze if this user is eligible for the following scheme.

SCHEME: ${JSON.stringify(scheme)}
USER PROFILE: ${JSON.stringify(userProfile || {})}
USER DOCUMENTS: ${JSON.stringify(userDocuments || [])}

Return a JSON object:
{
  "status": "ELIGIBLE" or "NOT_ELIGIBLE" or "MORE_INFORMATION_REQUIRED" or "CONDITIONALLY_ELIGIBLE",
  "readiness_percentage": 0-100,
  "checks": [
    {"field": "field name", "label": "Human readable label", "passed": true/false, "reason": "explanation"}
  ],
  "missing_documents": ["list of missing required documents"],
  "missing_requirements": ["list of unmet requirements"],
  "action_items": ["what user needs to do"],
  "alternatives_note": "If not eligible, suggest what to explore instead"
}

Return ONLY the JSON object.`;

      const config = {
        systemInstruction: sysInst,
        temperature: 0.2,
      };

      const result = await generateWithFallback(ai, p, config, false);
      const cleaned = result.text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
      try {
        return { analysis: JSON.parse(cleaned) };
      } catch {
        return {
          analysis: {
            status: 'MORE_INFORMATION_REQUIRED',
            readiness_percentage: 0,
            checks: [],
            missing_documents: [],
            missing_requirements: ['Analysis unavailable'],
            action_items: ['Review details on the scheme portal'],
            alternatives_note: ''
          }
        };
      }
    }

    default:
      throw new Error(`Unknown Gemini action: ${action}`);
  }
}

