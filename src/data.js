// src/data.js — complete data file for SAATHI prototype
// All hardcoded content lives here. Import from this file — never duplicate data inline in pages.

// ─── COMPANION OPTIONS ───────────────────────────────────────────────────────
export const COMPANIONS = [
  { id: 'owl',      emoji: '🦉', name: 'Gyaan',   description: 'Loves words and stories',      supportAreaDefault: 'reading' },
  { id: 'fox',      emoji: '🦊', name: 'Chiku',   description: 'Quick and clever',              supportAreaDefault: null },
  { id: 'elephant', emoji: '🐘', name: 'Moti',    description: 'Never forgets anything',        supportAreaDefault: 'numeracy' },
  { id: 'turtle',   emoji: '🐢', name: 'Dheeraj', description: 'Steady and sure always wins',   supportAreaDefault: null },
  { id: 'lion',     emoji: '🦁', name: 'Bahadur', description: 'Brave and bold',                supportAreaDefault: null },
  { id: 'parrot',   emoji: '🦜', name: 'Mithu',   description: 'Expressive and creative',       supportAreaDefault: 'writing' },
];

// ─── SCREENING DATA ───────────────────────────────────────────────────────────
// Threshold under which a student is classified as 'typical' (no SLD)
export const TYPICAL_THRESHOLD = 0.35;

// Word sets for the rhyming activity — each round has 4 words with 2 rhyming pairs
export const SCREENING_WORD_SETS = [
  { words: ['CAT', 'BAT', 'DOG', 'SUN'], rhymePair: [0, 1], difficulty: 'easy' },
  { words: ['PIN', 'SUN', 'WIN', 'CUP'], rhymePair: [0, 2], difficulty: 'easy' },
  { words: ['BALL', 'TALL', 'RED', 'SIT'], rhymePair: [0, 1], difficulty: 'medium' },
  { words: ['MAKE', 'TREE', 'LAKE', 'BLUE'], rhymePair: [0, 2], difficulty: 'medium' },
  { words: ['NIGHT', 'STOP', 'LIGHT', 'HAND'], rhymePair: [0, 2], difficulty: 'hard' },
];

// Pile comparison rounds — randomized sides
export const SCREENING_PILE_ROUNDS = [
  { left: 3, right: 7, difficulty: 'easy' },
  { left: 8, right: 5, difficulty: 'easy' },
  { left: 6, right: 8, difficulty: 'medium' },
  { left: 9, right: 7, difficulty: 'medium' },
  { left: 11, right: 9, difficulty: 'hard' },
  { left: 5, right: 6, difficulty: 'hard' },
];

// Tracing path control points for canvas
export const SCREENING_TRACE_PATHS = [
  {
    id: 'gentle_curve',
    difficulty: 'easy',
    points: [
      { x: 0.1, y: 0.5 }, { x: 0.25, y: 0.35 }, { x: 0.4, y: 0.3 },
      { x: 0.55, y: 0.35 }, { x: 0.7, y: 0.5 }, { x: 0.85, y: 0.55 }, { x: 0.95, y: 0.5 },
    ],
  },
  {
    id: 'zigzag',
    difficulty: 'medium',
    points: [
      { x: 0.08, y: 0.3 }, { x: 0.2, y: 0.6 }, { x: 0.35, y: 0.25 },
      { x: 0.5, y: 0.65 }, { x: 0.65, y: 0.3 }, { x: 0.8, y: 0.6 }, { x: 0.95, y: 0.35 },
    ],
  },
];

// ─── SUPPORT AREAS (replaces diagnostic SLD typing) ──────────────────────────
// Principle: no diagnosis, only support needs. A student's profile is expressed
// as levels of need across support areas, never as a named condition.
// Levels: 'low' | 'some' | 'high' — how much support a student may benefit from in that area.
export const SUPPORT_AREAS = [
  { id: 'reading',      labelEN: 'Reading Support',      labelHI: 'पठन सहायता' },
  { id: 'writing',      labelEN: 'Writing Support',      labelHI: 'लेखन सहायता' },
  { id: 'numeracy',     labelEN: 'Numeracy Support',     labelHI: 'संख्या सहायता' },
  { id: 'attention',    labelEN: 'Attention Support',    labelHI: 'ध्यान सहायता' },
  { id: 'memory',       labelEN: 'Memory Support',       labelHI: 'स्मृति सहायता' },
  { id: 'organisation', labelEN: 'Organisation Support', labelHI: 'व्यवस्था सहायता' },
];

