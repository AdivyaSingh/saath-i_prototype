// src/gemini.js
// All frontend AI calls go through this file. Pages import specific functions from here.

/**
 * Base function — calls /api/gemini Vercel serverless proxy.
 * Returns the text string from Gemini response, or null on error.
 * Includes timeout handling via AbortController.
 */
export async function callGemini(prompt, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.text || null;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error('Gemini request timed out');
    } else {
      console.error('Gemini error:', err);
    }
    return null;
  }
}

/**
 * Generates 3-4 comprehension questions for the Reading Room.
 * Returns an array of parsed question objects, or null.
 */
export async function generateComprehensionQuestions(passageText, language = 'EN', classLevel = 4) {
  const prompt = `Generate exactly 3 simple multiple-choice comprehension questions for a Class ${classLevel} Indian school student about this passage:
"${passageText}"

Language for questions: ${language === 'HI' ? 'Hindi' : 'English'}.
Return ONLY valid JSON with no extra text or markdown backticks.
Return an array of 3 question objects:
[
  { "question": "...", "options": ["...", "...", "...", "..."], "correct": 0 },
  { "question": "...", "options": ["...", "...", "...", "..."], "correct": 1 },
  { "question": "...", "options": ["...", "...", "...", "..."], "correct": 2 }
]
Rules:
- Each question must test different aspects (factual recall, inference, moral/theme)
- Each option must be 3-8 words maximum
- "correct" is the 0-based index of the right answer
- Keep questions simple and age-appropriate`;

  const raw = await callGemini(prompt, 20000);
  if (!raw) return null;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Keep the old single-question function for backward compatibility
export async function generateComprehensionQuestion(passageText, language = 'EN', classLevel = 4) {
  const prompt = `Generate 1 simple multiple-choice comprehension question for a Class ${classLevel} student about this passage:
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
 * Generates a reading passage appropriate for the given class level.
 * Returns a parsed object with passage and comprehension questions, or null.
 */
export async function generateReadingPassage(classLevel = 4, language = 'EN') {
  const lang = language === 'HI' ? 'Hindi' : 'English';
  const prompt = `Generate a short reading passage suitable for a Class ${classLevel} Indian school student.
The passage should:
- Be a simple, engaging story with moral values (similar to NCERT textbook stories)
- Be 80-120 words for Classes 1-3, 120-180 words for Classes 4-6, 150-200 words for Classes 7-10
- Use simple vocabulary appropriate for the grade level
- Be in ${lang}

After the passage, generate 3 comprehension questions with 4 multiple-choice options each.

Return ONLY valid JSON with NO markdown backticks:
{
  "title": "Story Title",
  "text": "Full passage text here...",
  "syllabledWords": { "difficult": "dif-fi-cult", "another": "an-oth-er" },
  "questions": [
    { "question": "Question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "correct": 0 }
  ]
}

Include 5-8 syllable breakdowns for the harder words in the passage.`;

  const raw = await callGemini(prompt, 20000);
  if (!raw) return null;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

/**
 * Generates math word problems appropriate for the given class level.
 * Returns parsed object or null.
 */
export async function generateMathActivity(classLevel = 4, type = 'addition') {
  const prompt = `Generate a simple math activity for a Class ${classLevel} Indian school student with dyscalculia.
Type: ${type}

The activity should:
- Use real-world objects that Indian children can relate to (fruits, animals, classroom items)
- Be visual and concrete — focus on counting objects, NOT abstract symbols
- Include clear step-by-step instructions

Return ONLY valid JSON with NO markdown backticks:
{
  "title": "Activity Title",
  "titleHI": "Hindi Title",
  "type": "${type}",
  "instruction": "What the student should do",
  "instructionHI": "Hindi instruction",
  "leftCount": 3,
  "rightCount": 4,
  "object": "apples",
  "objectHI": "सेब",
  "objectEmoji": "🍎",
  "answer": 7,
  "equation": "3 + 4 = 7"
}`;

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
 * Generates a creative writing prompt for Expression Studio.
 * Returns parsed object or null.
 */
export async function generateExpressionPrompt(classLevel = 4, language = 'EN') {
  const lang = language === 'HI' ? 'Hindi' : 'English';
  const prompt = `Generate a creative story-starter prompt for a Class ${classLevel} Indian school student with dysgraphia.

The prompt should:
- Be imaginative and open-ended
- Feature Indian settings, characters, or cultural elements
- Be short (1-2 sentences) but evocative
- Include related word tiles the student can use to build a response

Return ONLY valid JSON with NO markdown backticks:
{
  "prompt": "Story starter prompt in ${lang}...",
  "scene": "Brief scene description",
  "wordTiles": ["word1", "word2", "word3", "word4", "word5", "word6", "word7", "word8", "word9", "word10", "word11", "word12"]
}`;

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

  return await callGemini(prompt, 25000);
}

/**
 * Transcribes a voice recording blob using the Gemini API.
 * For prototype: uses browser Web Speech API as primary, Gemini as fallback concept.
 * Returns transcript string.
 */
export async function transcribeVoice(transcript) {
  if (!transcript) return '';
  const prompt = `A child with dysgraphia just told this story aloud. Clean up the transcription lightly — fix obvious speech errors and add punctuation — but keep their voice and words:
"${transcript}"
Return only the cleaned story text, no commentary.`;
  const result = await callGemini(prompt);
  return result || transcript;
}

/**
 * Generates an AI-powered learning suggestion for a student.
 * Used in teacher dashboard for dynamic insights.
 */
export async function generateStudentInsight(student) {
  const prompt = `You are an educational AI assistant helping Indian school teachers support students with ${student.sldType}.

Student: ${student.name}, Class ${student.class}
SLD: ${student.sldType} (${student.severity})
This week: ${student.weeklyStats.timeSpent} spent, ${student.weeklyStats.activitiesCompleted} activities, asked for help ${student.weeklyStats.helpRequests} times
Error patterns: ${student.errorPatterns.map(e => `${e.pattern} (${e.trend})`).join('; ')}

Generate a brief, actionable teaching suggestion (2-3 sentences) that:
- References specific observations from the data
- Suggests a concrete accommodation or strategy
- Uses encouraging, professional language

Return only the suggestion text, no headers or formatting.`;

  return await callGemini(prompt);
}

/**
 * Companion chatbot — generates a contextual, encouraging hint.
 * Called when student taps the companion widget.
 * @param {string} pageContext - what page the student is on and what they're doing
 * @param {string} companionName - the companion's nickname
 * @param {string} studentName - the student's name
 * @param {string} language - 'EN' or 'HI'
 */
export async function getCompanionHint(pageContext, companionName = 'Gyaan', studentName = 'friend', language = 'EN') {
  const lang = language === 'HI' ? 'Hindi' : 'English';
  const prompt = `You are ${companionName}, a friendly, encouraging learning companion for a child named ${studentName} who is learning to read and do maths. 

The child is currently: ${pageContext}

Generate a short, warm, encouraging message (1-2 sentences max) in ${lang} that:
- Is age-appropriate (8-12 years old)
- Is gentle and encouraging, never condescending
- Gives a small, helpful hint or nudge relevant to what they're doing
- Feels like a friend talking, not a teacher lecturing
- Does NOT use emojis or special characters

Return only the message text, nothing else.`;

  const result = await callGemini(prompt, 8000);
  if (result) return result;
  
  // Fallback messages if API fails
  const fallbacks = {
    EN: [
      "You're doing great! Take your time.",
      "I believe in you! Try your best.",
      "Every step counts. Keep going!",
    ],
    HI: [
      "बहुत अच्छा कर रहे हो! अपना समय लो।",
      "मुझे तुम पर भरोसा है! कोशिश करो।",
      "हर कदम मायने रखता है। आगे बढ़ो!",
    ],
  };
  const msgs = fallbacks[language] || fallbacks.EN;
  return msgs[Math.floor(Math.random() * msgs.length)];
}
