// api/gemini.js
// Vercel Serverless Function — proxies Gemini API calls, keeps API key server-side.

export default async function handler(req, res) {
  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body — Vercel auto-parses JSON but guard against edge cases
  let prompt;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt = body?.prompt;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  // Check API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Use current model — gemini-3.1-flash-lite (fast, stable, free-tier friendly)
  // Fallback chain: try 3.1-flash-lite first, then gemini-2.5-flash-lite
  const models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];

  for (const model of models) {
    try {
      console.log(`Calling Gemini model: ${model}`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      );

      const data = await response.json();

      // If this model doesn't exist or is broken, try next
      if (data.error) {
        console.error(`Model ${model} error:`, JSON.stringify(data.error));
        continue; // try next model in fallback chain
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) {
        console.error(`Model ${model} returned empty text. Full response:`, JSON.stringify(data));
        continue;
      }

      console.log(`Success with model ${model}. Response length: ${text.length} chars`);
      return res.status(200).json({ text });
    } catch (error) {
      console.error(`Model ${model} fetch error:`, error.message);
      continue; // try next model
    }
  }

  // All models failed
  return res.status(500).json({ error: 'All Gemini models failed. Check API key and model availability.' });
}