// Tier framework: classroom support → targeted intervention → specialist referral.
export const TIER_LABELS = {
  1: { EN: 'Tier 1 — Classroom Support',      HI: 'स्तर 1 — कक्षा सहायता' },
  2: { EN: 'Tier 2 — Targeted Intervention',  HI: 'स्तर 2 — लक्षित हस्तक्षेप' },
  3: { EN: 'Tier 3 — Specialist Referral',    HI: 'स्तर 3 — विशेषज्ञ रेफरल' },
};

// ─── PRIORITY 6: SPECIAL EDUCATOR REFERRAL WORKFLOW ──────────────────────────
// Referral fields live directly on the student record (reuses existing
// student docs — no new Firestore collection). Defaults below are additive;
// every field is optional and every page that reads them falls back gracefully
// if a student doc was created before this feature existed.
//
// referralStatus: 'none' | 'recommended' | 'submitted' | 'under_review' | 'complete'
//   'recommended' is never written by the AI or by a script — it is only ever
//   computed for display (Tier 3 + no referral yet). Only a teacher's click on
//   "Refer to Special Educator" ever writes 'submitted'.
export const REFERRAL_STATUS_LABELS = {
  none:         { EN: 'No Referral',          HI: 'कोई रेफरल नहीं' },
  recommended:  { EN: 'Referral Recommended', HI: 'रेफरल सुझाया गया' },
  submitted:    { EN: 'Referral Submitted',   HI: 'रेफरल भेजा गया' },
  under_review: { EN: 'Under Review',         HI: 'समीक्षा जारी' },
  complete:     { EN: 'Review Complete',      HI: 'समीक्षा पूर्ण' },
};

// Practical, support-based recommendations a special educator can attach to a
// referral. Grouped by support area purely to help the specialist scan
// faster in the UI — any recommendation can be picked for any student.
export const RECOMMENDATION_TEMPLATES = [
  { id: 'rec_reading_1',  area: 'reading',      EN: 'Small-group reading intervention',              HI: 'छोटे समूह में पठन हस्तक्षेप' },
  { id: 'rec_reading_2',  area: 'reading',      EN: 'Additional phonological awareness practice',     HI: 'अतिरिक्त ध्वन्यात्मक जागरूकता अभ्यास' },
  { id: 'rec_reading_3',  area: 'reading',      EN: 'Paired/buddy reading with audio support',        HI: 'ऑडियो सहायता के साथ जोड़ी में पठन' },
  { id: 'rec_writing_1',  area: 'writing',      EN: 'Reduced writing load with oral alternatives',     HI: 'कम लेखन भार, मौखिक विकल्पों के साथ' },
  { id: 'rec_writing_2',  area: 'writing',      EN: 'Daily fine-motor / handwriting practice',         HI: 'दैनिक सूक्ष्म-गति / लिखावट अभ्यास' },
  { id: 'rec_numeracy_1', area: 'numeracy',     EN: 'Object-based maths before symbolic notation',     HI: 'प्रतीकों से पहले वस्तु-आधारित गणित' },
  { id: 'rec_numeracy_2', area: 'numeracy',     EN: 'Extra practice with place value and grouping',    HI: 'स्थानीय मान और समूहीकरण का अतिरिक्त अभ्यास' },
  { id: 'rec_attention_1',area: 'attention',    EN: 'Seating near the front, away from distractions',  HI: 'आगे की सीट, ध्यान भटकाने वाली चीज़ों से दूर' },
  { id: 'rec_attention_2',area: 'attention',    EN: 'Movement breaks every 15-20 minutes',              HI: 'हर 15-20 मिनट में गतिविधि अवकाश' },
  { id: 'rec_memory_1',   area: 'memory',       EN: 'Visual supports during instruction',               HI: 'निर्देश के दौरान दृश्य सहायता' },
  { id: 'rec_memory_2',   area: 'memory',       EN: 'Break multi-step instructions into smaller steps', HI: 'कई-चरण निर्देशों को छोटे चरणों में बाँटें' },
  { id: 'rec_org_1',      area: 'organisation', EN: 'Checklist or visual schedule for daily tasks',     HI: 'दैनिक कामों के लिए चेकलिस्ट या दृश्य अनुसूची' },
  { id: 'rec_general_1',  area: 'general',      EN: 'Weekly progress monitoring',                       HI: 'साप्ताहिक प्रगति निगरानी' },
  { id: 'rec_general_2',  area: 'general',      EN: 'Follow-up review in 4-6 weeks',                    HI: '4-6 सप्ताह में अनुवर्ती समीक्षा' },
];

// Mock special-educator roster — demo realism only, no real auth/DB needed.
export const MOCK_SPECIAL_EDUCATORS = [
  { id: 'se_001', name: 'Dr. Anjali Mehta', role: 'Special Educator' },
  { id: 'se_002', name: 'Mr. Suresh Iyer',  role: 'Special Educator' },
];

