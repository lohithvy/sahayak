import { handleGeminiRequest } from '../server/gemini-server.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // GEMINI_API_KEY is read strictly server-side
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Vercel Gemini API] GEMINI_API_KEY is not configured in server environment.');
    return res.status(500).json({ 
      error: 'Gemini API key is not configured on the server. Please set GEMINI_API_KEY in Vercel environment variables.' 
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body || '{}');
      } catch {
        body = {};
      }
    } else if (!body) {
      body = {};
    }

    const result = await handleGeminiRequest(body, apiKey);
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Vercel Gemini API Error]:', error?.message || error);
    return res.status(error?.status || 500).json({
      error: error?.message || 'Server-side Gemini processing failed'
    });
  }
}
