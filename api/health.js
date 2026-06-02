// api/health.js
// Quick health-check endpoint to test that the Gemini API key works.
// GET /api/health → returns { ok: true, model: '...', sample: '...' } or error.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not set' });
  }

  const models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say hello in exactly 5 words.' }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 50 },
          }),
        }
      );

      const data = await response.json();
      if (data.error) {
        console.error(`Health check: model ${model} error:`, data.error.message);
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.status(200).json({ ok: true, model, sample: text.trim() });
    } catch (error) {
      console.error(`Health check: model ${model} failed:`, error.message);
      continue;
    }
  }

  return res.status(500).json({ ok: false, error: 'All models failed. API key may be invalid or expired.' });
}