// Default referral fields merged onto every demo student below — keeps the
// rest of the app (cards, panels, queue page) safe even for older records
// that predate this feature.
const REFERRAL_DEFAULTS = {
  referralStatus: 'none',
  referralDate: null,
  teacherReferralReason: '',
  teacherNotes: '',
  referredBy: null,
  specialEducatorReviewer: null,
  specialEducatorNotes: '',
  specialEducatorRecommendations: [],
  reviewCompleted: false,
  reviewDate: null,
};

// ─── DEMO STUDENT DATA ────────────────────────────────────────────────────────
export const DEMO_STUDENTS = [
  {
    id: 'student_001',
    name: 'Arjun',
    class: 4,
    school: 'Team: CaseLyticals Demo School, Rajasthan',
    supportProfile: { reading: 'high', writing: 'some', numeracy: 'low', attention: 'low', memory: 'some', organisation: 'low' },
    primarySupportArea: 'reading',
    tier: 2,
    language: 'HI',
    lastActive: '2 hours ago',
    streakDays: 4,
    status: 'green',
    companion: { id: 'owl', emoji: '🦉', nickname: 'Gyaan' },
    masteryMap: {
      'CVC Words': 'mastered',
      'Rhyming Words': 'in_progress',
      'Sight Words (50)': 'in_progress',
      'Syllable Splitting': 'mastered',
      'Sentence Reading': 'not_started',
      'Short Passage Reading': 'struggling',
    },
    errorPatterns: [
      { pattern: 'b/d reversal', frequency: '7 of 10 instances', trend: 'improving' },
      { pattern: 'Word omission while reading aloud', frequency: '4 of 10 passages', trend: 'stable' },
      { pattern: "Reads 'was' as 'saw'", frequency: '3 of 10 instances', trend: 'improving' },
    ],
    weeklyStats: { timeSpent: '1h 23m', activitiesCompleted: 7, helpRequests: 3 },
    aiSuggestion: "Arjun responds better to oral assessments. His comprehension scores are strong when audio support is on — consider oral examination instead of written this week.",
    progressHistory: [62, 58, 55, 48],
    teacherObservations: [
      { date: '2026-05-28', author: 'Ms. Lata', note: 'Reads aloud confidently when given audio support first. Still mixes up b/d in unfamiliar words.' },
      { date: '2026-06-10', author: 'Ms. Lata', note: 'Volunteered to read in class for the first time this term — good sign of growing confidence.' },
    ],
    specialistNotes: [],
    ...REFERRAL_DEFAULTS,
  },
  {
    id: 'student_002',
    name: 'Priya',
    class: 6,
    school: 'Team: CaseLyticals Demo School, Pune, Maharashtra',
    supportProfile: { reading: 'low', writing: 'low', numeracy: 'high', attention: 'some', memory: 'low', organisation: 'some' },
    primarySupportArea: 'numeracy',
    tier: 2,
    language: 'EN',
    lastActive: '1 day ago',
    streakDays: 2,
    status: 'yellow',
    companion: { id: 'elephant', emoji: '🐘', nickname: 'Moti' },
    masteryMap: {
      'Counting to 20': 'mastered',
      'Single-digit Addition': 'mastered',
      'Double-digit Addition': 'struggling',
      'Subtraction with Borrowing': 'not_started',
      'Place Value': 'in_progress',
      'Multiplication (x2, x5)': 'not_started',
    },
    errorPatterns: [
      { pattern: 'Loses place value with numbers > 2 digits', frequency: '6 of 10 tasks', trend: 'stable' },
      { pattern: 'Digit transposition (writes 21 for 12)', frequency: '4 of 10 tasks', trend: 'improving' },
    ],
    weeklyStats: { timeSpent: '45m', activitiesCompleted: 4, helpRequests: 5 },
    aiSuggestion: "Priya struggles when abstract symbols appear before the visual model. Always show object-based counting before symbolic notation in her activities.",
    progressHistory: [45, 50, 48, 52],
    teacherObservations: [
      { date: '2026-06-02', author: 'Mr. Deshpande', note: 'Counts confidently with physical objects but freezes when the same problem is written as digits.' },
    ],
    specialistNotes: [],
    ...REFERRAL_DEFAULTS,
  },
  {
    id: 'student_003',
    name: 'Rohit',
    class: 5,
    school: 'Team: CaseLyticals Demo School, UP',
    supportProfile: { reading: 'high', writing: 'high', numeracy: 'low', attention: 'low', memory: 'low', organisation: 'low' },
    primarySupportArea: 'reading',
    language: 'HI',
    lastActive: '8 days ago',
    streakDays: 0,
    status: 'red',
    companion: { id: 'fox', emoji: '🦊', nickname: 'Chiku' },
    masteryMap: {
      'CVC Words': 'mastered',
      'Rhyming Words': 'mastered',
      'Sight Words (50)': 'in_progress',
      'Syllable Splitting': 'in_progress',
      'Sentence Reading': 'in_progress',
      'Short Passage Reading': 'in_progress',
    },
    errorPatterns: [
      { pattern: 'p/q reversal', frequency: '5 of 10 instances', trend: 'stable' },
      { pattern: 'Word skipping in long sentences', frequency: '3 of 10 passages', trend: 'worsening' },
    ],
    weeklyStats: { timeSpent: '0m', activitiesCompleted: 0, helpRequests: 0 },
    aiSuggestion: "Rohit has been inactive for 8 days. A brief personal encouragement often re-engages students. His last session showed good progress in sight words.",
    progressHistory: [55, 52, 50, 48],
    teacherObservations: [
      { date: '2026-05-20', author: 'Ms. Lata', note: 'Engaged and improving before the gap in activity. Worth a quick personal check-in to re-engage him.' },
    ],
    specialistNotes: [],
    ...REFERRAL_DEFAULTS,
    // Pre-seeded so the Special Educator Queue page has a realistic example
    // visible immediately, without needing to manually create one for a demo.
    tier: 3,
    referralStatus: 'submitted',
    referralDate: '2026-06-15',
    teacherReferralReason: 'Limited progress after several weeks of classroom-level reading support; concern that the gap may need a closer look beyond what I can do in class.',
    teacherNotes: 'Engaged when re-approached individually, but reading accuracy has not moved despite consistent practice.',
    referredBy: 'Ms. Lata',
  },
];

