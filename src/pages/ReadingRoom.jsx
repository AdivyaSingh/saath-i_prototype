// src/pages/ReadingRoom.jsx
// Route: /reading-room
// Core Dyslexia activity — passage reading with OpenDyslexic font,
// word-by-word highlighting, syllable breakdown, and comprehension questions.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Play, Pause, Volume2, BookOpen, ArrowRight, Loader2, AlertCircle,
  Minus, Plus, Heart, Check, ChevronRight, Sparkles, RefreshCw, Home,
  Award, HelpCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { READING_CONTENT, STRINGS } from '../data';
import { generateComprehensionQuestions, generateReadingPassage } from '../gemini';
import { updateStudentProgress } from '../firebase';

// ── OpenDyslexic CDN — Reading Room only ────────────────────────────────────
const DYSLEXIC_FONT_LINK = 'https://fonts.cdnfonts.com/css/opendyslexic';

const injectDyslexicFont = () => {
  if (typeof document !== 'undefined' && !document.querySelector('#od-font')) {
    const link = document.createElement('link');
    link.id = 'od-font';
    link.rel = 'stylesheet';
    link.href = DYSLEXIC_FONT_LINK;
    document.head.appendChild(link);
  }
};

// ── Speed presets ───────────────────────────────────────────────────────────
const SPEEDS = [
  { label: '0.75×', value: 0.75 },
  { label: '1×', value: 1 },
  { label: '1.25×', value: 1.25 },
];

