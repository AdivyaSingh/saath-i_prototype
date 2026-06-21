// src/pages/CatchUpCourses.jsx
// Route: /catch-up
// Personalised Catch-Up Courses — identifies a child's support area from
// screeningResults (or defaults gracefully) and presents a 5-level remediation
// ladder: Foundations → Reinforcement → Transition → Integration → Mastery.
// Each level has 3 distinct game mechanics. Progress is stored in appState and
// written to Firebase when a studentId is present.
//
// Design principles (from implementation plan):
//   • No diagnosis labels — support-based framing only
//   • Audio instruction support (speak helper) throughout
//   • No punishing timers; effort celebrated over accuracy
//   • Works fully offline with mock data; no AI calls required
//   • Tier 1 → Tier 2 → Tier 3 language in level descriptions

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calculator, PenLine, ArrowRight, ArrowLeft,
  Volume2, Check, Star, Trophy, Sparkles, RefreshCw,
  ChevronRight, Lock, PlayCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { updateStudentProgress } from '../firebase';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const speak = (text, lang = 'EN') => {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  } catch { /* ignore */ }
};

const celebrate = () => {
  try { confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 } }); } catch { }
};

// ─── SHARED UI ATOMS ──────────────────────────────────────────────────────────

const SpeakBtn = ({ text, lang }) => (
  <button
    onClick={() => speak(text, lang)}
    className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0"
    aria-label="Read aloud"
  >
    <Volume2 className="w-4 h-4" />
  </button>
);

const Instruction = ({ text, lang }) => (
  <div className="flex items-center justify-center gap-2 mb-5">
    <p className="text-primary font-semibold text-base text-center leading-snug">{text}</p>
    <SpeakBtn text={text} lang={lang} />
  </div>
);

const FeedbackBadge = ({ correct, lang }) =>
  correct === null ? null : (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`text-center py-2 px-4 rounded-xl font-semibold text-sm mb-3 ${
        correct ? 'bg-success/15 text-success' : 'bg-warm/15 text-warm'
      }`}
    >
      {correct
        ? (lang === 'HI' ? '🎉 सही! बढ़िया काम!' : '🎉 Correct! Well done!')
        : (lang === 'HI' ? '🙂 लगभग सही — फिर से कोशिश करो!' : '🙂 Almost! Try again!')}
    </motion.div>
  );

