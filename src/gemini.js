// src/gemini.js
// All frontend AI calls go through this file. Pages import specific functions from here.

/**
 * Base function — calls /api/gemini Vercel serverless proxy.
 * Returns the text string from Gemini response, or null on error.
 */
export async function callGemini(prompt) {
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.text || null;
  } catch (err) {
    console.error('Gemini error:', err);
    return null;
  }
}

/**
 * Generates a comprehension question for the Reading Room.
 * Returns a parsed question object or null.
 */
export async function generateComprehensionQuestion(passageText, language = 'EN') {
  const prompt = `Generate 1 simple multiple-choice comprehension question for a Class 4 student with dyslexia about this passage:
"${passageText}"

Language for question: ${language === 'HI' ? 'Hindi' : 'English'}.
Return ONLY valid JSON with no extra text or markdown backticks:
{ "question": "...", "options": ["...", "...", "...", "..."], "correct": 0 }
Keep the question very simple. Each option must be 3-5 words maximum.`;

  const raw = await callGemini(prompt);
  if (!raw) return null;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

/**
 * Generates a full IEP for the IEP Generator page.
 * Returns formatted text string or null.
 */
export async function generateIEP(student) {
  const mastered = Object.entries(student.masteryMap)
    .filter(([, v]) => v === 'mastered').map(([k]) => k);
  const struggling = Object.entries(student.masteryMap)
    .filter(([, v]) => v === 'struggling').map(([k]) => k);

  const prompt = `Generate a professional Individualised Education Plan (IEP) for an Indian school student. Align with NIEPID and Samagra Shiksha guidelines. Use clear, simple language for classroom teachers.

Student Details:
- Name: ${student.name}
- Class: ${student.class}
- School: ${student.school}
- SLD Type: ${student.sldType}
- Severity: ${student.severity}
- Mastered concepts: ${mastered.join(', ') || 'None yet'}
- Struggling areas: ${struggling.join(', ') || 'None identified'}
- Key error patterns: ${student.errorPatterns.map(e => e.pattern).join('; ')}
- Weeks of app data: 6

Generate the IEP with exactly these 5 sections, using these exact headings:

## Student Performance Summary
(2-3 sentences describing current reading/learning level and primary difficulty)

## Learning Objectives
(3 SMART goals — specific, measurable, achievable in 3 months. Format as numbered list.)

## Recommended Accommodations
(4-5 specific classroom accommodations. Format as numbered list.)

## Review Date
(Set to 3 months from today. Write: "This IEP will be reviewed on [date].")

## Teacher Notes
(Leave blank — write only: "To be completed by [teacher name].")`;

  return await callGemini(prompt);
}

/**
 * Transcribes a voice recording blob using the Gemini API.
 * For prototype: uses browser Web Speech API as primary, Gemini as fallback concept.
 * Returns transcript string.
 */
export async function transcribeVoice(transcript) {
  // In the prototype, the browser's webkitSpeechRecognition handles real transcription.
  // This function polishes the raw transcript using Gemini.
  if (!transcript) return '';
  const prompt = `A child with dysgraphia just told this story aloud. Clean up the transcription lightly — fix obvious speech errors and add punctuation — but keep their voice and words:
"${transcript}"
Return only the cleaned story text, no commentary.`;
  const result = await callGemini(prompt);
  return result || transcript;
}
