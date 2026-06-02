// src/pages/ReadingRoom.jsx
// Route: /reading-room
// Core Dyslexia activity — Gemini-powered comprehension question.
// Module 3 will build this page fully.
// Placeholder: unblocks routing.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Pause, Volume2, BookOpen, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { READING_CONTENT, STRINGS } from '../data';
import { generateComprehensionQuestion } from '../gemini';

// OpenDyslexic CDN — Reading Room only
const DYSLEXIC_FONT_LINK = 'https://fonts.cdnfonts.com/css/opendyslexic';

// Ensure font is injected once
function injectDyslexicFont() {
  if (typeof document !== 'undefined' && !document.querySelector('#od-font')) {
    const link = document.createElement('link');
    link.id = 'od-font';
    link.rel = 'stylesheet';
    link.href = DYSLEXIC_FONT_LINK;
    document.head.appendChild(link);
  }
}

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

  // Font injection
  useEffect(() => { injectDyslexicFont(); }, []);

  const passage = READING_CONTENT[0];
  const rawText = lang === 'HI' ? passage.textHI : passage.text;
  const words = rawText.split(' ');
  const passageTitle = lang === 'HI' ? passage.titleHI : passage.title;

  // Reading state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [fontSize, setFontSize] = useState(20);
  const [speed, setSpeed] = useState(1);
  const [tappedWord, setTappedWord] = useState(null);
  const [audioCount, setAudioCount] = useState(0);
  const intervalRef = useRef(null);

  // Comprehension state
  const [phase, setPhase] = useState('reading'); // 'reading' | 'questions' | 'complete'
  const [answers, setAnswers] = useState({}); // qIdx → optionIdx
  const [feedback, setFeedback] = useState({}); // qIdx → 'correct' | 'retry'
  const [aiQuestion, setAiQuestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [companionState, setCompanionState] = useState('idle');

  // Build question list
  const staticQs = passage.comprehensionQuestions.slice(0, 2).map((q, i) => ({
    ...q,
    source: 'static',
    idx: i,
  }));

  const allQuestions = aiQuestion
    ? [...staticQs, { ...aiQuestion, source: 'ai', idx: 2 }]
    : staticQs;

  // Word-by-word interval
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

  const handlePlayPause = () => {
    if (!isPlaying && currentWordIdx >= words.length - 1) {
      setCurrentWordIdx(-1);
    }
    setIsPlaying((p) => !p);
    setAudioCount((c) => c + 1);
    setCompanionState('happy');
    setTimeout(() => setCompanionState('idle'), 1500);
  };

  // Speak a word
  const speakWord = (word) => {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleWordTap = (word) => {
    setTappedWord(word === tappedWord ? null : word);
    speakWord(word);
  };

  // Move to comprehension phase + fetch AI Q
  const handleFinishReading = async () => {
    setPhase('questions');
    setAiLoading(true);
    setAiError(false);
    const q = await generateComprehensionQuestion(passage.text, lang);
    setAiLoading(false);
    if (q) setAiQuestion(q);
    else setAiError(true);
  };

  // Answer a question
  const handleAnswer = (qIdx, optionIdx, correct) => {
    if (answers[qIdx] !== undefined) return; // already answered
    setAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
    const isCorrect = optionIdx === correct;
    setFeedback((prev) => ({ ...prev, [qIdx]: isCorrect ? 'correct' : 'retry' }));
    setCompanionState(isCorrect ? 'happy' : 'encouraging');
    setTimeout(() => setCompanionState('idle'), 2000);
  };

  const allAnswered = allQuestions.every((q, i) => answers[i] !== undefined);

  useEffect(() => {
    if (allAnswered && allQuestions.length > 0 && phase === 'questions') {
      const timer = setTimeout(() => setPhase('complete'), 1200);
      return () => clearTimeout(timer);
    }
  }, [allAnswered, allQuestions.length, phase]);

  const syllableFor = (word) => {
    const clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return passage.syllabledWords?.[clean] || passage.syllabledWords?.[word] || word;
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

        {/* ── Reading Phase ─────────────────────────────────── */}
        {phase === 'reading' && (
          <>
            {/* Story title card */}
            <div className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-4 mb-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-primary">{passageTitle}</h1>
                <p className="text-muted text-sm">
                  {lang === 'HI' ? `${words.length} शब्द • कक्षा ${passage.gradeLevel}` : `${words.length} words • Grade ${passage.gradeLevel}`}
                </p>
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {/* Play/pause */}
              <button
                onClick={handlePlayPause}
                className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl min-h-[48px] font-semibold text-sm shadow-sm hover:bg-blue-700 transition-colors flex-shrink-0"
                aria-label={isPlaying ? 'Pause reading' : 'Play reading'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying
                  ? (lang === 'HI' ? 'रोकें' : 'Pause')
                  : (lang === 'HI' ? 'सुनें' : 'Play')}
              </button>

              {/* Speed */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200 min-h-[48px]">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSpeed(s.value)}
                    className={`px-3 text-sm font-medium min-h-[48px] transition-colors ${speed === s.value ? 'bg-accent text-white' : 'bg-card text-muted hover:bg-surface'}`}
                    aria-label={`Speed ${s.label}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Font size */}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setFontSize((f) => Math.max(18, f - 2))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-card text-muted font-bold text-sm flex items-center justify-center hover:bg-surface transition-colors min-h-[48px]"
                  aria-label="Decrease font size"
                >A-</button>
                <button
                  onClick={() => setFontSize((f) => Math.min(28, f + 2))}
                  className="w-10 h-10 rounded-lg border border-gray-200 bg-card text-muted font-bold text-lg flex items-center justify-center hover:bg-surface transition-colors min-h-[48px]"
                  aria-label="Increase font size"
                >A+</button>
              </div>
            </div>

            {/* Passage */}
            <div className="bg-card rounded-2xl shadow-sm p-5 border border-gray-100 mb-4 leading-loose">
              <p style={{ fontSize: `${fontSize}px`, lineHeight: '2', letterSpacing: '0.04em' }}>
                {words.map((word, idx) => (
                  <span key={idx}>
                    <span
                      onClick={() => handleWordTap(word)}
                      className={`cursor-pointer rounded px-0.5 transition-colors duration-100 ${
                        idx === currentWordIdx
                          ? 'bg-yellow-200'
                          : tappedWord === word
                          ? 'bg-orange-100'
                          : 'hover:bg-blue-50'
                      }`}
                      aria-label={`Word: ${word}`}
                    >
                      {word}
                    </span>
                    {' '}
                  </span>
                ))}
              </p>
            </div>

            {/* Syllable card */}
            {tappedWord && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-muted text-xs mb-1">
                    {lang === 'HI' ? 'अक्षर-विभाजन' : 'Syllable breakdown'}
                  </p>
                  <p className="text-primary font-bold text-2xl tracking-widest" style={{ fontFamily: "'OpenDyslexic', sans-serif" }}>
                    {syllableFor(tappedWord)}
                  </p>
                </div>
                <button
                  onClick={() => speakWord(tappedWord)}
                  className="w-12 h-12 rounded-xl bg-warm/20 text-warm flex items-center justify-center hover:bg-warm/30 transition-colors min-h-[48px]"
                  aria-label={`Hear word: ${tappedWord}`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Finish reading CTA */}
            <button
              onClick={handleFinishReading}
              className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] flex items-center justify-center gap-2 shadow-sm hover:bg-orange-600 transition-colors"
            >
              {lang === 'HI' ? 'पढ़ना हो गया! सवालों पर जाएं' : "Done reading! Answer questions"}
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-center text-muted text-xs mt-3">
              {lang === 'HI' ? '💡 किसी भी शब्द पर टैप करें — उसे सुनें और समझें' : '💡 Tap any word to hear it and see its syllables'}
            </p>
          </>
        )}

        {/* ── Questions Phase ────────────────────────────────── */}
        {phase === 'questions' && (
          <>
            <div className="mb-5 text-center">
              <span className="text-3xl">🤔</span>
              <h2 className="text-xl font-bold text-primary mt-2">
                {lang === 'HI' ? 'आपने क्या समझा?' : 'What did you understand?'}
              </h2>
              <p className="text-muted text-sm mt-1">
                {lang === 'HI' ? 'अपना जवाब चुनें' : 'Choose your answer'}
              </p>
            </div>

            <div className="space-y-6">
              {/* Static Qs */}
              {staticQs.map((q, qIdx) => (
                <QuestionCard
                  key={qIdx}
                  q={q}
                  qIdx={qIdx}
                  answers={answers}
                  feedback={feedback}
                  lang={lang}
                  onAnswer={handleAnswer}
                />
              ))}

              {/* AI Q */}
              {aiLoading && (
                <div className="bg-card rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-muted text-sm">
                    {lang === 'HI' ? 'AI एक नया सवाल बना रहा है...' : 'AI is creating a question for you...'}
                  </p>
                </div>
              )}
              {aiError && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-warm flex-shrink-0" />
                  <p className="text-primary text-sm">
                    {lang === 'HI' ? 'AI सवाल नहीं बना सका। आगे बढ़ें!' : 'AI question unavailable. Move on!'}
                  </p>
                </div>
              )}
              {aiQuestion && (
                <QuestionCard
                  q={{ question: aiQuestion.question, options: aiQuestion.options.map((text) => ({ text, emoji: '💬' })), correct: aiQuestion.correct }}
                  qIdx={2}
                  answers={answers}
                  feedback={feedback}
                  lang={lang}
                  onAnswer={handleAnswer}
                  isAI
                />
              )}
            </div>

            {allAnswered && (
              <div className="mt-6 text-center">
                <p className="text-success font-semibold text-base mb-3">
                  {lang === 'HI' ? 'शाबाश! सभी सवाल पूरे हुए 🌟' : 'Well done! All questions complete 🌟'}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Complete Phase ────────────────────────────────── */}
        {phase === 'complete' && (
          <div className="bg-gradient-to-r from-accent to-primary text-white rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">📚</div>
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
              {lang === 'HI' ? '🦉 Gyaan को आप पर गर्व है!' : `🦉 ${appState.companion?.nickname || 'Gyaan'} is so proud of you!`}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/home')}
                className="w-full bg-white text-primary py-3 rounded-xl font-semibold min-h-[48px] hover:bg-gray-50 transition-colors"
              >
                {lang === 'HI' ? '← घर जाएं' : '← Back to Home'}
              </button>
              <button
                onClick={() => navigate('/achievements')}
                className="w-full bg-white/20 text-white py-3 rounded-xl font-semibold min-h-[48px] hover:bg-white/30 transition-colors"
              >
                {lang === 'HI' ? '🏆 उपलब्धियाँ देखें' : '🏆 See My Achievements'}
              </button>
            </div>
          </div>
        )}

        {/* ── Persistent struggling button ─────────────────── */}
        {phase !== 'complete' && (
          <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-4 z-30 pointer-events-none">
            <button
              onClick={() => navigate('/home')}
              className="pointer-events-auto bg-warm text-white rounded-xl px-5 py-2 min-h-[48px] text-sm font-semibold shadow-lg hover:bg-orange-600 transition-colors"
            >
              😰 {S.iAmStruggling}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Question card sub-component ─────────────────────────────────────────
function QuestionCard({ q, qIdx, answers, feedback, lang, onAnswer, isAI = false }) {
  const answered = answers[qIdx] !== undefined;
  const fb = feedback[qIdx];

  return (
    <div className="bg-card rounded-2xl shadow-sm p-4 border border-gray-100">
      {isAI && (
        <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium mb-2 inline-block">
          ✨ {lang === 'HI' ? 'AI प्रश्न' : 'AI Question'}
        </span>
      )}
      <p className="text-primary font-semibold text-lg leading-snug mb-4">
        {lang === 'HI' && q.questionHI ? q.questionHI : q.question}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {q.options.map((opt, optIdx) => {
          const isSelected = answers[qIdx] === optIdx;
          const isCorrect = optIdx === q.correct;
          let tileClass = 'bg-card border-gray-100 hover:bg-surface hover:border-accent';
          if (answered && isSelected && fb === 'correct') tileClass = 'bg-green-50 border-success';
          if (answered && isSelected && fb === 'retry') tileClass = 'bg-orange-50 border-warm';
          if (answered && !isSelected && isCorrect && fb === 'retry') tileClass = 'bg-green-50 border-success opacity-80';

          return (
            <button
              key={optIdx}
              onClick={() => onAnswer(qIdx, optIdx, q.correct)}
              disabled={answered}
              className={`min-h-[80px] rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 p-2 transition-all ${tileClass} ${answered ? 'cursor-default' : 'cursor-pointer'}`}
              aria-label={typeof opt === 'string' ? opt : opt.text}
            >
              <span className="text-2xl">{typeof opt === 'string' ? '💬' : opt.emoji}</span>
              <span className="text-primary font-medium text-sm text-center leading-tight">
                {typeof opt === 'string' ? opt : opt.text}
              </span>
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`text-sm font-medium mt-3 text-center ${fb === 'correct' ? 'text-success' : 'text-warm'}`}>
          {fb === 'correct'
            ? (lang === 'HI' ? '🌟 बिल्कुल सही!' : '🌟 You got it!')
            : (lang === 'HI' ? '👍 अच्छी कोशिश! देखो सही जवाब।' : '👍 Good try! See the correct answer.')}
        </p>
      )}
    </div>
  );
}