const LevelCompleteBanner = ({ lang, onNext, isLast }) => {
  useEffect(() => { celebrate(); }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-6"
    >
      <div className="w-20 h-20 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-3">
        <Trophy className="w-10 h-10 text-success" />
      </div>
      <h3 className="text-xl font-bold text-primary mb-1">
        {lang === 'HI' ? 'स्तर पूरा!' : 'Level Complete!'}
      </h3>
      <p className="text-muted text-sm mb-5">
        {lang === 'HI' ? 'तुमने सभी 3 खेल खेले।' : 'You finished all 3 games!'}
      </p>
      {!isLast ? (
        <button onClick={onNext} className="btn-primary">
          {lang === 'HI' ? 'अगला स्तर' : 'Next Level'} <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <div className="space-y-2">
          <div className="bg-warm/10 rounded-xl p-4 text-warm font-semibold">
            {lang === 'HI' ? '🌟 सभी स्तर पूरे! तुम शानदार हो!' : '🌟 All levels done! You\'re amazing!'}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ─── COURSE DATA ──────────────────────────────────────────────────────────────
// Three support tracks. Each has 5 levels, each level has 3 games.
// Game types reuse shared game components with different data payloads.

// ── READING SUPPORT ──────────────────────────────────────────────────────────

const READING_LEVELS = [
  {
    id: 'R1',
    rung: 'Foundations',
    rungHI: 'नींव',
    title: 'Sounds & Letters',
    titleHI: 'आवाज़ें और अक्षर',
    desc: 'Listen to sounds, tap the right picture. Audio support on.',
    descHI: 'आवाज़ सुनो, सही चित्र पर टैप करो।',
    tier: 1,
    games: [
      {
        type: 'tap_correct',
        instruction: 'Tap the picture that starts with the sound  /m/',
        instructionHI: '/म/ की आवाज़ से शुरू होने वाले चित्र पर टैप करो',
        options: [
          { label: '🐒 Monkey', value: 'monkey', correct: true },
          { label: '🐟 Fish', value: 'fish', correct: false },
          { label: '🐘 Elephant', value: 'elephant', correct: false },
          { label: '🦁 Lion', value: 'lion', correct: false },
        ],
      },
      {
        type: 'tap_correct',
        instruction: 'Which word rhymes with CAT?',
        instructionHI: 'CAT के साथ कौन सा शब्द तुकबंदी करता है?',
        options: [
          { label: 'BAT', value: 'bat', correct: true },
          { label: 'DOG', value: 'dog', correct: false },
          { label: 'SUN', value: 'sun', correct: false },
          { label: 'PEN', value: 'pen', correct: false },
        ],
      },
      {
        type: 'tap_correct',
        instruction: 'Tap the letter that makes the sound /s/',
        instructionHI: '/स/ की आवाज़ बनाने वाले अक्षर पर टैप करो',
        options: [
          { label: 'S', value: 's', correct: true },
          { label: 'B', value: 'b', correct: false },
          { label: 'T', value: 't', correct: false },
          { label: 'M', value: 'm', correct: false },
        ],
      },
    ],
  },
  {
    id: 'R2',
    rung: 'Reinforcement',
    rungHI: 'अभ्यास',
    title: 'Word Families',
    titleHI: 'शब्द परिवार',
    desc: 'Build words from letter tiles. Same pattern, different words.',
    descHI: 'अक्षरों से शब्द बनाओ।',
    tier: 1,
    games: [
      {
        type: 'word_builder',
        instruction: 'Tap letters in order to spell: PIN',
        instructionHI: 'अक्षरों को क्रम में टैप करके लिखो: PIN',
        targetWord: 'PIN',
        letters: shuffle(['P', 'I', 'N', 'A', 'T', 'S']),
      },
      {
        type: 'odd_one_out',
        instruction: 'Tap the word that does NOT belong in this family (-at words)',
        instructionHI: 'वह शब्द टैप करो जो इस परिवार में नहीं है (-at शब्द)',
        options: [
          { label: 'CAT', value: 'cat', correct: false },
          { label: 'BAT', value: 'bat', correct: false },
          { label: 'HAT', value: 'hat', correct: false },
          { label: 'BUS', value: 'bus', correct: true },
        ],
      },
      {
        type: 'word_builder',
        instruction: 'Tap letters in order to spell: HOP',
        instructionHI: 'अक्षरों को क्रम में टैप करके लिखो: HOP',
        targetWord: 'HOP',
        letters: shuffle(['H', 'O', 'P', 'B', 'N', 'E']),
      },
    ],
  },
  {
    id: 'R3',
    rung: 'Reinforcement',
    rungHI: 'अभ्यास',
    title: 'Sight Words',
    titleHI: 'दृष्टि शब्द',
    desc: 'Recognise common words by sight — no sounding out needed.',
    descHI: 'सामान्य शब्दों को देखकर पहचानो।',
    tier: 1,
    games: [
      {
        type: 'tap_correct',
        instruction: 'Find the word: THEY',
        instructionHI: 'शब्द ढूंढो: THEY',
        options: [
          { label: 'THEN', value: 'then', correct: false },
          { label: 'THEY', value: 'they', correct: true },
          { label: 'THEE', value: 'thee', correct: false },
          { label: 'THEM', value: 'them', correct: false },
        ],
      },
      {
        type: 'tap_correct',
        instruction: 'Which word is: BECAUSE',
        instructionHI: 'कौन सा शब्द है: BECAUSE',
        options: [
          { label: 'BEFORE', value: 'before', correct: false },
          { label: 'BECAME', value: 'became', correct: false },
          { label: 'BECAUSE', value: 'because', correct: true },
          { label: 'BETWEEN', value: 'between', correct: false },
        ],
      },
      {
        type: 'sentence_tap',
        instruction: 'Tap the words in the right order to make a sentence',
        instructionHI: 'शब्दों को सही क्रम में टैप करो',
        words: ['The', 'cat', 'sat', 'on', 'the', 'mat'],
        scrambled: shuffle(['The', 'cat', 'sat', 'on', 'the', 'mat']),
      },
    ],
  },
  {
    id: 'R4',
    rung: 'Transition',
    rungHI: 'प्रयोग',
    title: 'Reading in Context',
    titleHI: 'संदर्भ में पढ़ना',
    desc: 'Read short sentences and choose what fits best.',
    descHI: 'छोटे वाक्य पढ़ो और सही उत्तर चुनो।',
    tier: 2,
    games: [
      {
        type: 'fill_blank',
        instruction: 'Choose the word that completes the sentence',
        instructionHI: 'वह शब्द चुनो जो वाक्य पूरा करे',
        sentence: 'The dog ran ___ the house.',
        sentenceHI: 'कुत्ता घर के ___ भागा।',
        options: [
          { label: 'into', value: 'into', correct: true },
          { label: 'onto', value: 'onto', correct: false },
          { label: 'under', value: 'under', correct: false },
        ],
      },
      {
        type: 'fill_blank',
        instruction: 'Choose the word that fits',
        instructionHI: 'सही शब्द चुनो',
        sentence: 'She ___ her book and began to read.',
        sentenceHI: 'उसने अपनी किताब ___ और पढ़ने लगी।',
        options: [
          { label: 'opened', value: 'opened', correct: true },
          { label: 'closed', value: 'closed', correct: false },
          { label: 'threw', value: 'threw', correct: false },
        ],
      },
      {
        type: 'tap_correct',
        instruction: 'Read this sentence: "The bird flew high." What did the bird do?',
        instructionHI: '"चिड़िया ऊँची उड़ी।" चिड़िया ने क्या किया?',
        options: [
          { label: '🦅 Flew high', value: 'flew', correct: true },
          { label: '🐟 Swam deep', value: 'swam', correct: false },
          { label: '😴 Slept', value: 'slept', correct: false },
          { label: '🍎 Ate an apple', value: 'ate', correct: false },
        ],
      },
    ],
  },
  {
    id: 'R5',
    rung: 'Integration',
    rungHI: 'एकीकरण',
    title: 'Story Time',
    titleHI: 'कहानी का समय',
    desc: 'Read a short passage and answer questions. You can do this!',
    descHI: 'छोटा पाठ पढ़ो और सवालों के जवाब दो।',
    tier: 2,
    games: [
      {
        type: 'passage_qa',
        passage: 'Priya saw a small puppy near the park. It was brown and had big eyes. She gave it some water. The puppy wagged its tail and licked her hand.',
        passageHI: 'प्रिया को पार्क के पास एक छोटा सा पिल्ला दिखा। वह भूरा था और उसकी बड़ी-बड़ी आँखें थीं। उसने उसे पानी दिया। पिल्ले ने पूंछ हिलाई और उसका हाथ चाटा।',
        question: 'What colour was the puppy?',
        questionHI: 'पिल्ला किस रंग का था?',
        options: [
          { label: 'Black', value: 'black', correct: false },
          { label: 'Brown', value: 'brown', correct: true },
          { label: 'White', value: 'white', correct: false },
        ],
      },
      {
        type: 'passage_qa',
        passage: 'Raju woke up late. He quickly ate his breakfast and ran to school. His teacher smiled and said, "You made it on time!"',
        passageHI: 'राजू देर से उठा। उसने जल्दी से नाश्ता खाया और स्कूल के लिए भागा। उसकी शिक्षिका ने मुस्कुराते हुए कहा, "तुम समय पर आ गए!"',
        question: 'How did Raju get to school?',
        questionHI: 'राजू स्कूल कैसे पहुँचा?',
        options: [
          { label: 'He walked slowly', value: 'slow', correct: false },
          { label: 'He ran', value: 'ran', correct: true },
          { label: 'He took a bus', value: 'bus', correct: false },
        ],
      },
      {
        type: 'sequence_order',
        instruction: 'Put these events in the order they happened in the story about Raju',
        instructionHI: 'राजू की कहानी में ये घटनाएँ किस क्रम में हुईं?',
        items: [
          { id: 1, text: 'Raju woke up late', textHI: 'राजू देर से उठा', order: 0 },
          { id: 2, text: 'He ate breakfast', textHI: 'उसने नाश्ता खाया', order: 1 },
          { id: 3, text: 'He ran to school', textHI: 'वह स्कूल के लिए भागा', order: 2 },
          { id: 4, text: 'Teacher said "You made it!"', textHI: 'शिक्षिका ने कहा "तुम आ गए!"', order: 3 },
        ],
      },
    ],
  },
];

// ── NUMERACY SUPPORT ─────────────────────────────────────────────────────────

const NUMERACY_LEVELS = [
  {
    id: 'N1',
    rung: 'Foundations',
    rungHI: 'नींव',
    title: 'Count & Match',
    titleHI: 'गिनो और मिलाओ',
    desc: 'Count objects and tap the matching number.',
    descHI: 'चीज़ें गिनो और सही संख्या पर टैप करो।',
    tier: 1,
    games: [
      {
        type: 'count_tap',
        instruction: 'Count the apples and tap the right number',
        instructionHI: 'सेब गिनो और सही संख्या पर टैप करो',
        emoji: '🍎',
        count: 5,
        options: [3, 5, 7, 9],
        answer: 5,
      },
      {
        type: 'count_tap',
        instruction: 'Count the stars and tap the right number',
        instructionHI: 'तारे गिनो और सही संख्या पर टैप करो',
        emoji: '⭐',
        count: 8,
        options: [6, 8, 10, 12],
        answer: 8,
      },
      {
        type: 'tap_correct',
        instruction: 'Which picture shows the number 4?',
        instructionHI: 'कौन सा चित्र संख्या 4 दिखाता है?',
        options: [
          { label: '🌟🌟🌟', value: '3', correct: false },
          { label: '🌟🌟🌟🌟', value: '4', correct: true },
          { label: '🌟🌟🌟🌟🌟', value: '5', correct: false },
          { label: '🌟🌟', value: '2', correct: false },
        ],
      },
    ],
  },
  {
    id: 'N2',
    rung: 'Reinforcement',
    rungHI: 'अभ्यास',
    title: 'More or Less',
    titleHI: 'ज़्यादा या कम',
    desc: 'Compare two groups. Which has more?',
    descHI: 'दो समूहों की तुलना करो।',
    tier: 1,
    games: [
      {
        type: 'compare_groups',
        instruction: 'Which group has MORE?',
        instructionHI: 'किस समूह में ज़्यादा हैं?',
        left: { emoji: '🍊', count: 3 },
        right: { emoji: '🍊', count: 7 },
        answer: 'right',
      },
      {
        type: 'compare_groups',
        instruction: 'Which group has FEWER?',
        instructionHI: 'किस समूह में कम हैं?',
        left: { emoji: '🫐', count: 9 },
        right: { emoji: '🫐', count: 4 },
        answer: 'right',
      },
      {
        type: 'tap_correct',
        instruction: 'Which number is bigger: 6 or 9?',
        instructionHI: 'कौन सी संख्या बड़ी है: 6 या 9?',
        options: [
          { label: '6', value: '6', correct: false },
          { label: '9', value: '9', correct: true },
          { label: 'They are equal', value: 'equal', correct: false },
        ],
      },
    ],
  },
  {
    id: 'N3',
    rung: 'Reinforcement',
    rungHI: 'अभ्यास',
    title: 'Adding Together',
    titleHI: 'मिलकर जोड़ना',
    desc: 'See objects first, then find the total.',
    descHI: 'पहले चीज़ें देखो, फिर कुल गिनो।',
    tier: 1,
    games: [
      {
        type: 'visual_addition',
        instruction: 'How many altogether?',
        instructionHI: 'कुल मिलाकर कितने?',
        left: { emoji: '🍎', count: 3 },
        right: { emoji: '🍎', count: 4 },
        answer: 7,
        options: [5, 6, 7, 8],
      },
      {
        type: 'visual_addition',
        instruction: 'Count all the flowers',
        instructionHI: 'सारे फूल गिनो',
        left: { emoji: '🌸', count: 5 },
        right: { emoji: '🌸', count: 3 },
        answer: 8,
        options: [6, 7, 8, 9],
      },
      {
        type: 'tap_correct',
        instruction: '4 + 5 = ?',
        instructionHI: '4 + 5 = ?',
        options: [
          { label: '8', value: '8', correct: false },
          { label: '9', value: '9', correct: true },
          { label: '10', value: '10', correct: false },
          { label: '7', value: '7', correct: false },
        ],
      },
    ],
  },
  {
    id: 'N4',
    rung: 'Transition',
    rungHI: 'प्रयोग',
    title: 'Take Away',
    titleHI: 'घटाना',
    desc: 'Objects fly away — how many are left?',
    descHI: 'चीज़ें चली जाती हैं — कितनी बचीं?',
    tier: 2,
    games: [
      {
        type: 'visual_subtraction',
        instruction: 'Some birds flew away. How many are left?',
        instructionHI: 'कुछ पक्षी उड़ गए। कितने बचे?',
        total: { emoji: '🐦', count: 8 },
        removed: 3,
        answer: 5,
        options: [4, 5, 6, 7],
      },
      {
        type: 'visual_subtraction',
        instruction: 'Some balloons popped! How many remain?',
        instructionHI: 'कुछ गुब्बारे फट गए! कितने बचे?',
        total: { emoji: '🎈', count: 10 },
        removed: 4,
        answer: 6,
        options: [5, 6, 7, 8],
      },
      {
        type: 'tap_correct',
        instruction: 'Priya had 9 mangoes. She gave 3 to her friend. How many does she have now?',
        instructionHI: 'प्रिया के पास 9 आम थे। उसने 3 दोस्त को दे दिए। अब कितने बचे?',
        options: [
          { label: '5', value: '5', correct: false },
          { label: '6', value: '6', correct: true },
          { label: '7', value: '7', correct: false },
          { label: '12', value: '12', correct: false },
        ],
      },
    ],
  },
  {
    id: 'N5',
    rung: 'Integration',
    rungHI: 'एकीकरण',
    title: 'Number Stories',
    titleHI: 'संख्या कहानियाँ',
    desc: 'Solve real-life number problems with pictures to help.',
    descHI: 'असली ज़िंदगी के सवाल हल करो।',
    tier: 2,
    games: [
      {
        type: 'tap_correct',
        instruction: 'Raju has 5 pencils. He buys 4 more. How many pencils does he have?',
        instructionHI: 'राजू के पास 5 पेंसिल हैं। वह 4 और खरीदता है। अब कुल कितनी?',
        options: [
          { label: '8 ✏️', value: '8', correct: false },
          { label: '9 ✏️', value: '9', correct: true },
          { label: '10 ✏️', value: '10', correct: false },
          { label: '7 ✏️', value: '7', correct: false },
        ],
      },
      {
        type: 'tap_correct',
        instruction: 'A basket has 12 oranges. 5 are eaten. How many are left?',
        instructionHI: 'टोकरी में 12 संतरे हैं। 5 खा लिए। कितने बचे?',
        options: [
          { label: '6 🍊', value: '6', correct: false },
          { label: '7 🍊', value: '7', correct: true },
          { label: '8 🍊', value: '8', correct: false },
          { label: '17 🍊', value: '17', correct: false },
        ],
      },
      {
        type: 'number_line',
        instruction: 'Tap the correct spot on the number line for 7',
        instructionHI: 'संख्या रेखा पर 7 की जगह टैप करो',
        target: 7,
        min: 0,
        max: 10,
      },
    ],
  },
];

// ── WRITING SUPPORT ───────────────────────────────────────────────────────────

const WRITING_LEVELS = [
  {
    id: 'W1',
    rung: 'Foundations',
    rungHI: 'नींव',
    title: 'Copy & Match',
    titleHI: 'देखो और मिलाओ',
    desc: 'Tap letters in order to copy a word shown above.',
    descHI: 'ऊपर दिखाए गए शब्द को देखकर अक्षर टैप करो।',
    tier: 1,
    games: [
      {
        type: 'word_builder',
        instruction: 'Tap letters in order to spell: CAT',
        instructionHI: 'क्रम में टैप करके लिखो: CAT',
        targetWord: 'CAT',
        letters: shuffle(['C', 'A', 'T', 'D', 'P', 'M']),
      },
      {
        type: 'word_builder',
        instruction: 'Tap letters in order to spell: SUN',
        instructionHI: 'क्रम में टैप करके लिखो: SUN',
        targetWord: 'SUN',
        letters: shuffle(['S', 'U', 'N', 'B', 'O', 'R']),
      },
      {
        type: 'tap_correct',
        instruction: 'Which word is spelled correctly?',
        instructionHI: 'कौन सा शब्द सही तरह से लिखा गया है?',
        options: [
          { label: 'BRID', value: 'brid', correct: false },
          { label: 'BIRD', value: 'bird', correct: true },
          { label: 'BIDR', value: 'bidr', correct: false },
          { label: 'BRDI', value: 'brdi', correct: false },
        ],
      },
    ],
  },
  {
    id: 'W2',
    rung: 'Reinforcement',
    rungHI: 'अभ्यास',
    title: 'Sentence Sort',
    titleHI: 'वाक्य सजाओ',
    desc: 'Rearrange word tiles to build a correct sentence.',
    descHI: 'शब्द टाइलें सही क्रम में लगाओ।',
    tier: 1,
    games: [
      {
        type: 'sentence_tap',
        instruction: 'Tap words in the right order to make a sentence',
        instructionHI: 'सही क्रम में शब्दों पर टैप करो',
        words: ['The', 'dog', 'ran', 'fast'],
        scrambled: shuffle(['The', 'dog', 'ran', 'fast']),
      },
      {
        type: 'sentence_tap',
        instruction: 'Build the sentence: A bird sang in the tree',
        instructionHI: 'वाक्य बनाओ',
        words: ['A', 'bird', 'sang', 'in', 'the', 'tree'],
        scrambled: shuffle(['A', 'bird', 'sang', 'in', 'the', 'tree']),
      },
      {
        type: 'odd_one_out',
        instruction: 'Tap the word that does NOT fit in: "The ___ swam in the river."',
        instructionHI: '"___ नदी में तैरा।" — कौन सा शब्द सही नहीं है?',
        options: [
          { label: 'Fish 🐟', value: 'fish', correct: false },
          { label: 'Duck 🦆', value: 'duck', correct: false },
          { label: 'Frog 🐸', value: 'frog', correct: false },
          { label: 'Mountain 🏔️', value: 'mountain', correct: true },
        ],
      },
    ],
  },
  {
    id: 'W3',
    rung: 'Reinforcement',
    rungHI: 'अभ्यास',
    title: 'Fill the Gap',
    titleHI: 'खाली जगह भरो',
    desc: 'Pick the best word to complete each sentence.',
    descHI: 'सबसे सही शब्द चुनकर वाक्य पूरा करो।',
    tier: 1,
    games: [
      {
        type: 'fill_blank',
        instruction: 'Choose the best word',
        instructionHI: 'सबसे सही शब्द चुनो',
        sentence: 'The baby ___ softly.',
        sentenceHI: 'बच्चा धीरे से ___।',
        options: [
          { label: 'slept', value: 'slept', correct: true },
          { label: 'drove', value: 'drove', correct: false },
          { label: 'flew', value: 'flew', correct: false },
        ],
      },
      {
        type: 'fill_blank',
        instruction: 'Pick the right word',
        instructionHI: 'सही शब्द चुनो',
        sentence: 'She ___ her homework before dinner.',
        sentenceHI: 'उसने खाने से पहले अपना होमवर्क ___।',
        options: [
          { label: 'finished', value: 'finished', correct: true },
          { label: 'forgot', value: 'forgot', correct: false },
          { label: 'found', value: 'found', correct: false },
        ],
      },
      {
        type: 'tap_correct',
        instruction: 'Which sentence is written correctly?',
        instructionHI: 'कौन सा वाक्य सही तरह से लिखा गया है?',
        options: [
          { label: 'the cat sat.', value: 'a', correct: false },
          { label: 'The cat sat.', value: 'b', correct: true },
          { label: 'The Cat sat.', value: 'c', correct: false },
          { label: 'The cat Sat.', value: 'd', correct: false },
        ],
      },
    ],
  },
  {
    id: 'W4',
    rung: 'Transition',
    rungHI: 'प्रयोग',
    title: 'What Comes Next?',
    titleHI: 'आगे क्या होगा?',
    desc: 'Read a mini story and pick what happens next.',
    descHI: 'एक छोटी कहानी पढ़ो और बताओ आगे क्या होगा।',
    tier: 2,
    games: [
      {
        type: 'tap_correct',
        instruction: '"Rani was very hungry. She went to the kitchen." What will she do next?',
        instructionHI: '"रानी बहुत भूखी थी। वह रसोई गई।" वह आगे क्या करेगी?',
        options: [
          { label: '🍽️ She will eat something', value: 'eat', correct: true },
          { label: '😴 She will sleep', value: 'sleep', correct: false },
          { label: '🏃 She will run outside', value: 'run', correct: false },
          { label: '📚 She will read a book', value: 'read', correct: false },
        ],
      },
      {
        type: 'fill_blank',
        instruction: 'Complete the story: "The sky turned dark. Thunder rumbled. Then it started to ___."',
        instructionHI: 'कहानी पूरी करो: "आसमान काला हो गया। बादल गरजे। फिर ___ लगी।"',
        sentence: 'The sky turned dark. Thunder rumbled. Then it started to ___.',
        sentenceHI: 'आसमान काला हो गया। बादल गरजे। फिर ___ लगी।',
        options: [
          { label: 'rain 🌧️', value: 'rain', correct: true },
          { label: 'shine ☀️', value: 'shine', correct: false },
          { label: 'snow ❄️', value: 'snow', correct: false },
        ],
      },
      {
        type: 'sequence_order',
        instruction: 'Put these steps in the right order for making tea',
        instructionHI: 'चाय बनाने के चरण सही क्रम में लगाओ',
        items: [
          { id: 1, text: 'Boil water', textHI: 'पानी उबालो', order: 0 },
          { id: 2, text: 'Add tea leaves', textHI: 'चाय पत्ती डालो', order: 1 },
          { id: 3, text: 'Add milk and sugar', textHI: 'दूध और चीनी डालो', order: 2 },
          { id: 4, text: 'Pour and drink', textHI: 'डालो और पियो', order: 3 },
        ],
      },
    ],
  },
  {
    id: 'W5',
    rung: 'Integration',
    rungHI: 'एकीकरण',
    title: 'My Mini Story',
    titleHI: 'मेरी छोटी कहानी',
    desc: 'Use picture cards to build your own 3-part story.',
    descHI: 'चित्र कार्डों से अपनी 3-भाग की कहानी बनाओ।',
    tier: 2,
    games: [
      {
        type: 'sequence_order',
        instruction: 'Arrange the pictures to tell a story about Meera\'s morning',
        instructionHI: 'मीरा की सुबह की कहानी बनाने के लिए चित्र सजाओ',
        items: [
          { id: 1, text: '😴 Meera woke up', textHI: '😴 मीरा उठी', order: 0 },
          { id: 2, text: '🪥 She brushed her teeth', textHI: '🪥 उसने दाँत साफ किए', order: 1 },
          { id: 3, text: '🍳 She ate breakfast', textHI: '🍳 उसने नाश्ता किया', order: 2 },
          { id: 4, text: '🎒 She went to school', textHI: '🎒 वह स्कूल गई', order: 3 },
        ],
      },
      {
        type: 'fill_blank',
        instruction: 'Write the middle of this story: "Arjun found a lost kitten. ___ He took it home and kept it safe."',
        instructionHI: 'कहानी का बीच वाला हिस्सा चुनो',
        sentence: 'Arjun found a lost kitten. ___ He took it home and kept it safe.',
        sentenceHI: 'अर्जुन को एक खोई हुई बिल्ली मिली। ___ वह उसे घर ले गया।',
        options: [
          { label: 'He picked it up gently.', value: 'picked', correct: true },
          { label: 'He ran away from it.', value: 'ran', correct: false },
          { label: 'He threw it far away.', value: 'threw', correct: false },
        ],
      },
      {
        type: 'tap_correct',
        instruction: 'Which sentence is the BEST ending for a story about a lost puppy that was found?',
        instructionHI: 'खोए हुए पिल्ले की कहानी के लिए सबसे अच्छा अंत कौन सा है?',
        options: [
          { label: 'The puppy was happy and never lost again. 🐶', value: 'a', correct: true },
          { label: 'The puppy liked to eat grass.', value: 'b', correct: false },
          { label: 'The weather was very hot that day.', value: 'c', correct: false },
          { label: 'Trees have many leaves.', value: 'd', correct: false },
        ],
      },
    ],
  },
];

// ─── GAME COMPONENT: TAP_CORRECT ─────────────────────────────────────────────

function TapCorrectGame({ game, lang, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // null | true | false
  const [attempts, setAttempts] = useState(0);

  const handleTap = (opt) => {
    if (feedback === true) return; // already correct
    setSelected(opt.value);
    const correct = opt.correct;
    setFeedback(correct);
    setAttempts((a) => a + 1);
    if (correct) {
      speak(lang === 'HI' ? 'बहुत बढ़िया!' : 'Well done!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'फिर से कोशिश करो' : 'Try again', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1200);
    }
  };

  return (
    <div>
      <Instruction text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction} lang={lang} />
      <FeedbackBadge correct={feedback} lang={lang} />
      <div className="grid grid-cols-1 gap-3">
        {game.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleTap(opt)}
            className={`w-full py-4 px-5 rounded-xl font-semibold text-base text-left transition-all border-2 ${
              selected === opt.value && feedback === true
                ? 'border-success bg-success/10 text-success'
                : selected === opt.value && feedback === false
                ? 'border-warm bg-warm/10 text-warm'
                : 'border-gray-200 bg-card hover:border-accent hover:bg-accent/5 text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GAME COMPONENT: WORD_BUILDER ────────────────────────────────────────────

function WordBuilderGame({ game, lang, onComplete }) {
  const [available, setAvailable] = useState(game.letters);
  const [built, setBuilt] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const target = game.targetWord;

  const addLetter = (letter, idx) => {
    if (feedback === true) return;
    const newBuilt = [...built, letter];
    const newAvail = available.filter((_, i) => i !== idx);
    setBuilt(newBuilt);
    setAvailable(newAvail);

    const word = newBuilt.join('');
    if (word.length === target.length) {
      if (word === target) {
        setFeedback(true);
        speak(lang === 'HI' ? 'शाबाश!' : 'Excellent!', lang);
        setTimeout(() => onComplete(), 900);
      } else {
        setFeedback(false);
        speak(lang === 'HI' ? 'फिर से कोशिश करो' : 'Try again', lang);
        setTimeout(() => {
          setFeedback(null);
          setBuilt([]);
          setAvailable(game.letters);
        }, 1200);
      }
    }
  };

  const reset = () => { setBuilt([]); setAvailable(game.letters); setFeedback(null); };

  return (
    <div>
      <Instruction text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction} lang={lang} />

      {/* Target word display */}
      <div className="text-center mb-4">
        <p className="text-muted text-xs mb-1">{lang === 'HI' ? 'लिखना है:' : 'Spell this:'}</p>
        <p className="text-3xl font-bold text-primary tracking-widest">{target}</p>
      </div>

      {/* Built word slots */}
      <div className="flex justify-center gap-2 mb-5">
        {Array.from({ length: target.length }).map((_, i) => (
          <div
            key={i}
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border-2 ${
              built[i]
                ? feedback === true ? 'border-success bg-success/10 text-success'
                  : feedback === false ? 'border-warm bg-warm/10 text-warm'
                  : 'border-accent bg-accent/10 text-accent'
                : 'border-gray-300 bg-surface'
            }`}
          >
            {built[i] || ''}
          </div>
        ))}
      </div>

      <FeedbackBadge correct={feedback} lang={lang} />

      {/* Available letters */}
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {available.map((letter, idx) => (
          <button
            key={`${letter}-${idx}`}
            onClick={() => addLetter(letter, idx)}
            className="w-12 h-12 rounded-xl bg-card border-2 border-gray-200 hover:border-accent hover:bg-accent/5 text-primary font-bold text-xl transition-all active:scale-95"
          >
            {letter}
          </button>
        ))}
      </div>

      {built.length > 0 && feedback !== true && (
        <button onClick={reset} className="text-muted text-sm flex items-center gap-1 mx-auto">
          <RefreshCw className="w-4 h-4" /> {lang === 'HI' ? 'मिटाओ' : 'Reset'}
        </button>
      )}
    </div>
  );
}

// ─── GAME COMPONENT: ODD_ONE_OUT ─────────────────────────────────────────────

function OddOneOutGame({ game, lang, onComplete }) {
  return <TapCorrectGame game={game} lang={lang} onComplete={onComplete} />;
}

// ─── GAME COMPONENT: FILL_BLANK ──────────────────────────────────────────────

function FillBlankGame({ game, lang, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const sentenceDisplay = lang === 'HI' && game.sentenceHI ? game.sentenceHI : game.sentence;

  const handleSelect = (opt) => {
    if (feedback === true) return;
    setSelected(opt.value);
    setFeedback(opt.correct);
    if (opt.correct) {
      speak(lang === 'HI' ? 'बहुत अच्छा!' : 'Great choice!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'फिर से देखो' : 'Look again', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1200);
    }
  };

  const filled = sentenceDisplay.replace(
    '___',
    selected && feedback === true ? `[${selected}]` : '___'
  );

  return (
    <div>
      <Instruction text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction} lang={lang} />
      <div className="bg-surface rounded-xl p-4 mb-5 text-center">
        <p className="text-primary text-base font-medium leading-relaxed">{filled}</p>
      </div>
      <FeedbackBadge correct={feedback} lang={lang} />
      <div className="grid grid-cols-1 gap-3">
        {game.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt)}
            className={`py-3 px-5 rounded-xl font-semibold text-base border-2 transition-all text-left ${
              selected === opt.value && feedback === true
                ? 'border-success bg-success/10 text-success'
                : selected === opt.value && feedback === false
                ? 'border-warm bg-warm/10 text-warm'
                : 'border-gray-200 bg-card hover:border-accent text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GAME COMPONENT: SENTENCE_TAP ────────────────────────────────────────────

function SentenceTapGame({ game, lang, onComplete }) {
  const [remaining, setRemaining] = useState([...game.scrambled]);
  const [chosen, setChosen] = useState([]);
  const [feedback, setFeedback] = useState(null);

  const target = game.words;

  const tapWord = (word, idx) => {
    if (feedback === true) return;
    const newChosen = [...chosen, word];
    const newRemaining = remaining.filter((_, i) => i !== idx);
    setChosen(newChosen);
    setRemaining(newRemaining);

    if (newChosen.length === target.length) {
      const correct = newChosen.join(' ') === target.join(' ');
      setFeedback(correct);
      if (correct) {
        speak(lang === 'HI' ? 'वाह! वाक्य सही है!' : 'Great sentence!', lang);
        setTimeout(() => onComplete(), 1000);
      } else {
        speak(lang === 'HI' ? 'फिर से कोशिश करो' : 'Try again', lang);
        setTimeout(() => {
          setChosen([]); setRemaining([...game.scrambled]); setFeedback(null);
        }, 1400);
      }
    }
  };

  const reset = () => { setChosen([]); setRemaining([...game.scrambled]); setFeedback(null); };

  return (
    <div>
      <Instruction
        text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction}
        lang={lang}
      />

      {/* Sentence being built */}
      <div className="min-h-[52px] bg-surface rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-center">
        {chosen.length === 0
          ? <p className="text-muted text-sm">{lang === 'HI' ? 'यहाँ शब्द दिखेंगे…' : 'Your sentence appears here…'}</p>
          : chosen.map((w, i) => (
            <span key={i} className={`px-2 py-1 rounded-lg text-sm font-semibold ${
              feedback === true ? 'bg-success/15 text-success'
              : feedback === false ? 'bg-warm/15 text-warm'
              : 'bg-accent/10 text-accent'
            }`}>{w}</span>
          ))}
      </div>

      <FeedbackBadge correct={feedback} lang={lang} />

      {/* Word tiles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {remaining.map((word, idx) => (
          <button
            key={`${word}-${idx}`}
            onClick={() => tapWord(word, idx)}
            className="px-3 py-2 rounded-xl bg-card border-2 border-gray-200 hover:border-accent hover:bg-accent/5 text-primary font-semibold text-sm transition-all active:scale-95"
          >
            {word}
          </button>
        ))}
      </div>

      {chosen.length > 0 && feedback !== true && (
        <button onClick={reset} className="text-muted text-sm flex items-center gap-1 mx-auto">
          <RefreshCw className="w-4 h-4" /> {lang === 'HI' ? 'मिटाओ' : 'Reset'}
        </button>
      )}
    </div>
  );
}

// ─── GAME COMPONENT: COUNT_TAP ───────────────────────────────────────────────

function CountTapGame({ game, lang, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleSelect = (val) => {
    if (feedback === true) return;
    setSelected(val);
    const correct = val === game.answer;
    setFeedback(correct);
    if (correct) {
      speak(lang === 'HI' ? 'बिल्कुल सही!' : 'Exactly right!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'गिनो फिर से' : 'Count again', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1200);
    }
  };

  return (
    <div>
      <Instruction text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction} lang={lang} />

      {/* Objects to count */}
      <div className="bg-surface rounded-2xl p-4 mb-5 text-center">
        <div className="flex flex-wrap justify-center gap-2 mb-2">
          {Array.from({ length: game.count }).map((_, i) => (
            <span key={i} className="text-3xl">{game.emoji}</span>
          ))}
        </div>
        <p className="text-muted text-xs mt-1">{lang === 'HI' ? `${game.count} ${game.emoji}` : `${game.count} items`}</p>
      </div>

      <FeedbackBadge correct={feedback} lang={lang} />

      <div className="grid grid-cols-2 gap-3">
        {game.options.map((val) => (
          <button
            key={val}
            onClick={() => handleSelect(val)}
            className={`py-4 rounded-xl text-2xl font-bold border-2 transition-all ${
              selected === val && feedback === true ? 'border-success bg-success/10 text-success'
              : selected === val && feedback === false ? 'border-warm bg-warm/10 text-warm'
              : 'border-gray-200 bg-card hover:border-accent text-primary'
            }`}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GAME COMPONENT: COMPARE_GROUPS ──────────────────────────────────────────

function CompareGroupsGame({ game, lang, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleSelect = (side) => {
    if (feedback === true) return;
    setSelected(side);
    const correct = side === game.answer;
    setFeedback(correct);
    if (correct) {
      speak(lang === 'HI' ? 'हाँ! सही है!' : 'Yes! Correct!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'फिर गिनो' : 'Count again', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1200);
    }
  };

  return (
    <div>
      <Instruction text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction} lang={lang} />

      <FeedbackBadge correct={feedback} lang={lang} />

      <div className="grid grid-cols-2 gap-4 mb-4">
        {['left', 'right'].map((side) => {
          const grp = side === 'left' ? game.left : game.right;
          return (
            <button
              key={side}
              onClick={() => handleSelect(side)}
              className={`rounded-2xl p-4 border-2 transition-all ${
                selected === side && feedback === true ? 'border-success bg-success/10'
                : selected === side && feedback === false ? 'border-warm bg-warm/10'
                : 'border-gray-200 bg-card hover:border-accent'
              }`}
            >
              <div className="flex flex-wrap justify-center gap-1 mb-2">
                {Array.from({ length: grp.count }).map((_, i) => (
                  <span key={i} className="text-2xl">{grp.emoji}</span>
                ))}
              </div>
              <p className="text-center font-bold text-primary text-lg">{grp.count}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── GAME COMPONENT: VISUAL_ADDITION ────────────────────────────────────────

function VisualAdditionGame({ game, lang, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleSelect = (val) => {
    if (feedback === true) return;
    setSelected(val);
    const correct = val === game.answer;
    setFeedback(correct);
    if (correct) {
      speak(lang === 'HI' ? 'बिल्कुल सही!' : 'Spot on!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'फिर गिनो' : 'Count again', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1200);
    }
  };

  return (
    <div>
      <Instruction text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction} lang={lang} />

      <div className="bg-surface rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className="flex flex-wrap justify-center gap-1 max-w-[120px]">
              {Array.from({ length: game.left.count }).map((_, i) => (
                <span key={i} className="text-2xl">{game.left.emoji}</span>
              ))}
            </div>
            <p className="text-primary font-bold text-lg mt-1">{game.left.count}</p>
          </div>
          <span className="text-3xl font-bold text-warm">+</span>
          <div className="text-center">
            <div className="flex flex-wrap justify-center gap-1 max-w-[120px]">
              {Array.from({ length: game.right.count }).map((_, i) => (
                <span key={i} className="text-2xl">{game.right.emoji}</span>
              ))}
            </div>
            <p className="text-primary font-bold text-lg mt-1">{game.right.count}</p>
          </div>
          <span className="text-3xl font-bold text-warm">=</span>
          <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
            <span className="text-2xl text-muted">?</span>
          </div>
        </div>
      </div>

      <FeedbackBadge correct={feedback} lang={lang} />

      <div className="grid grid-cols-2 gap-3">
        {game.options.map((val) => (
          <button
            key={val}
            onClick={() => handleSelect(val)}
            className={`py-4 rounded-xl text-2xl font-bold border-2 transition-all ${
              selected === val && feedback === true ? 'border-success bg-success/10 text-success'
              : selected === val && feedback === false ? 'border-warm bg-warm/10 text-warm'
              : 'border-gray-200 bg-card hover:border-accent text-primary'
            }`}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GAME COMPONENT: VISUAL_SUBTRACTION ──────────────────────────────────────

function VisualSubtractionGame({ game, lang, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const handleSelect = (val) => {
    if (feedback === true) return;
    setSelected(val);
    const correct = val === game.answer;
    setFeedback(correct);
    if (correct) {
      speak(lang === 'HI' ? 'बहुत बढ़िया!' : 'Well done!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'फिर से गिनो' : 'Try counting again', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1200);
    }
  };

  const remaining = game.total.count - game.removed;

  return (
    <div>
      <Instruction text={lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction} lang={lang} />

      <div className="bg-surface rounded-2xl p-4 mb-5">
        <div className="flex flex-wrap justify-center gap-1 mb-3">
          {Array.from({ length: game.total.count }).map((_, i) => (
            <span
              key={i}
              className={`text-2xl transition-all ${i >= remaining ? 'opacity-20 line-through' : ''}`}
            >
              {game.total.emoji}
            </span>
          ))}
        </div>
        <p className="text-center text-sm text-muted">
          {game.total.count} − {game.removed} = ?
        </p>
      </div>

      <FeedbackBadge correct={feedback} lang={lang} />

      <div className="grid grid-cols-2 gap-3">
        {game.options.map((val) => (
          <button
            key={val}
            onClick={() => handleSelect(val)}
            className={`py-4 rounded-xl text-2xl font-bold border-2 transition-all ${
              selected === val && feedback === true ? 'border-success bg-success/10 text-success'
              : selected === val && feedback === false ? 'border-warm bg-warm/10 text-warm'
              : 'border-gray-200 bg-card hover:border-accent text-primary'
            }`}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GAME COMPONENT: PASSAGE_QA ──────────────────────────────────────────────

function PassageQAGame({ game, lang, onComplete }) {
  const passage = lang === 'HI' && game.passageHI ? game.passageHI : game.passage;
  const question = lang === 'HI' && game.questionHI ? game.questionHI : game.question;
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [highlight, setHighlight] = useState(false);

  const handleSelect = (opt) => {
    if (feedback === true) return;
    setSelected(opt.value);
    setFeedback(opt.correct);
    if (opt.correct) {
      speak(lang === 'HI' ? 'शाबाश! सही जवाब!' : 'Correct!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'जवाब कहानी में है — फिर पढ़ो' : 'The answer is in the story — read again', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1400);
    }
  };

  return (
    <div>
      {/* Passage */}
      <div className={`rounded-xl p-4 mb-4 text-sm leading-relaxed text-primary transition-all ${
        highlight ? 'bg-accent/10 border-2 border-accent' : 'bg-surface'
      }`}>
        <div className="flex justify-between items-start mb-2">
          <p className="font-semibold text-xs text-muted uppercase tracking-wide">
            {lang === 'HI' ? 'पढ़ो:' : 'Read:'}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => { setHighlight((h) => !h); speak(passage, lang); }}
              className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p>{passage}</p>
      </div>

      <Instruction text={question} lang={lang} />
      <FeedbackBadge correct={feedback} lang={lang} />

      <div className="grid grid-cols-1 gap-3">
        {game.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt)}
            className={`py-3 px-4 rounded-xl font-semibold text-base border-2 text-left transition-all ${
              selected === opt.value && feedback === true ? 'border-success bg-success/10 text-success'
              : selected === opt.value && feedback === false ? 'border-warm bg-warm/10 text-warm'
              : 'border-gray-200 bg-card hover:border-accent text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── GAME COMPONENT: SEQUENCE_ORDER ──────────────────────────────────────────

function SequenceOrderGame({ game, lang, onComplete }) {
  const instruction = lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction;
  const [items, setItems] = useState(() => shuffle(game.items));
  const [feedback, setFeedback] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);

  const moveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...items];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setItems(arr);
    setFeedback(null);
  };

  const moveDown = (idx) => {
    if (idx === items.length - 1) return;
    const arr = [...items];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setItems(arr);
    setFeedback(null);
  };

  const checkOrder = () => {
    const correct = items.every((item, idx) => item.order === idx);
    setFeedback(correct);
    if (correct) {
      speak(lang === 'HI' ? 'सही क्रम!' : 'Perfect order!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'फिर से सोचो' : 'Try reordering', lang);
      setTimeout(() => setFeedback(null), 1400);
    }
  };

  return (
    <div>
      <Instruction text={instruction} lang={lang} />
      <p className="text-muted text-xs text-center mb-4">
        {lang === 'HI' ? '↑ ↓ बटन से क्रम बदलो, फिर जाँचो' : 'Use ↑ ↓ buttons to reorder, then check'}
      </p>

      <FeedbackBadge correct={feedback} lang={lang} />

      <div className="space-y-2 mb-4">
        {items.map((item, idx) => {
          const text = lang === 'HI' && item.textHI ? item.textHI : item.text;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                feedback === true ? 'border-success bg-success/10'
                : 'border-gray-200 bg-card'
              }`}
            >
              <span className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-sm font-bold text-muted flex-shrink-0">
                {idx + 1}
              </span>
              <p className="flex-1 text-primary font-medium text-sm">{text}</p>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="w-7 h-7 rounded-lg bg-surface text-muted disabled:opacity-30 flex items-center justify-center hover:bg-accent/10 hover:text-accent"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === items.length - 1}
                  className="w-7 h-7 rounded-lg bg-surface text-muted disabled:opacity-30 flex items-center justify-center hover:bg-accent/10 hover:text-accent"
                >
                  ↓
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={checkOrder} className="btn-primary w-full">
        {lang === 'HI' ? 'जाँचो' : 'Check Order'} <Check className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── GAME COMPONENT: NUMBER_LINE ─────────────────────────────────────────────

function NumberLineGame({ game, lang, onComplete }) {
  const instruction = lang === 'HI' && game.instructionHI ? game.instructionHI : game.instruction;
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const nums = Array.from({ length: game.max - game.min + 1 }, (_, i) => game.min + i);

  const handleTap = (n) => {
    if (feedback === true) return;
    setSelected(n);
    const correct = n === game.target;
    setFeedback(correct);
    if (correct) {
      speak(lang === 'HI' ? 'बिल्कुल सही!' : 'Exactly!', lang);
      setTimeout(() => onComplete(), 900);
    } else {
      speak(lang === 'HI' ? 'और पास?' : 'A bit closer?', lang);
      setTimeout(() => { setFeedback(null); setSelected(null); }, 1200);
    }
  };

  return (
    <div>
      <Instruction text={instruction} lang={lang} />
      <div className="text-center mb-4">
        <span className="text-5xl font-bold text-primary">{game.target}</span>
      </div>
      <FeedbackBadge correct={feedback} lang={lang} />
      <div className="flex gap-1 flex-wrap justify-center mb-4">
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => handleTap(n)}
            className={`w-10 h-10 rounded-xl font-bold text-sm border-2 transition-all ${
              selected === n && feedback === true ? 'border-success bg-success/10 text-success'
              : selected === n && feedback === false ? 'border-warm bg-warm/10 text-warm'
              : n === game.target && feedback === true ? 'border-success bg-success text-white'
              : 'border-gray-200 bg-card hover:border-accent text-primary'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="h-2 bg-surface rounded-full relative">
        <div
          className="h-2 bg-gradient-to-r from-accent to-calm rounded-full transition-all"
          style={{ width: `${((game.target - game.min) / (game.max - game.min)) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── GAME DISPATCHER ─────────────────────────────────────────────────────────

function GameDispatcher({ game, lang, onComplete }) {
  switch (game.type) {
    case 'tap_correct':   return <TapCorrectGame game={game} lang={lang} onComplete={onComplete} />;
    case 'word_builder':  return <WordBuilderGame game={game} lang={lang} onComplete={onComplete} />;
    case 'odd_one_out':   return <OddOneOutGame game={game} lang={lang} onComplete={onComplete} />;
    case 'fill_blank':    return <FillBlankGame game={game} lang={lang} onComplete={onComplete} />;
    case 'sentence_tap':  return <SentenceTapGame game={game} lang={lang} onComplete={onComplete} />;
    case 'count_tap':     return <CountTapGame game={game} lang={lang} onComplete={onComplete} />;
    case 'compare_groups': return <CompareGroupsGame game={game} lang={lang} onComplete={onComplete} />;
    case 'visual_addition': return <VisualAdditionGame game={game} lang={lang} onComplete={onComplete} />;
    case 'visual_subtraction': return <VisualSubtractionGame game={game} lang={lang} onComplete={onComplete} />;
    case 'passage_qa':    return <PassageQAGame game={game} lang={lang} onComplete={onComplete} />;
    case 'sequence_order': return <SequenceOrderGame game={game} lang={lang} onComplete={onComplete} />;
    case 'number_line':   return <NumberLineGame game={game} lang={lang} onComplete={onComplete} />;
    default:              return <p className="text-muted text-center">Unknown game type</p>;
  }
}

// ─── RUNG BADGE ──────────────────────────────────────────────────────────────

const RUNG_COLORS = {
  Foundations: 'bg-calm/15 text-calm border-calm',
  Reinforcement: 'bg-accent/15 text-accent border-accent',
  Transition: 'bg-warm/15 text-warm border-warm',
  Integration: 'bg-success/15 text-success border-success',
  Mastery: 'bg-primary/15 text-primary border-primary',
};

const RungBadge = ({ rung, rungHI, lang }) => {
  const label = lang === 'HI' ? rungHI : rung;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${RUNG_COLORS[rung] || 'bg-surface text-muted border-gray-200'}`}>
      {label}
    </span>
  );
};

// ─── COURSE TRACK CONFIGS ─────────────────────────────────────────────────────

const TRACKS = [
  {
    id: 'reading',
    icon: BookOpen,
    label: 'Reading Support',
    labelHI: 'पठन सहायता',
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent',
    btnClass: 'bg-accent hover:bg-blue-700',
    levels: READING_LEVELS,
    sldTypes: ['dyslexia'],
  },
  {
    id: 'numeracy',
    icon: Calculator,
    label: 'Numeracy Support',
    labelHI: 'गणना सहायता',
    color: 'text-warm',
    bg: 'bg-warm/10',
    border: 'border-warm',
    btnClass: 'bg-warm hover:bg-orange-600',
    levels: NUMERACY_LEVELS,
    sldTypes: ['dyscalculia'],
  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CatchUpCourses() {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const t = (en, hi) => (lang === 'HI' ? hi : en);

  // Detect recommended track from screeningResults or sldType
  const getRecommendedTrack = () => {
    const area = appState.primarySupportArea || '';
    if (area === 'numeracy') return 'numeracy';
    // Writing / fine-motor needs are handled hands-on by the teacher, not in the app,
    // so there is no on-app writing track to recommend.
    return 'reading';
  };

  // ── Persistent catch-up progress in appState ─────────────────────────────
  // Shape: { reading: { completedLevels: Set, completedGames: { 'R1': Set<gameIdx> } }, ... }
  const progressKey = 'catchUpProgress';
  const savedProgress = appState[progressKey] || {};

  const getTrackProgress = (trackId) => savedProgress[trackId] || { completedLevels: [], completedGames: {} };

  const markGameComplete = (trackId, levelId, gameIdx) => {
    const tp = getTrackProgress(trackId);
    const levelGames = new Set(tp.completedGames[levelId] || []);
    levelGames.add(gameIdx);
    const updatedGames = { ...tp.completedGames, [levelId]: [...levelGames] };

    // Find level in track
    const track = TRACKS.find((tr) => tr.id === trackId);
    const level = track.levels.find((l) => l.id === levelId);
    const allDone = level && [...levelGames].length >= level.games.length;
    const updatedLevels = allDone && !tp.completedLevels.includes(levelId)
      ? [...tp.completedLevels, levelId]
      : tp.completedLevels;

    const newProgress = {
      ...savedProgress,
      [trackId]: { completedLevels: updatedLevels, completedGames: updatedGames },
    };
    updateState({ [progressKey]: newProgress });

    // Write to Firebase if student is registered
    if (appState.studentId || appState.firebaseStudentId) {
      const sid = appState.studentId || appState.firebaseStudentId;
      updateStudentProgress(sid, { catchUpProgress: newProgress }).catch(() => { });
    }
  };

  // ── View state ─────────────────────────────────────────────────────────────
  const [view, setView] = useState('hub'); // hub | track | level | game
  const [activeTrackId, setActiveTrackId] = useState(getRecommendedTrack);
  const [activeLevelIdx, setActiveLevelIdx] = useState(0);
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [levelComplete, setLevelComplete] = useState(false);
  const [companionState, setCompanionState] = useState('idle');

  const activeTrack = TRACKS.find((tr) => tr.id === activeTrackId);
  const trackProgress = getTrackProgress(activeTrackId);
  const activeLevel = activeTrack?.levels[activeLevelIdx];
  const activeGame = activeLevel?.games[activeGameIdx];

  const isLevelDone = (levelId) => trackProgress.completedLevels.includes(levelId);
  const isGameDone = (levelId, gIdx) => (trackProgress.completedGames[levelId] || []).includes(gIdx);
  const completedGameCount = (levelId) => (trackProgress.completedGames[levelId] || []).length;

  const openTrack = (trackId) => {
    setActiveTrackId(trackId);
    setActiveLevelIdx(0);
    setActiveGameIdx(0);
    setLevelComplete(false);
    setView('track');
  };

  const openLevel = (idx) => {
    setActiveLevelIdx(idx);
    setActiveGameIdx(0);
    setLevelComplete(false);
    setView('level');
  };

  const openGame = (gIdx) => {
    setActiveGameIdx(gIdx);
    setView('game');
  };

  const handleGameComplete = () => {
    markGameComplete(activeTrackId, activeLevel.id, activeGameIdx);
    setCompanionState('happy');
    setTimeout(() => setCompanionState('idle'), 1800);

    // Check if all games in this level are now done
    const levelGames = new Set((trackProgress.completedGames[activeLevel.id] || []));
    levelGames.add(activeGameIdx);
    if (levelGames.size >= activeLevel.games.length) {
      setLevelComplete(true);
      celebrate();
    } else {
      // Auto-advance to next incomplete game
      const nextGame = activeLevel.games.findIndex((_, i) => i > activeGameIdx && !isGameDone(activeLevel.id, i));
      if (nextGame !== -1) {
        setTimeout(() => { setActiveGameIdx(nextGame); }, 1500);
      } else {
        setLevelComplete(true);
        celebrate();
      }
    }
  };

  const handleNextLevel = () => {
    const nextIdx = activeLevelIdx + 1;
    if (nextIdx < activeTrack.levels.length) {
      setActiveLevelIdx(nextIdx);
      setActiveGameIdx(0);
      setLevelComplete(false);
      setView('level');
    } else {
      setView('track');
    }
  };

  // ── Progress bar ─────────────────────────────────────────────────────────
  const totalLevels = activeTrack?.levels.length || 5;
  const completedLevels = trackProgress.completedLevels.length;
  const progressPct = Math.round((completedLevels / totalLevels) * 100);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: HUB
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'hub') {
    const recommended = getRecommendedTrack();
    return (
      <Layout
        title={t('Catch-Up Courses', 'कैच-अप कोर्स')}
        showBack
        showCompanion
        pageContext="Starting a personalised catch-up course"
        companionState={companionState}
        lang={lang}
        setLanguage={(l) => updateState({ language: l })}
        companion={appState.companion}
        streak={appState.streakDays}
      >
        <div className="max-w-md mx-auto px-4 py-6 pb-28">
          {/* Header */}
          <div className="mb-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-6 h-6 text-warm" />
              <h1 className="text-2xl font-bold text-primary">{t('Catch-Up Courses', 'कैच-अप कोर्स')}</h1>
            </div>
            <p className="text-muted text-sm">
              {t(
                'Games that build your skills step by step. Pick your track and start at Level 1.',
                'कदम-दर-कदम खेल जो तुम्हारी क्षमता बढ़ाते हैं। अपना ट्रैक चुनो।'
              )}
            </p>
          </div>

          {/* Track cards */}
          <div className="space-y-4">
            {TRACKS.map((track, i) => {
              const Icon = track.icon;
              const tp = getTrackProgress(track.id);
              const done = tp.completedLevels.length;
              const total = track.levels.length;
              const pct = Math.round((done / total) * 100);
              const isRecommended = track.id === recommended;

              return (
                <div
                  key={track.id}
                  className={`card-elevated p-4 border-l-4 ${track.border} animate-slideUp`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${track.bg}`}>
                      <Icon className={`w-6 h-6 ${track.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-bold text-primary text-base">
                          {lang === 'HI' ? track.labelHI : track.label}
                        </h3>
                        {isRecommended && (
                          <span className="text-xs bg-warm/15 text-warm px-2 py-0.5 rounded-full font-medium">
                            {t('Recommended', 'सुझाया गया')}
                          </span>
                        )}
                      </div>
                      <p className="text-muted text-xs mb-2">
                        {done}/{total} {t('levels done', 'स्तर पूरे')}
                      </p>
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${track.btnClass.replace('hover:', '')}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => openTrack(track.id)}
                      className={`${track.btnClass} text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all flex items-center gap-1 flex-shrink-0`}
                    >
                      {done > 0 ? t('Continue', 'जारी रखो') : t('Start', 'शुरू करो')}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ladder explainer */}
          <div className="mt-6 bg-surface rounded-2xl p-4 animate-fadeIn">
            <p className="text-primary font-semibold text-sm mb-3">
              {t('How the ladder works', 'सीढ़ी कैसे काम करती है')}
            </p>
            <div className="space-y-2">
              {[
                { rung: 'Foundations', rungHI: 'नींव', desc: t('Start here — simple and audio-supported', 'यहाँ से शुरू करो — आसान और ऑडियो सहायता के साथ') },
                { rung: 'Reinforcement', rungHI: 'अभ्यास', desc: t('Same skill, different games', 'वही कौशल, अलग खेल') },
                { rung: 'Transition', rungHI: 'प्रयोग', desc: t('Apply the skill in sentences', 'वाक्यों में कौशल का उपयोग') },
                { rung: 'Integration', rungHI: 'एकीकरण', desc: t('Use it in a real passage or story', 'असली पाठ या कहानी में उपयोग') },
              ].map(({ rung, rungHI, desc }) => (
                <div key={rung} className="flex items-start gap-2">
                  <RungBadge rung={rung} rungHI={rungHI} lang={lang} />
                  <p className="text-muted text-xs mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: TRACK (level list)
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'track' && activeTrack) {
    const Icon = activeTrack.icon;
    return (
      <Layout
        title={lang === 'HI' ? activeTrack.labelHI : activeTrack.label}
        showBack
        showCompanion
        pageContext={`In Catch-Up Courses, ${activeTrack.label} track`}
        companionState={companionState}
        lang={lang}
        setLanguage={(l) => updateState({ language: l })}
        companion={appState.companion}
        streak={appState.streakDays}
      >
        <div className="max-w-md mx-auto px-4 py-6 pb-28">
          {/* Track header */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setView('hub')}
              className="w-10 h-10 rounded-xl bg-card card-elevated flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-primary" />
            </button>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${activeTrack.bg}`}>
              <Icon className={`w-6 h-6 ${activeTrack.color}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">
                {lang === 'HI' ? activeTrack.labelHI : activeTrack.label}
              </h1>
              <p className="text-muted text-xs">
                {completedLevels}/{totalLevels} {t('levels complete', 'स्तर पूरे')} · {progressPct}%
              </p>
            </div>
          </div>

          {/* Overall progress */}
          <div className="h-2 bg-surface rounded-full mb-6 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${activeTrack.btnClass.replace('hover:', '')}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Level list */}
          <div className="space-y-3">
            {activeTrack.levels.map((level, idx) => {
              const done = isLevelDone(level.id);
              const gamesCompleted = completedGameCount(level.id);
              const isUnlocked = idx === 0 || isLevelDone(activeTrack.levels[idx - 1]?.id);
              const isCurrent = !done && isUnlocked;

              return (
                <button
                  key={level.id}
                  onClick={() => isUnlocked && openLevel(idx)}
                  disabled={!isUnlocked}
                  className={`w-full text-left card-elevated p-4 border-l-4 transition-all animate-slideUp ${
                    done ? `${activeTrack.border} opacity-80`
                    : isCurrent ? `${activeTrack.border}`
                    : 'border-gray-200 opacity-50'
                  }`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      done ? 'bg-success/15 text-success'
                      : isCurrent ? `${activeTrack.bg} ${activeTrack.color}`
                      : 'bg-gray-100 text-muted'
                    }`}>
                      {done ? <Check className="w-5 h-5" /> : !isUnlocked ? <Lock className="w-5 h-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-bold text-primary text-sm">
                          {t(`Level ${idx + 1}: `, `स्तर ${idx + 1}: `)}
                          {lang === 'HI' ? level.titleHI : level.title}
                        </h3>
                        <RungBadge rung={level.rung} rungHI={level.rungHI} lang={lang} />
                      </div>
                      <p className="text-muted text-xs">
                        {lang === 'HI' ? level.descHI : level.desc}
                      </p>
                      <p className="text-xs mt-1.5 font-medium" style={{ color: done ? '#2E8B57' : '#6B7280' }}>
                        {gamesCompleted}/{level.games.length} {t('games done', 'खेल पूरे')}
                        {!isUnlocked && ` · ${t('Complete the previous level first', 'पहले वाला स्तर पूरा करो')}`}
                      </p>
                    </div>
                    {isUnlocked && (
                      <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 mt-1" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Layout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: LEVEL (game list)
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'level' && activeLevel) {
    return (
      <Layout
        title={lang === 'HI' ? activeLevel.titleHI : activeLevel.title}
        showBack
        showCompanion
        pageContext={`Level ${activeLevelIdx + 1} of ${activeTrack?.label}`}
        companionState={companionState}
        lang={lang}
        setLanguage={(l) => updateState({ language: l })}
        companion={appState.companion}
        streak={appState.streakDays}
      >
        <div className="max-w-md mx-auto px-4 py-6 pb-28">
          {/* Level header */}
          <button
            onClick={() => setView('track')}
            className="flex items-center gap-2 text-muted text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {lang === 'HI' ? activeTrack?.labelHI : activeTrack?.label}
          </button>

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-muted text-sm">{t(`Level ${activeLevelIdx + 1}`, `स्तर ${activeLevelIdx + 1}`)}</span>
              <RungBadge rung={activeLevel.rung} rungHI={activeLevel.rungHI} lang={lang} />
            </div>
            <h1 className="text-xl font-bold text-primary">{lang === 'HI' ? activeLevel.titleHI : activeLevel.title}</h1>
            <p className="text-muted text-sm">{lang === 'HI' ? activeLevel.descHI : activeLevel.desc}</p>
          </div>

          {/* Level complete banner */}
          {levelComplete ? (
            <LevelCompleteBanner
              lang={lang}
              onNext={handleNextLevel}
              isLast={activeLevelIdx === (activeTrack?.levels.length || 5) - 1}
            />
          ) : (
            /* Game cards */
            <div className="space-y-3">
              {activeLevel.games.map((game, gIdx) => {
                const done = isGameDone(activeLevel.id, gIdx);
                const GAME_LABELS = [
                  [t('Game 1', 'खेल 1'), t('Warm-Up', 'शुरुआत')],
                  [t('Game 2', 'खेल 2'), t('Practice', 'अभ्यास')],
                  [t('Game 3', 'खेल 3'), t('Challenge', 'चुनौती')],
                ];
                const [gameNum, gameLabel] = GAME_LABELS[gIdx] || [`Game ${gIdx + 1}`, ''];

                return (
                  <button
                    key={gIdx}
                    onClick={() => openGame(gIdx)}
                    className={`w-full text-left card-elevated p-4 flex items-center gap-3 transition-all animate-slideUp ${
                      done ? 'opacity-80' : 'hover:shadow-md'
                    }`}
                    style={{ animationDelay: `${gIdx * 60}ms` }}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      done ? 'bg-success/15' : `${activeTrack?.bg}`
                    }`}>
                      {done
                        ? <Star className="w-5 h-5 text-success fill-success" />
                        : <PlayCircle className={`w-5 h-5 ${activeTrack?.color}`} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-primary text-sm">{gameNum} · {gameLabel}</p>
                      <p className="text-muted text-xs">{done ? t('Completed ✓', 'पूरा हुआ ✓') : t('Tap to play', 'खेलने के लिए टैप करो')}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted" />
                  </button>
                );
              })}

              {/* Games done summary */}
              <div className="bg-surface rounded-xl p-3 text-center mt-2">
                <p className="text-muted text-xs">
                  {completedGameCount(activeLevel.id)}/{activeLevel.games.length} {t('games completed', 'खेल पूरे')}
                  {completedGameCount(activeLevel.id) === activeLevel.games.length
                    ? ` — ${t('Level unlocked! 🎉', 'स्तर पूरा! 🎉')}`
                    : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: GAME
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'game' && activeGame) {
    return (
      <Layout
        title={t(`Game ${activeGameIdx + 1}`, `खेल ${activeGameIdx + 1}`)}
        showBack
        showCompanion
        pageContext={`Playing a catch-up game in ${activeTrack?.label}`}
        companionState={companionState}
        lang={lang}
        setLanguage={(l) => updateState({ language: l })}
        companion={appState.companion}
        streak={appState.streakDays}
      >
        <div className="max-w-md mx-auto px-4 py-5 pb-28">
          {/* Breadcrumb */}
          <button
            onClick={() => setView('level')}
            className="flex items-center gap-2 text-muted text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {lang === 'HI' ? activeLevel?.titleHI : activeLevel?.title}
          </button>

          {/* Game card */}
          <div className="card-elevated p-5 animate-fadeIn">
            {/* Track + level badge row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <RungBadge rung={activeLevel?.rung || ''} rungHI={activeLevel?.rungHI || ''} lang={lang} />
              <span className="text-xs text-muted">
                {lang === 'HI' ? activeTrack?.labelHI : activeTrack?.label} · {t(`Level ${activeLevelIdx + 1}`, `स्तर ${activeLevelIdx + 1}`)} · {t(`Game ${activeGameIdx + 1} of ${activeLevel?.games.length}`, `खेल ${activeGameIdx + 1}/${activeLevel?.games.length}`)}
              </span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeLevel?.id}-game-${activeGameIdx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <GameDispatcher
                  game={activeGame}
                  lang={lang}
                  onComplete={handleGameComplete}
                />
              </motion.div>
            </AnimatePresence>

            {/* Navigation row */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
              {activeGameIdx > 0 && (
                <button
                  onClick={() => setActiveGameIdx((i) => i - 1)}
                  className="text-muted text-sm flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> {t('Prev', 'पिछला')}
                </button>
              )}
              <div />
              {activeGameIdx < (activeLevel?.games.length || 1) - 1 && (
                <button
                  onClick={() => setActiveGameIdx((i) => i + 1)}
                  className="text-muted text-sm flex items-center gap-1"
                >
                  {t('Skip', 'छोड़ो')} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Fallback
  return null;
}