export default function ReadingRoom() {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEasy = searchParams.get('easy') === 'true';
  const lang = appState.language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;

  // Inject OpenDyslexic font on mount
  useEffect(() => { injectDyslexicFont(); }, []);

  // ── Passage selection state ─────────────────────────────────────────────
  // If ?easy=true, default to the lowest grade passage; otherwise show picker
  const sortedPassages = [...READING_CONTENT].sort((a, b) => a.gradeLevel - b.gradeLevel);
  const defaultIdx = isEasy ? 0 : null;
  const [selectedPassageIdx, setSelectedPassageIdx] = useState(defaultIdx);
  const [generatedPassage, setGeneratedPassage] = useState(null);
  const [generatingPassage, setGeneratingPassage] = useState(false);

  // Determine active passage (generated or static)
  const activePassage = generatedPassage
    ? generatedPassage
    : selectedPassageIdx !== null
      ? sortedPassages[selectedPassageIdx]
      : null;

  const rawText = activePassage
    ? (lang === 'HI' && activePassage.textHI ? activePassage.textHI : activePassage.text)
    : '';
  const words = rawText ? rawText.split(' ') : [];
  const passageTitle = activePassage
    ? (lang === 'HI' && activePassage.titleHI ? activePassage.titleHI : activePassage.title)
    : '';

  // ── Reading state ─────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [fontSize, setFontSize] = useState(20);
  const [speed, setSpeed] = useState(1);
  const [tappedWord, setTappedWord] = useState(null);
  const [tappedWordIdx, setTappedWordIdx] = useState(null);
  const [audioCount, setAudioCount] = useState(0);
  const intervalRef = useRef(null);

  // ── Comprehension state ───────────────────────────────────────────────────
  const [phase, setPhase] = useState('select'); // 'select' | 'reading' | 'questions' | 'complete'
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [aiQuestions, setAiQuestions] = useState(null); // Array of 3 AI questions
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [companionState, setCompanionState] = useState('idle');
  const [completionTracked, setCompletionTracked] = useState(false);

  // Reset to reading phase when a passage is selected
  useEffect(() => {
    if (activePassage && phase === 'select') {
      setPhase('reading');
    }
  }, [activePassage]);

  // If easy mode, auto-start reading
  useEffect(() => {
    if (isEasy && selectedPassageIdx === 0) {
      setPhase('reading');
    }
  }, [isEasy, selectedPassageIdx]);

  // ── Build question list ─────────────────────────────────────────────────
  // When AI questions are loaded, use them directly.
  // When AI fails, fall back to the passage's static comprehension questions (3 questions).
  const staticFallbackQs = activePassage?.comprehensionQuestions
    ? activePassage.comprehensionQuestions.slice(0, 3).map((q, i) => ({
        ...q, source: 'static', idx: i,
      }))
    : [];

  const allQuestions = aiQuestions
    ? aiQuestions.map((q, i) => ({
        question: q.question,
        options: Array.isArray(q.options)
          ? q.options.map((opt) => (typeof opt === 'string' ? { text: opt } : opt))
          : [],
        correct: q.correct,
        source: 'ai',
        idx: i,
      }))
    : aiError
      ? staticFallbackQs
      : [];

  // ── Word-by-word highlight interval ───────────────────────────────────────
  const startInterval = useCallback(() => {
    const delay = Math.round(600 / speed);
    intervalRef.current = setInterval(() => {
      setCurrentWordIdx((prev) => {
        if (prev >= words.length - 1) {
          clearInterval(intervalRef.current);
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);
  }, [words.length, speed]);

  useEffect(() => {
    if (isPlaying) {
      startInterval();
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, startInterval]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (!isPlaying && currentWordIdx >= words.length - 1) {
      setCurrentWordIdx(-1);
    }
    setIsPlaying((p) => !p);
    setAudioCount((c) => c + 1);
    setCompanionState('happy');
    setTimeout(() => setCompanionState('idle'), 1500);
  };

  const speakWord = (word) => {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleWordTap = (word, idx) => {
    if (tappedWordIdx === idx) {
      setTappedWord(null);
      setTappedWordIdx(null);
    } else {
      setTappedWord(word);
      setTappedWordIdx(idx);
      speakWord(word);
    }
  };

  const syllableFor = (word) => {
    if (!activePassage?.syllabledWords) return word;
    const clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return activePassage.syllabledWords[clean] || activePassage.syllabledWords[word] || word;
  };

  // Move to comprehension + fetch AI questions (plural — 3 at once)
  const handleFinishReading = async () => {
    setPhase('questions');
    setAiLoading(true);
    setAiError(false);
    setAnswers({});
    setFeedback({});
    setAiQuestions(null);
    setCompletionTracked(false);

    const text = activePassage?.text || rawText;
    const questions = await generateComprehensionQuestions(text, lang, activePassage?.gradeLevel || 4);
    setAiLoading(false);
    if (questions && Array.isArray(questions) && questions.length > 0) {
      setAiQuestions(questions.slice(0, 3));
    } else {
      setAiError(true);
    }
  };

  // Answer handler
  const handleAnswer = (qIdx, optionIdx, correct) => {
    if (answers[qIdx] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
    const isCorrect = optionIdx === correct;
    setFeedback((prev) => ({ ...prev, [qIdx]: isCorrect ? 'correct' : 'retry' }));
    setCompanionState(isCorrect ? 'happy' : 'encouraging');
    setTimeout(() => setCompanionState('idle'), 2000);
  };

  const allAnswered = allQuestions.length > 0 && allQuestions.every((_, i) => answers[i] !== undefined);

  // Handle completion — track activity + fire confetti
  const handleComplete = async () => {
    setPhase('complete');

    // Fire confetti burst
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#1B3A6B', '#2E75B6', '#E87722', '#2E8B57', '#00B0A0'],
    });

    // Track activity completion in local state
    if (!completionTracked) {
      setCompletionTracked(true);
      const currentReadingCount = appState.activitiesCompleted?.reading || 0;
      updateState({
        activitiesCompleted: {
          ...appState.activitiesCompleted,
          reading: currentReadingCount + 1,
        },
      });

      // Save progress to Firebase
      const studentId = appState.studentId || appState.id;
      if (studentId) {
        try {
          await updateStudentProgress(studentId, {
            activitiesCompleted: {
              ...appState.activitiesCompleted,
              reading: currentReadingCount + 1,
            },
            lastActivity: 'reading',
            wordsRead: (appState.wordsRead || 0) + words.length,
          });
        } catch (err) {
          console.error('Failed to save progress to Firebase:', err);
        }
      }
    }
  };

  // Generate a new AI passage
  const handleGeneratePassage = async () => {
    setGeneratingPassage(true);
    setGeneratedPassage(null);
    const classLevel = appState.studentClass || 4;
    const result = await generateReadingPassage(classLevel, lang);
    setGeneratingPassage(false);

    if (result) {
      // Normalize the generated passage to match our structure
      setGeneratedPassage({
        id: 'generated',
        title: result.title,
        text: result.text,
        gradeLevel: classLevel,
        syllabledWords: result.syllabledWords || {},
        comprehensionQuestions: result.questions || [],
      });
      setPhase('reading');
      setCurrentWordIdx(-1);
      setIsPlaying(false);
      setAnswers({});
      setFeedback({});
      setAiQuestions(null);
      setCompletionTracked(false);
    }
  };

  // Select a static passage
  const handleSelectPassage = (idx) => {
    setSelectedPassageIdx(idx);
    setGeneratedPassage(null);
    setPhase('reading');
    setCurrentWordIdx(-1);
    setIsPlaying(false);
    setAnswers({});
    setFeedback({});
    setAiQuestions(null);
    setTappedWord(null);
    setTappedWordIdx(null);
    setCompletionTracked(false);
  };

  // Go back to passage selection
  const handleBackToSelect = () => {
    setPhase('select');
    setSelectedPassageIdx(null);
    setGeneratedPassage(null);
    setCurrentWordIdx(-1);
    setIsPlaying(false);
    setTappedWord(null);
    setTappedWordIdx(null);
    setCompletionTracked(false);
  };

  return (
    <Layout
      title={S.readingRoom}
      showBack
      showCompanion
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      <div
        className="max-w-md mx-auto px-4 py-4 pb-24"
        style={{ fontFamily: "'OpenDyslexic', 'Poppins', sans-serif" }}
      >

        {/* ── Passage Selection Phase ──────────────────────────────── */}
        {phase === 'select' && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-1">
                {lang === 'HI' ? 'कहानी चुनें' : 'Choose a Story'}
              </h2>
              <p className="text-muted text-sm">
                {lang === 'HI' ? 'पढ़ने के लिए एक कहानी चुनें' : 'Pick a story to read today'}
              </p>
            </div>

            {/* Passage title cards */}
            <div className="space-y-3 mb-5">
              {sortedPassages.map((p, idx) => (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelectPassage(idx)}
                  className="w-full bg-card rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-accent/40 hover:shadow-md transition-all text-left min-h-[72px] group"
                  aria-label={`Read ${lang === 'HI' && p.titleHI ? p.titleHI : p.title}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 flex items-center justify-center flex-shrink-0 group-hover:from-accent/20 group-hover:to-primary/20 transition-colors">
                    <BookOpen className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-primary font-semibold text-base truncate">
                      {lang === 'HI' && p.titleHI ? p.titleHI : p.title}
                    </p>
                    <p className="text-muted text-xs mt-0.5">
                      {lang === 'HI'
                        ? `कक्षा ${p.gradeLevel} • ${(lang === 'HI' && p.textHI ? p.textHI : p.text).split(' ').length} शब्द`
                        : `Grade ${p.gradeLevel} • ${p.text.split(' ').length} words`}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 group-hover:text-accent transition-colors" />
                </motion.button>
              ))}
            </div>

            {/* Generate new passage button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGeneratePassage}
              disabled={generatingPassage}
              className="w-full bg-gradient-to-r from-accent to-primary text-white py-3 rounded-xl font-semibold min-h-[48px] flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              aria-label="Generate a new passage with AI"
            >
              {generatingPassage ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {lang === 'HI' ? 'नई कहानी बन रही है...' : 'Creating your story...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {lang === 'HI' ? 'AI से नई कहानी बनाएं' : 'Generate New Passage'}
                </>
              )}
            </motion.button>
          </div>
        )}

        {/* ── Reading Phase ─────────────────────────────────────── */}
        {phase === 'reading' && activePassage && (
          <div className="animate-fadeIn">
            {/* Story title card */}
            <div className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-primary truncate">{passageTitle}</h1>
                <p className="text-muted text-sm">
                  {lang === 'HI'
                    ? `${words.length} शब्द • कक्षा ${activePassage.gradeLevel || appState.studentClass}`
                    : `${words.length} words • Grade ${activePassage.gradeLevel || appState.studentClass}`}
                </p>
              </div>
              {/* Back to passage picker */}
              {!isEasy && (
                <button
                  onClick={handleBackToSelect}
                  className="text-muted text-xs underline underline-offset-2 hover:text-accent transition-colors flex-shrink-0"
                  aria-label="Change passage"
                >
                  {lang === 'HI' ? 'बदलें' : 'Change'}
                </button>
              )}
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {/* Play/pause */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePlayPause}
                className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl min-h-[48px] font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity flex-shrink-0"
                aria-label={isPlaying ? 'Pause reading' : 'Play reading'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying
                  ? (lang === 'HI' ? 'रोकें' : 'Pause')
                  : (lang === 'HI' ? 'सुनें' : 'Play')}
              </motion.button>

              {/* Speed selector */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200 min-h-[48px]">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSpeed(s.value)}
                    className={`px-3 text-sm font-medium min-h-[48px] transition-colors ${
                      speed === s.value
                        ? 'bg-accent text-white'
                        : 'bg-card text-muted hover:bg-surface'
                    }`}
                    aria-label={`Speed ${s.label}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Font size controls with Lucide icons */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setFontSize((f) => Math.max(18, f - 2))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-card text-muted flex items-center justify-center hover:bg-surface transition-colors min-h-[48px]"
                  aria-label="Decrease font size"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted font-medium w-6 text-center">{fontSize}</span>
                <button
                  onClick={() => setFontSize((f) => Math.min(28, f + 2))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-card text-muted flex items-center justify-center hover:bg-surface transition-colors min-h-[48px]"
                  aria-label="Increase font size"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Passage text with word-by-word highlighting */}
            <div className="bg-card rounded-2xl shadow-sm p-5 border border-gray-100 mb-4 leading-loose">
              <p style={{ fontSize: `${fontSize}px`, lineHeight: '2', letterSpacing: '0.04em' }}>
                {words.map((word, idx) => (
                  <span key={idx}>
                    <span
                      onClick={() => handleWordTap(word, idx)}
                      className={`cursor-pointer rounded px-0.5 transition-colors duration-150 ${
                        idx === currentWordIdx
                          ? 'bg-yellow-200/70 rounded'
                          : tappedWordIdx === idx
                          ? 'bg-warm/15 rounded'
                          : 'hover:bg-accent/5'
                      }`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Word: ${word}`}
                      onKeyDown={(e) => e.key === 'Enter' && handleWordTap(word, idx)}
                    >
                      {word}
                    </span>
                    {' '}
                  </span>
                ))}
              </p>
            </div>

            {/* Syllable breakdown card — appears below the passage */}
            {tappedWord && (
              <div className="bg-warm/5 border border-warm/20 rounded-2xl p-4 mb-4 flex items-center gap-4 animate-slideUp">
                <div className="flex-1">
                  <p className="text-muted text-xs mb-1">
                    {lang === 'HI' ? 'अक्षर-विभाजन' : 'Syllable breakdown'}
                  </p>
                  <p
                    className="text-primary font-bold text-2xl tracking-widest"
                    style={{ fontFamily: "'OpenDyslexic', sans-serif" }}
                  >
                    {syllableFor(tappedWord)}
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => speakWord(tappedWord)}
                  className="w-12 h-12 rounded-xl bg-warm/15 text-warm flex items-center justify-center hover:bg-warm/25 transition-colors min-h-[48px]"
                  aria-label={`Hear word: ${tappedWord}`}
                >
                  <Volume2 className="w-5 h-5" />
                </motion.button>
              </div>
            )}

            {/* Finish reading CTA */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleFinishReading}
              className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
              aria-label="Finish reading and answer questions"
            >
              {lang === 'HI' ? 'पढ़ना हो गया! सवालों पर जाएं' : "Done reading! Answer questions"}
              <ArrowRight className="w-5 h-5" />
            </motion.button>

            <p className="text-center text-muted text-xs mt-3 flex items-center justify-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              {lang === 'HI'
                ? 'किसी भी शब्द पर टैप करें — उसे सुनें और समझें'
                : 'Tap any word to hear it and see its syllables'}
            </p>
          </div>
        )}

        {/* ── Questions Phase ──────────────────────────────────── */}
        {phase === 'questions' && (
          <div className="animate-fadeIn">
            <div className="mb-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <HelpCircle className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-xl font-bold text-primary">
                {lang === 'HI' ? 'आपने क्या समझा?' : 'What did you understand?'}
              </h2>
              <p className="text-muted text-sm mt-1">
                {lang === 'HI' ? 'सभी सवालों का जवाब दें' : 'Answer all the questions below'}
              </p>
            </div>

            {/* AI loading state — shown while fetching questions */}
            {aiLoading && (
              <div className="bg-card rounded-2xl border border-gray-100 p-8 flex flex-col items-center gap-3 mb-5">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-muted text-sm text-center">
                  {lang === 'HI' ? 'AI सवाल तैयार कर रहा है...' : 'AI is preparing your questions...'}
                </p>
              </div>
            )}

            {/* All questions displayed simultaneously */}
            {!aiLoading && allQuestions.length > 0 && (
              <div className="space-y-5">
                {allQuestions.map((q, qIdx) => (
                  <motion.div
                    key={qIdx}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: qIdx * 0.12, duration: 0.35 }}
                  >
                    <QuestionCard
                      q={q}
                      qIdx={qIdx}
                      qNumber={qIdx + 1}
                      totalQuestions={allQuestions.length}
                      answers={answers}
                      feedback={feedback}
                      lang={lang}
                      onAnswer={handleAnswer}
                      isAI={q.source === 'ai'}
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {/* AI error notice — when no AI questions and no fallback either */}
            {aiError && allQuestions.length === 0 && (
              <div className="bg-warm/5 border border-warm/20 rounded-2xl p-4 flex items-center gap-3 mb-5">
                <AlertCircle className="w-5 h-5 text-warm flex-shrink-0" />
                <p className="text-primary text-sm">
                  {lang === 'HI' ? 'सवाल तैयार नहीं हो सके। कृपया फिर से कोशिश करें।' : 'Could not prepare questions. Please try again.'}
                </p>
              </div>
            )}

            {/* Finish Reading button — visible only after all answered */}
            {allAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-6"
              >
                <p className="text-success font-semibold text-base flex items-center justify-center gap-2 mb-4">
                  <Check className="w-5 h-5" />
                  {lang === 'HI' ? 'शाबाश! सभी सवाल पूरे हुए' : 'Well done! All questions complete'}
                </p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleComplete}
                  className="w-full bg-gradient-to-r from-success to-calm text-white py-3.5 rounded-xl font-semibold min-h-[48px] flex items-center justify-center gap-2 shadow-md hover:opacity-90 transition-opacity text-lg"
                  aria-label="Finish reading activity"
                >
                  <Award className="w-5 h-5" />
                  {lang === 'HI' ? 'पढ़ना पूरा करें' : 'Finish Reading'}
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}
          </div>
        )}

        {/* ── Completion Phase ─────────────────────────────────── */}
        {phase === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="bg-gradient-to-br from-accent via-primary to-accent text-white rounded-2xl p-6 text-center shadow-lg">
              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {lang === 'HI'
                  ? `आपने आज ${words.length} शब्द पढ़े!`
                  : `You read ${words.length} words today!`}
              </h2>
              <p className="text-white/80 text-base mb-2">
                {lang === 'HI'
                  ? `आपने ${audioCount} बार Read-Along सहायता ली — यह एक स्मार्ट लर्निंग टूल है!`
                  : `You used the read-along helper ${audioCount} time${audioCount !== 1 ? 's' : ''} — that's a smart learning tool!`}
              </p>
              <p className="text-white/70 text-sm mb-6">
                {lang === 'HI'
                  ? `${appState.companion?.nickname || 'Gyaan'} को आप पर गर्व है!`
                  : `${appState.companion?.nickname || 'Gyaan'} is so proud of you!`}
              </p>
              <div className="flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/home')}
                  className="w-full bg-white text-primary py-3 rounded-xl font-semibold min-h-[48px] hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                  aria-label="Back to home"
                >
                  <Home className="w-4 h-4" />
                  {lang === 'HI' ? 'घर जाएं' : 'Back to Home'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    handleBackToSelect();
                  }}
                  className="w-full bg-white/15 text-white py-3 rounded-xl font-semibold min-h-[48px] hover:bg-white/25 transition-colors flex items-center justify-center gap-2"
                  aria-label="Read another story"
                >
                  <RefreshCw className="w-4 h-4" />
                  {lang === 'HI' ? 'और कहानी पढ़ें' : 'Read Another Story'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/achievements')}
                  className="w-full bg-white/15 text-white py-3 rounded-xl font-semibold min-h-[48px] hover:bg-white/25 transition-colors flex items-center justify-center gap-2"
                  aria-label="See achievements"
                >
                  <Award className="w-4 h-4" />
                  {lang === 'HI' ? 'उपलब्धियाँ देखें' : 'See My Achievements'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Persistent "I need help" button ──────────────────── */}
        {phase !== 'complete' && phase !== 'select' && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-4 z-30 pointer-events-none">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/home')}
              className="pointer-events-auto bg-warm/90 backdrop-blur-sm text-white rounded-xl px-5 py-2 min-h-[48px] text-sm font-semibold shadow-lg hover:bg-warm transition-colors flex items-center gap-2"
              aria-label="I need help"
            >
              <Heart className="w-4 h-4" />
              {S.iAmStruggling}
            </motion.button>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Question Card sub-component ─────────────────────────────────────────────
const QuestionCard = ({ q, qIdx, qNumber, totalQuestions, answers, feedback, lang, onAnswer, isAI = false }) => {
  const answered = answers[qIdx] !== undefined;
  const fb = feedback[qIdx];

  return (
    <div
      className={`bg-card rounded-2xl shadow-sm p-4 border-2 transition-colors ${
        answered && fb === 'correct'
          ? 'border-success/30 bg-success/5'
          : answered && fb === 'retry'
          ? 'border-warm/30 bg-warm/5'
          : 'border-gray-100'
      }`}
    >
      {/* Question header with number badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
          {qNumber}
        </span>
        {isAI && (
          <span className="text-xs bg-accent/10 text-accent px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {lang === 'HI' ? 'AI प्रश्न' : 'AI Question'}
          </span>
        )}
        {answered && fb === 'correct' && (
          <Check className="w-4 h-4 text-success ml-auto" />
        )}
      </div>

      <p className="text-primary font-semibold text-lg leading-snug mb-4">
        {lang === 'HI' && q.questionHI ? q.questionHI : q.question}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt, optIdx) => {
          const optText = typeof opt === 'string' ? opt : opt.text;
          const isSelected = answers[qIdx] === optIdx;
          const isCorrect = optIdx === q.correct;

          let tileClass = 'bg-card border-gray-200 hover:bg-surface hover:border-accent/40';
          if (answered && isSelected && fb === 'correct') {
            tileClass = 'bg-success/10 border-success';
          }
          if (answered && isSelected && fb === 'retry') {
            tileClass = 'bg-warm/10 border-warm';
          }
          if (answered && !isSelected && isCorrect && fb === 'retry') {
            tileClass = 'bg-success/10 border-success/60';
          }

          return (
            <motion.button
              key={optIdx}
              whileTap={!answered ? { scale: 0.97 } : {}}
              onClick={() => onAnswer(qIdx, optIdx, q.correct)}
              disabled={answered}
              className={`min-h-[64px] rounded-xl border-2 flex items-center justify-center gap-2 p-3 transition-all ${tileClass} ${
                answered ? 'cursor-default' : 'cursor-pointer'
              }`}
              aria-label={optText}
            >
              {/* Show check icon for correct answer after answering */}
              {answered && isCorrect && fb === 'correct' && isSelected && (
                <Check className="w-4 h-4 text-success flex-shrink-0" />
              )}
              {answered && isCorrect && fb === 'retry' && !isSelected && (
                <Check className="w-4 h-4 text-success flex-shrink-0" />
              )}
              <span className="text-primary font-medium text-sm text-center leading-tight">
                {optText}
              </span>
            </motion.button>
          );
        })}
      </div>
      {answered && (
        <p className={`text-sm font-medium mt-3 text-center flex items-center justify-center gap-1.5 ${
          fb === 'correct' ? 'text-success' : 'text-warm'
        }`}>
          {fb === 'correct' ? (
            <>
              <Check className="w-4 h-4" />
              {lang === 'HI' ? 'बिल्कुल सही!' : 'You got it!'}
            </>
          ) : (
            <>
              {lang === 'HI' ? 'अच्छी कोशिश! देखो सही जवाब।' : 'Good try! See the correct answer.'}
            </>
          )}
        </p>
      )}
    </div>
  );
};