// ─── READING CONTENT ──────────────────────────────────────────────────────────
export const READING_CONTENT = [
  {
    id: 'read_001',
    title: 'The Clever Crow',
    titleHI: 'चतुर कौआ',
    gradeLevel: 4,
    text: 'It was a hot summer day. A crow was very thirsty. He looked for water everywhere. At last, he found a pot. The pot had very little water in it. The crow could not reach the water. He thought and thought. Then he had a clever idea. He picked up small stones one by one. He put them into the pot. Slowly the water came up. The crow drank the water and flew away happily.',
    textHI: 'एक बार एक कौआ था। उसे बहुत प्यास लगी थी। वह पानी की तलाश में इधर-उधर उड़ा। कहीं पानी नहीं मिला। तभी उसे एक घड़ा दिखा। घड़े में थोड़ा-सा पानी था। कौआ पानी तक नहीं पहुँच सकता था। उसने सोचा। फिर उसे एक तरकीब सूझी। उसने एक-एक करके कंकड़ उठाए। उसने सारे कंकड़ घड़े में डाले। पानी ऊपर आ गया। कौए ने पानी पीया और उड़ गया।',
    syllabledWords: {
      'everywhere': 'ev-ery-where',
      'clever': 'clev-er',
      'thirsty': 'thirs-ty',
      'slowly': 'slow-ly',
      'happily': 'hap-pi-ly',
      'water': 'wa-ter',
      'summer': 'sum-mer',
      'stones': 'stones',
    },
    comprehensionQuestions: [
      {
        question: 'Why was the crow looking for water?',
        questionHI: 'कौआ पानी क्यों ढूंढ रहा था?',
        options: ['He was hungry', 'He was thirsty', 'He was playing', 'He was lost'],
        correct: 1,
      },
      {
        question: 'What did the crow put into the pot?',
        questionHI: 'कौए ने घड़े में क्या डाला?',
        options: ['Sand', 'Leaves', 'Small stones', 'Sticks'],
        correct: 2,
      },
      {
        question: 'How did the crow feel at the end?',
        questionHI: 'अंत में कौआ कैसा महसूस कर रहा था?',
        options: ['Sad', 'Angry', 'Happy', 'Scared'],
        correct: 2,
      },
    ],
  },
  {
    id: 'read_002',
    title: 'The Honest Woodcutter',
    titleHI: 'ईमानदार लकड़हारा',
    gradeLevel: 3,
    text: 'Once there was a poor woodcutter. He went to the forest every day to cut wood. One day, his axe fell into the river. He sat by the river and began to cry. A kind fairy appeared. She brought a golden axe from the water. The woodcutter said it was not his. She brought a silver axe. He said no again. Then she brought his iron axe. He smiled and said it was his. The fairy was happy with his honesty. She gave him all three axes as a reward.',
    textHI: 'एक गरीब लकड़हारा था। वह रोज़ जंगल में लकड़ी काटने जाता था। एक दिन उसकी कुल्हाड़ी नदी में गिर गई। वह नदी किनारे बैठकर रोने लगा। एक दयालु परी प्रकट हुई। उसने पानी से एक सोने की कुल्हाड़ी निकाली। लकड़हारे ने कहा यह उसकी नहीं है। परी ने चांदी की कुल्हाड़ी निकाली। उसने फिर मना किया। फिर उसने लोहे की कुल्हाड़ी निकाली। लकड़हारा मुस्कुराया और बोला यही उसकी है। परी उसकी ईमानदारी से खुश हुई और तीनों कुल्हाड़ियाँ उसे दे दीं।',
    syllabledWords: {
      'woodcutter': 'wood-cut-ter',
      'forest': 'for-est',
      'appeared': 'ap-peared',
      'golden': 'gold-en',
      'silver': 'sil-ver',
      'honesty': 'hon-es-ty',
      'reward': 're-ward',
    },
    comprehensionQuestions: [
      {
        question: 'What fell into the river?',
        questionHI: 'नदी में क्या गिर गया?',
        options: ['A stone', 'His axe', 'A fish', 'His hat'],
        correct: 1,
      },
      {
        question: 'How many axes did the fairy bring?',
        questionHI: 'परी ने कितनी कुल्हाड़ियाँ निकालीं?',
        options: ['One', 'Two', 'Three', 'Four'],
        correct: 2,
      },
      {
        question: 'Why did the fairy give him all three axes?',
        questionHI: 'परी ने तीनों कुल्हाड़ियाँ क्यों दीं?',
        options: ['He was strong', 'He was poor', 'He was honest', 'He was sad'],
        correct: 2,
      },
    ],
  },
  {
    id: 'read_003',
    title: 'The Lion and the Mouse',
    titleHI: 'शेर और चूहा',
    gradeLevel: 5,
    text: 'A mighty lion was sleeping under a tree in the jungle. A tiny mouse was running nearby and accidentally ran across the lion\'s nose. The lion woke up in anger and caught the mouse. The mouse trembled with fear and begged the lion to let him go. He promised to help the lion one day. The lion laughed at such a small creature offering help, but he let the mouse go. Some days later, the lion was caught in a hunter\'s net. He roared loudly but could not escape. The little mouse heard the roar and came running. He began to gnaw through the ropes of the net with his sharp teeth. Soon the lion was free. The lion thanked the mouse and learned that even the smallest friend can be the greatest help.',
    textHI: 'एक ताकतवर शेर जंगल में एक पेड़ के नीचे सो रहा था। एक छोटा चूहा पास से दौड़ रहा था और गलती से शेर की नाक पर चढ़ गया। शेर गुस्से में जाग गया और चूहे को पकड़ लिया। चूहा डर के मारे काँपने लगा और शेर से छोड़ देने की विनती की। उसने वादा किया कि वह एक दिन शेर की मदद करेगा। शेर ने इतने छोटे जीव की मदद की बात पर हँसी की, लेकिन उसे छोड़ दिया। कुछ दिनों बाद शेर एक शिकारी के जाल में फँस गया। उसने ज़ोर से दहाड़ लगाई लेकिन निकल नहीं पाया। छोटे चूहे ने दहाड़ सुनी और दौड़ता हुआ आया। उसने अपने तेज़ दाँतों से जाल की रस्सियाँ काटनी शुरू कीं। जल्दी ही शेर आज़ाद हो गया।',
    syllabledWords: {
      'accidentally': 'ac-ci-den-tal-ly',
      'trembled': 'trem-bled',
      'promised': 'prom-ised',
      'creature': 'crea-ture',
      'offering': 'of-fer-ing',
      'escape': 'es-cape',
      'greatest': 'great-est',
    },
    comprehensionQuestions: [
      {
        question: 'What woke the lion up?',
        questionHI: 'शेर किससे जागा?',
        options: ['A loud noise', 'The mouse running on his nose', 'Rain falling', 'A hunter'],
        correct: 1,
      },
      {
        question: 'How did the mouse free the lion?',
        questionHI: 'चूहे ने शेर को कैसे आज़ाद किया?',
        options: ['Called for help', 'Cut the net with teeth', 'Pushed the net', 'Scared the hunter'],
        correct: 1,
      },
      {
        question: 'What lesson does this story teach?',
        questionHI: 'इस कहानी से क्या सीख मिलती है?',
        options: ['Big is always better', 'Even small friends can help greatly', 'Never sleep outside', 'Mice are stronger than lions'],
        correct: 1,
      },
    ],
  },
];

