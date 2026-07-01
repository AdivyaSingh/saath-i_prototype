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
  const prompt = `Generate a simple math activity for a Class ${classLevel} Indian school student who benefits from numeracy support.
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
  const prompt = `Generate a creative story-starter prompt for a Class ${classLevel} Indian school student who benefits from writing support.

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
 * Combines four real data sources: the support profile (from screening/mastery data),
 * teacher observations, progress history, and specialist notes (if any).
 * Returns formatted text string or null.
 */
export async function generateIEP(student) {
  const mastered = Object.entries(student.masteryMap)
    .filter(([, v]) => v === 'mastered').map(([k]) => k);
  const struggling = Object.entries(student.masteryMap)
    .filter(([, v]) => v === 'struggling').map(([k]) => k);

  // Support profile, expressed by area and level — never as a named condition.
  const supportAreaLines = student.supportProfile
    ? Object.entries(student.supportProfile)
        .filter(([, level]) => level === 'some' || level === 'high')
        .map(([area, level]) => `${area} (${level === 'high' ? 'significant support' : 'some support'})`)
        .join(', ') || 'No significant support areas flagged'
    : 'Not yet screened';

  const tierLabel = { 1: 'Tier 1 - Classroom Support', 2: 'Tier 2 - Targeted Intervention', 3: 'Tier 3 - Specialist Referral' };
  const tierText = tierLabel[student.tier] || 'Tier 1 - Classroom Support';

  // Real data window, derived from how many weeks of progress history actually exist —
  // never a hardcoded number.
  const dataWeeks = Array.isArray(student.progressHistory) ? student.progressHistory.length : 0;
  const dataWindowText = dataWeeks > 0
    ? `${dataWeeks} week${dataWeeks === 1 ? '' : 's'} of app activity data`
    : 'Limited app activity data so far';

  // Teacher observations — real classroom notes, not assumed.
  const observationsText = (student.teacherObservations && student.teacherObservations.length > 0)
    ? student.teacherObservations.map(o => `- [${o.date}, ${o.author}] ${o.note}`).join('\n')
    : 'No teacher observations recorded yet.';

  // Specialist notes — only included if a referral has actually happened.
  const specialistText = (student.specialistNotes && student.specialistNotes.length > 0)
    ? student.specialistNotes.map(n => `- [${n.date}, ${n.author}] ${n.note}`).join('\n')
    : 'No specialist notes on file (student has not been referred, or referral is pending).';

  const prompt = `Generate a professional Individualised Education Plan (IEP) for an Indian school student. Align with NIEPID and Samagra Shiksha guidelines. Use clear, simple, support-based language for classroom teachers.

CRITICAL LANGUAGE RULE: Never diagnose or name a condition (do not say "has dyslexia/dysgraphia/dyscalculia" or similar). Always describe needs as "may benefit from support in [area]" using the support areas given below. Use the Tier 1/2/3 framework (classroom support / targeted intervention / specialist referral) when describing the level of support needed.

Student Details:
- Name: ${student.name}
- Class: ${student.class}
- School: ${student.school}
- Support areas needing attention: ${supportAreaLines}
- Current tier: ${tierText}
- Mastered concepts: ${mastered.join(', ') || 'None yet'}
- Struggling areas: ${struggling.join(', ') || 'None identified'}
- Key error patterns: ${student.errorPatterns.map(e => e.pattern).join('; ') || 'None recorded'}
- Data window: ${dataWindowText}

Teacher observations (classroom notes):
${observationsText}

Specialist notes (if a referral has occurred):
${specialistText}

Generate the IEP with exactly these 5 sections, using these exact headings:

## Student Performance Summary
(2-3 sentences describing current learning level and primary support need, written using support-based language and weaving in at least one teacher observation if available)

## Learning Objectives
(3 SMART goals — specific, measurable, achievable in 3 months. Format as numbered list.)

## Recommended Accommodations
(4-5 specific classroom accommodations, informed by the support areas, error patterns, and any specialist notes. Format as numbered list.)

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
  const prompt = `A child who benefits from writing support just told this story aloud. Clean up the transcription lightly — fix obvious speech errors and add punctuation — but keep their voice and words:
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
  const topAreas = student.supportProfile
    ? Object.entries(student.supportProfile)
        .filter(([, level]) => level === 'some' || level === 'high')
        .map(([area]) => area).join(', ') || 'no specific area flagged'
    : 'not yet screened';

  const prompt = `You are an educational AI assistant helping Indian school teachers support a student who may benefit from support in: ${topAreas}.

Student: ${student.name}, Class ${student.class}
This week: ${student.weeklyStats.timeSpent} spent, ${student.weeklyStats.activitiesCompleted} activities, asked for help ${student.weeklyStats.helpRequests} times
Error patterns: ${student.errorPatterns.map(e => `${e.pattern} (${e.trend})`).join('; ')}

Generate a brief, actionable teaching suggestion (2-3 sentences) that:
- References specific observations from the data
- Suggests a concrete accommodation or strategy
- Uses encouraging, professional, support-based language (never names a diagnosis)

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

/**
 * Generates a personalised 5-day intervention schedule for a student
 * based on their screening support profile.
 *
 * Activities: focus (Focus Zone), reading (Reading Room),
 *             numbers (Number World), catchup (Catch-Up Courses).
 *
 * Returns a structured JSON object, or null on AI failure.
 * Fire-and-forget — never block the student flow on this.
 *
 * @param {{ name, class, language, supportProfile, primarySupportArea, tier }} student
 */
export async function generateInterventionPlan(student) {
  const lang = (student.language || 'EN') === 'HI' ? 'Hindi' : 'English';

  const supportLines = student.supportProfile
    ? Object.entries(student.supportProfile)
        .filter(([, level]) => level === 'some' || level === 'high')
        .map(([area, level]) =>
          `${area} (${level === 'high' ? 'needs significant support' : 'needs some support'})`
        ).join(', ') || 'no specific areas flagged yet'
    : 'not yet determined';

  const tierMap = {
    1: 'Tier 1 - Classroom Support',
    2: 'Tier 2 - Targeted Intervention',
    3: 'Tier 3 - Specialist Referral',
  };

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are an educational AI creating a personalised 5-day learning schedule for a Class ${student.class || 4} Indian school student named ${student.name || 'the student'}.

Support profile: ${supportLines}
Support tier: ${tierMap[student.tier] || 'Tier 1'}
Primary area needing support: ${student.primarySupportArea || 'reading'}

The app has exactly 4 activities:
1. "focus"   - Focus Zone: attention and memory games (~5 min baseline)
2. "reading" - Reading Room: guided reading and phonics (~10 min baseline)
3. "numbers" - Number World: numeracy and counting games (~8 min baseline)
4. "catchup" - Catch-Up Courses: personalised skill-building (~10 min baseline)

Rules:
- Assign MORE minutes to activities that target the student's HIGHEST support areas
- All 4 activities appear across the week (not all 4 every day)
- Each day has exactly 2 activities
- whyKid must be warm, 1 sentence, in ${lang}, NO diagnosis labels
- overallGoal, day names, activity names, tip must all be in ${lang}

Return ONLY valid JSON, no markdown, no extra text:
{
  "overallGoal": "One encouraging sentence about this week's focus",
  "generatedAt": "${today}",
  "activities": [
    { "activityId": "reading", "activityName": "Reading Room",    "priority": 1, "recommendedMinutes": 15, "whyKid": "..." },
    { "activityId": "focus",   "activityName": "Focus Zone",      "priority": 2, "recommendedMinutes": 10, "whyKid": "..." },
    { "activityId": "catchup", "activityName": "Catch-Up Courses","priority": 3, "recommendedMinutes": 12, "whyKid": "..." },
    { "activityId": "numbers", "activityName": "Number World",    "priority": 4, "recommendedMinutes": 8,  "whyKid": "..." }
  ],
  "weeklyPlan": [
    { "day": "Monday",    "activities": [{"id":"reading","minutes":15},{"id":"focus","minutes":10}] },
    { "day": "Tuesday",   "activities": [{"id":"catchup","minutes":12},{"id":"numbers","minutes":8}] },
    { "day": "Wednesday", "activities": [{"id":"reading","minutes":15},{"id":"catchup","minutes":10}] },
    { "day": "Thursday",  "activities": [{"id":"numbers","minutes":10},{"id":"focus","minutes":10}] },
    { "day": "Friday",    "activities": [{"id":"reading","minutes":12},{"id":"catchup","minutes":12}] }
  ],
  "tip": "One short, friendly overall tip for the week"
}`;

  const raw = await callGemini(prompt, 25000);
  if (!raw) return null;
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!parsed.activities || !parsed.weeklyPlan) return null;
    return parsed;
  } catch {
    return null;
  }
}
