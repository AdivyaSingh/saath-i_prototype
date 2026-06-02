// src/pages/StudentHome.jsx
// Route: /home
// Daily landing screen — activities, streak, companion, "I'm struggling" button.
// Module 2 will build this page fully.
// Placeholder: unblocks routing.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Hash, Trophy, Flame, Wind, ChevronRight, Sparkles, Star } from 'lucide-react';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { STRINGS } from '../data';

// Breathing cycle phases
const BREATH_PHASES = [
  { label: 'Breathe in...', scale: 'scale-110', duration: 4000 },
  { label: 'Hold...', scale: 'scale-110', duration: 2000 },
  { label: 'Breathe out...', scale: 'scale-75', duration: 4000 },
];

export default function StudentHome() {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;

  const [showStruggleModal, setShowStruggleModal] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathCycles, setBreathCycles] = useState(0);
  const [showEasierPrompt, setShowEasierPrompt] = useState(false);
  const [companionState, setCompanionState] = useState('idle');

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return lang === 'HI' ? 'शुभ प्रभात' : 'Good morning';
    if (hour < 17) return lang === 'HI' ? 'नमस्ते' : 'Good afternoon';
    return lang === 'HI' ? 'शुभ संध्या' : 'Good evening';
  };

  const todayLabel = new Date().toLocaleDateString(lang === 'HI' ? 'hi-IN' : 'en-IN', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Breathing animation cycle
  useEffect(() => {
    if (!showStruggleModal) return;
    let timeout;
    const phases = BREATH_PHASES;
    const advance = (idx, cycles) => {
      const next = (idx + 1) % phases.length;
      const nextCycles = next === 0 ? cycles + 1 : cycles;
      timeout = setTimeout(() => {
        setBreathPhase(next);
        setBreathCycles(nextCycles);
        if (nextCycles < 3) advance(next, nextCycles);
        else setShowEasierPrompt(true);
      }, phases[idx].duration);
    };
    setBreathPhase(0);
    setBreathCycles(0);
    setShowEasierPrompt(false);
    advance(0, 0);
    return () => clearTimeout(timeout);
  }, [showStruggleModal]);

  const handleStruggleOpen = () => {
    setShowStruggleModal(true);
    setCompanionState('encouraging');
  };
  const handleStruggleClose = () => {
    setShowStruggleModal(false);
    setCompanionState('idle');
  };

  const activities = [
    {
      id: 'reading',
      icon: <BookOpen className="w-6 h-6" />,
      title: S.readingRoom,
      subtitle: lang === 'HI' ? '"चतुर कौआ"' : '"The Clever Crow"',
      duration: lang === 'HI' ? '~10 मिनट' : '~10 min',
      badge: lang === 'HI' ? '🔤 डिस्लेक्सिया सहायता' : '🔤 Dyslexia Support',
      borderColor: 'border-accent',
      iconBg: 'bg-accent/10 text-accent',
      route: '/reading-room',
    },
    {
      id: 'numbers',
      icon: <Hash className="w-6 h-6" />,
      title: S.numberWorld,
      subtitle: lang === 'HI' ? 'सेब जोड़ो' : 'Adding Apples',
      duration: lang === 'HI' ? '~8 मिनट' : '~8 min',
      badge: lang === 'HI' ? '🧮 डिसकैलकुलिया फोकस' : '🧮 Dyscalculia Focus',
      borderColor: 'border-warm',
      iconBg: 'bg-warm/10 text-warm',
      route: '/number-world',
    },
  ];

  return (
    <Layout
      title={S.appName}
      showBack={false}
      showCompanion
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      {/* ── Page wrapper ─────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 py-6 pb-28">

        {/* ── Greeting ─────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary leading-tight">
                {getGreeting()}, {appState.studentName || 'Arjun'}! 👋
              </h1>
              <p className="text-muted text-sm mt-1">{todayLabel}</p>
            </div>
            {/* Streak badge */}
            <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 min-h-[48px]">
              <Flame className="w-5 h-5 text-warm" />
              <span className="text-warm font-bold text-lg leading-none">{appState.streakDays || 4}</span>
            </div>
          </div>

          {/* Motivational banner */}
          <div className="mt-4 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-3xl">{appState.companion?.emoji || '🦉'}</span>
            <p className="text-primary font-medium text-base leading-snug">
              {lang === 'HI'
                ? `${appState.companion?.nickname || 'Gyaan'} यहाँ है! आज भी हम साथ सीखेंगे 🌟`
                : `${appState.companion?.nickname || 'Gyaan'} is here! Let's learn together today 🌟`}
            </p>
          </div>
        </div>

        {/* ── Today's Journey ──────────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🚀</span>
            <h2 className="text-lg font-semibold text-primary">{S.todaysJourney}</h2>
          </div>

          <div className="space-y-3">
            {activities.map((act) => (
              <div
                key={act.id}
                className={`bg-card rounded-2xl shadow-sm p-4 border-l-4 ${act.borderColor} border border-gray-100`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${act.iconBg}`}>
                      {act.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-primary text-base leading-tight">{act.title}</h3>
                      <p className="text-muted text-sm mt-0.5 truncate">{act.subtitle}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted">{act.duration}</span>
                        <span className="text-xs bg-surface px-2 py-0.5 rounded-full text-muted border border-gray-100">
                          {act.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setCompanionState('happy'); setTimeout(() => navigate(act.route), 200); }}
                    className="flex-shrink-0 bg-accent text-white px-4 py-2 rounded-xl min-h-[48px] font-semibold text-sm flex items-center gap-1 shadow-sm hover:bg-blue-700 transition-colors"
                    aria-label={`Start ${act.title}`}
                  >
                    {lang === 'HI' ? 'शुरू' : 'Start'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Expression Studio card ───────────────────────── */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/expression-studio')}
            className="w-full bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-100 rounded-2xl p-4 text-left flex items-center gap-3 min-h-[72px] hover:shadow-md transition-shadow"
          >
            <div className="w-11 h-11 rounded-xl bg-warm/10 text-warm flex items-center justify-center flex-shrink-0 text-2xl">
              🎨
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-primary text-base">{S.expressionStudio}</h3>
              <p className="text-muted text-sm">
                {lang === 'HI' ? 'बोलो, बनाओ, या शब्द जोड़ो' : 'Speak, draw, or build words'}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* ── Your Achievements teaser ─────────────────────── */}
        <div className="bg-gradient-to-r from-success/10 to-accent/10 rounded-2xl p-4 flex items-center gap-3 border border-success/20">
          <Star className="w-8 h-8 text-success flex-shrink-0" />
          <div className="flex-1">
            <p className="text-primary font-semibold text-base">
              {lang === 'HI' ? 'आपकी उपलब्धियाँ देखें 🏆' : 'See your achievements 🏆'}
            </p>
            <p className="text-muted text-sm">
              {lang === 'HI' ? 'आपने इस हफ्ते 287 शब्द पढ़े!' : 'You read 287 words this week!'}
            </p>
          </div>
          <button
            onClick={() => navigate('/achievements')}
            className="bg-success text-white px-3 py-2 rounded-xl text-sm font-semibold min-h-[48px] hover:bg-green-700 transition-colors"
            aria-label="View Achievement Wall"
          >
            {lang === 'HI' ? 'देखें' : 'View'}
          </button>
        </div>

      </div>

      {/* ── Fixed bottom bar ─────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-gray-100 px-4 py-3 flex items-center justify-between z-30 safe-area-bottom">
        {/* Streak */}
        <div className="flex items-center gap-1.5">
          <Flame className="w-5 h-5 text-warm" />
          <span className="text-sm font-semibold text-primary">
            {appState.streakDays || 4}
            {lang === 'HI' ? ' दिन' : '-day'}
          </span>
          {lang !== 'HI' && <span className="text-muted text-xs">streak</span>}
        </div>

        {/* Achievement link */}
        <button
          onClick={() => navigate('/achievements')}
          className="flex items-center gap-1.5 min-h-[48px] px-3 text-accent font-semibold text-sm hover:bg-accent/10 rounded-xl transition-colors"
          aria-label="Achievement Wall"
        >
          <Trophy className="w-5 h-5" />
          <span className="hidden sm:inline">{S.achievementWall}</span>
        </button>

        {/* I'm struggling */}
        <button
          onClick={handleStruggleOpen}
          className="bg-warm text-white rounded-xl px-4 py-2 min-h-[48px] text-sm font-semibold flex items-center gap-1.5 shadow-sm hover:bg-orange-600 transition-colors"
          aria-label={S.iAmStruggling}
        >
          <span>😰</span>
          <span>{S.iAmStruggling}</span>
        </button>
      </div>

      {/* ── "I'm Struggling" overlay ─────────────────────── */}
      {showStruggleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-lg">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-primary mb-1">{S.breathe}</h2>
              <p className="text-muted text-base">
                {lang === 'HI'
                  ? 'यह बिल्कुल ठीक है। साथ में करते हैं।'
                  : "That's okay. Let's do this together."}
              </p>
            </div>

            {/* Breathing circle */}
            {!showEasierPrompt ? (
              <div className="flex flex-col items-center gap-4 my-4">
                <div
                  className={`w-28 h-28 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg
                    transition-transform duration-[3000ms] ease-in-out ${BREATH_PHASES[breathPhase].scale}`}
                  role="img"
                  aria-label={BREATH_PHASES[breathPhase].label}
                >
                  <Wind className="w-10 h-10 text-white opacity-80" />
                </div>
                <p className="text-primary font-semibold text-lg animate-pulse">
                  {lang === 'HI'
                    ? ['सांस लो...', 'रोको...', 'छोड़ो...'][breathPhase]
                    : BREATH_PHASES[breathPhase].label}
                </p>
                <p className="text-muted text-sm">
                  {lang === 'HI'
                    ? `${3 - breathCycles} और चक्र`
                    : `${3 - breathCycles} more cycle${3 - breathCycles !== 1 ? 's' : ''}`}
                </p>
              </div>
            ) : (
              <div className="my-4">
                <p className="text-primary text-center font-semibold text-base mb-5">
                  <Sparkles className="w-5 h-5 inline mr-1 text-warm" />
                  {S.tryEasier}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => { handleStruggleClose(); navigate('/reading-room?easy=true'); }}
                    className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] hover:bg-orange-600 transition-colors"
                  >
                    {lang === 'HI' ? 'हाँ, कुछ आसान करें' : 'Yes, something easier'}
                  </button>
                  <button
                    onClick={handleStruggleClose}
                    className="w-full border-2 border-accent text-accent py-3 rounded-xl font-semibold min-h-[48px] hover:bg-accent hover:text-white transition-all"
                  >
                    {lang === 'HI' ? 'मैं फिर कोशिश करूँगा' : "I'll try again"}
                  </button>
                </div>
              </div>
            )}

            {/* Always-visible close */}
            <button
              onClick={handleStruggleClose}
              className="w-full mt-3 text-muted text-sm py-2 min-h-[48px] hover:text-primary transition-colors"
            >
              {lang === 'HI' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