// ─── MATH CONTENT (NUMBER WORLD) ─────────────────────────────────────────────
export const MATH_ACTIVITIES = [
  {
    id: 'math_001',
    type: 'addition',
    title: 'Adding Apples',
    titleHI: 'सेब जोड़ो',
    gradeLevel: 3,
    leftCount: 3,
    rightCount: 4,
    object: 'apples',
    objectHI: 'सेब',
    objectEmoji: '🍎',
    equation: '3 + 4 = 7',
    answer: 7,
  },
  {
    id: 'math_002',
    type: 'comparison',
    title: 'Which group has more?',
    titleHI: 'किस समूह में ज़्यादा हैं?',
    gradeLevel: 3,
    rounds: [
      { left: 3, right: 7, objectEmoji: '🍊' },
      { left: 8, right: 5, objectEmoji: '🍋' },
      { left: 5, right: 6, objectEmoji: '🫐' },
    ],
  },
  {
    id: 'math_003',
    type: 'addition',
    title: 'Counting Stars',
    titleHI: 'तारे गिनो',
    gradeLevel: 4,
    leftCount: 5,
    rightCount: 6,
    object: 'stars',
    objectHI: 'तारे',
    objectEmoji: '⭐',
    equation: '5 + 6 = 11',
    answer: 11,
  },
  {
    id: 'math_004',
    type: 'subtraction',
    title: 'Birds Fly Away',
    titleHI: 'पक्षी उड़ गए',
    gradeLevel: 5,
    totalCount: 8,
    removeCount: 3,
    object: 'birds',
    objectHI: 'पक्षी',
    objectEmoji: '🐦',
    equation: '8 - 3 = 5',
    answer: 5,
  },
];

// ─── EXPRESSION PROMPTS ───────────────────────────────────────────────────────
export const EXPRESSION_PROMPTS = [
  {
    id: 'expr_001',
    prompt: 'Meera found a magical door in the forest. What was behind it?',
    promptHI: 'मीरा को जंगल में एक जादुई दरवाज़ा मिला। उसके पीछे क्या था?',
    scene: 'A mysterious door in a lush forest',
    wordTiles: ['door', 'magical', 'forest', 'found', 'light', 'beautiful', 'dark', 'stairs', 'Meera', 'she', 'the', 'a', 'and', 'then', 'was', 'went', 'inside', 'wonderful'],
    wordTilesHI: ['दरवाज़ा', 'जादुई', 'जंगल', 'मिला', 'रोशनी', 'सुंदर', 'अंधेरा', 'सीढ़ियाँ', 'मीरा', 'वह', 'और', 'फिर', 'था', 'गई', 'अंदर', 'अद्भुत'],
  },
  {
    id: 'expr_002',
    prompt: 'One night, a star fell into Raju\'s garden. What happened next?',
    promptHI: 'एक रात, राजू के बगीचे में एक तारा गिरा। फिर क्या हुआ?',
    scene: 'A glowing star in a garden at night',
    wordTiles: ['star', 'bright', 'garden', 'night', 'Raju', 'touched', 'glowing', 'warm', 'he', 'the', 'a', 'and', 'then', 'was', 'picked', 'wished', 'magic', 'happy'],
    wordTilesHI: ['तारा', 'चमकीला', 'बगीचा', 'रात', 'राजू', 'छुआ', 'चमक', 'गर्म', 'उसने', 'और', 'फिर', 'था', 'उठाया', 'जादू', 'खुश'],
  },
  {
    id: 'expr_003',
    prompt: 'The elephant ran away from the river. Why was it scared?',
    promptHI: 'हाथी नदी से भाग गया। वह क्यों डरा हुआ था?',
    scene: 'An elephant near a river',
    wordTiles: ['elephant', 'river', 'scared', 'water', 'big', 'ran', 'splash', 'loud', 'it', 'the', 'was', 'and', 'because', 'away', 'saw', 'something', 'heard', 'fast'],
    wordTilesHI: ['हाथी', 'नदी', 'डरा', 'पानी', 'बड़ा', 'भागा', 'छींटा', 'तेज़', 'वह', 'और', 'था', 'क्योंकि', 'दूर', 'देखा', 'कुछ', 'सुना'],
  },
];

// ─── ACHIEVEMENT DATA ──────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  { id: 'ach_001', icon: 'BookOpen',  title: 'You read 287 words this week!', titleHI: 'आपने इस हफ्ते 287 शब्द पढ़े!', category: 'reading', unlockCondition: 'reading' },
  { id: 'ach_002', icon: 'Star',      title: 'Word of the Day — 5 days in a row!', titleHI: 'दिन का शब्द — 5 दिन लगातार!', category: 'streak', unlockCondition: 'streak' },
  { id: 'ach_003', icon: 'Library',    title: 'You finished 3 stories in Reading Room', titleHI: 'आपने पठन कक्ष में 3 कहानियाँ पूरी कीं', category: 'reading', unlockCondition: 'reading' },
  { id: 'ach_004', icon: 'Calculator', title: 'Number World: 2 activities completed!', titleHI: 'संख्या जगत: 2 गतिविधियाँ पूरी!', category: 'maths', unlockCondition: 'maths' },
  { id: 'ach_005', icon: 'Mic',        title: 'You told 5 stories in Expression Studio', titleHI: 'आपने 5 कहानियाँ सुनाईं', category: 'expression', unlockCondition: 'expression' },
  { id: 'ach_006', icon: 'Flame',      title: '4-day learning streak! Keep going!', titleHI: '4 दिन की लर्निंग स्ट्रीक!', category: 'streak', unlockCondition: 'streak' },
];

// ─── RESOURCE LIBRARY ──────────────────────────────────────────────────────────
export const RESOURCES = [
  {
    id: 'res_001',
    title: 'Reading Support Classroom Checklist',
    supportArea: 'reading',
    classLevel: 'All',
    type: 'Accommodation Guide',
    description: 'Step-by-step classroom accommodation checklist for teachers supporting students who benefit from reading support.',
    rating: 4,
    preview: `READING SUPPORT CLASSROOM CHECKLIST\n\nSeating: Place the student near the front, away from distractions.\nFont: Use OpenDyslexic or Arial 14pt+ in all printed materials.\nAssessment: Offer oral examination as an alternative to written tests.\nTime: Provide 1.5x extended time on all timed tasks.\nReading: Allow use of a finger or ruler as a line guide.\nNote-taking: Provide printed notes rather than requiring board copying.\nEncouragement: Acknowledge effort verbally every session.`,
  },
  {
    id: 'res_002',
    title: 'Object-Based Maths Lesson Plan',
    supportArea: 'numeracy',
    classLevel: '3–6',
    type: 'Lesson Plan',
    description: 'Step-by-step lesson plan for teaching addition and subtraction using physical objects before symbols, for students who benefit from numeracy support.',
    rating: 5,
    preview: `OBJECT-BASED MATHS LESSON — CLASS 3-6\n\nLesson Goal: Teach 2-digit addition using physical grouping.\n\nStep 1: Use 10-20 physical counters (bottle caps, stones, or beans).\nStep 2: Ask student to group counters into two piles (e.g. 6 and 8).\nStep 3: Student physically counts total by moving each counter to a new pile.\nStep 4: Only after counting is complete, write the equation on paper: 6 + 8 = 14.\nStep 5: Repeat with different values. NEVER introduce symbols first.\n\nKey rule: Equation notation always follows physical experience. Never precedes it.`,
  },
  {
    id: 'res_003',
    title: 'Parent Communication Template — Reading Support',
    supportArea: 'reading',
    classLevel: 'All',
    type: 'Parent Template',
    description: 'Plain-language letter to help teachers communicate a reading support need to parents respectfully.',
    rating: 4,
    preview: `Dear Parent/Guardian,\n\nI am writing to share some observations about your child's learning that I believe will be helpful.\n\nYour child is a hardworking and enthusiastic student. I have noticed that they sometimes find reading and writing activities more challenging than other areas — this is not uncommon, and it does not reflect their intelligence or effort at all.\n\nI would like to discuss some learning support strategies that have helped many children. These are simple adjustments to how we present information that can make a significant difference.\n\nPlease feel free to contact me at your convenience. I look forward to working together for your child's success.\n\nWarm regards,\n[Teacher Name]`,
  },
  {
    id: 'res_004',
    title: 'Expression Studio Prompt Cards',
    supportArea: 'writing',
    classLevel: '3–8',
    type: 'Activity Resource',
    description: 'Illustrated prompt cards for students who benefit from writing support to use voice or drawing instead of writing.',
    rating: 5,
    preview: `EXPRESSION STUDIO PROMPT CARDS\n\nHow to use: Show the student the illustrated prompt. Let them choose how to respond: speak their answer aloud, draw it, or arrange word tiles.\n\nPrompt 1: "Meera found a magical door in the forest. What was behind it?"\nPrompt 2: "The elephant ran away from the river. Why was it scared?"\nPrompt 3: "One night, a star fell into Raju's garden. What happened next?"\nPrompt 4: "On the last day of school, everyone got a surprise. What was it?"\n\nReminder: There is no wrong answer. Celebrate every response.`,
  },
  {
    id: 'res_005',
    title: 'Writing Support Alternatives Guide',
    supportArea: 'writing',
    classLevel: 'All',
    type: 'Accommodation Guide',
    description: 'Practical guide for providing writing alternatives to students who benefit from writing support.',
    rating: 4,
    preview: `WRITING ALTERNATIVES — SUPPORT GUIDE\n\nPrinciple: The goal is expression, not handwriting.\n\n1. Voice recording: Let students record verbal answers instead of writing.\n2. Word processors: Allow typing instead of handwriting where possible.\n3. Graphic organizers: Use visual maps instead of written outlines.\n4. Word tiles: Pre-printed word cards that students arrange into sentences.\n5. Drawing as response: Accept illustrated answers for comprehension tasks.\n6. Scribe support: Allow a peer or aide to write what the student dictates.\n\nKey: Always evaluate content quality, not handwriting neatness.`,
  },
];

// ─── UI STRINGS (EN / HI) ─────────────────────────────────────────────────────
// NOTE: No emojis in string constants — emojis are added in components where needed
export const STRINGS = {
  EN: {
    appName: 'Saath-i',
    tagline: 'Your journey to learning your way',
    startExploring: 'Start exploring',
    haveClassCode: 'I have a class code',
    todaysJourney: "Today's Journey",
    readingRoom: 'Reading Room',
    numberWorld: 'Number World',
    expressionStudio: 'Expression Studio',
    achievementWall: 'Achievement Wall',
    iAmStruggling: "I need help",
    generateIEP: 'Support Plan',
    teacherDashboard: 'Teacher Dashboard',
    offlineBanner: 'Offline mode — data will sync when connected',
    welcomeBack: 'Welcome back!',
    goodMorning: 'Good morning',
    continue: 'Continue',
    skip: 'Skip for now',
    letsDo: "Let's go!",
    chooseCompanion: 'Choose your learning buddy',
    companionTagline: 'Your buddy will cheer you on every step of the way',
    learnerProfileReveal: "You're all set! Let's discover how you like to learn best.",
    screeningTitle: "Let's see how you like to learn",
    breathe: "Let's take a breath",
    tryEasier: 'Want to try something a bit easier first?',
    loginTitle: 'Teacher Dashboard',
    schoolCode: 'School Code',
    teacherName: 'Your Name',
    loginButton: 'Login as Teacher',
    resourceLibrary: 'Resource Library',
    demoModeLabel: 'Demo Mode',
    screeningComplete: 'Learning profile created',
    supportNeed: 'Support need',
    needsMoreData: 'Needs more data',
  },
  HI: {
    appName: 'साथी',
    tagline: 'अपने तरीके से सीखने की यात्रा',
    startExploring: 'शुरू करें',
    haveClassCode: 'मेरे पास क्लास कोड है',
    todaysJourney: 'आज की यात्रा',
    readingRoom: 'पठन कक्ष',
    numberWorld: 'संख्या जगत',
    expressionStudio: 'अभिव्यक्ति स्टूडियो',
    achievementWall: 'उपलब्धि दीवार',
    iAmStruggling: 'मुझे मदद चाहिए',
    generateIEP: 'सपोर्ट प्लान',
    teacherDashboard: 'शिक्षक डैशबोर्ड',
    offlineBanner: 'ऑफलाइन मोड — कनेक्ट होने पर डेटा सिंक होगा',
    welcomeBack: 'वापस स्वागत है!',
    goodMorning: 'सुप्रभात',
    continue: 'आगे बढ़ें',
    skip: 'अभी छोड़ें',
    letsDo: 'चलो शुरू करें!',
    chooseCompanion: 'अपना साथी चुनें',
    companionTagline: 'आपका साथी हर कदम पर आपको प्रोत्साहित करेगा',
    learnerProfileReveal: 'आप तैयार हैं! चलिए देखते हैं आपको कैसे सीखना पसंद है।',
    screeningTitle: 'देखते हैं आपको सीखना कैसे पसंद है',
    breathe: 'एक सांस लेते हैं',
    tryEasier: 'क्या पहले कुछ आसान करना चाहेंगे?',
    loginTitle: 'शिक्षक डैशबोर्ड',
    schoolCode: 'स्कूल कोड',
    teacherName: 'आपका नाम',
    loginButton: 'शिक्षक के रूप में लॉगिन करें',
    resourceLibrary: 'संसाधन पुस्तकालय',
    demoModeLabel: 'डेमो मोड',
    screeningComplete: 'लर्निंग प्रोफ़ाइल बन गई',
    supportNeed: 'सहायता आवश्यकता',
    needsMoreData: 'अधिक डेटा चाहिए',
  },
};
