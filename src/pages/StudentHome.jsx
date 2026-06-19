// src/pages/StudentHome.jsx
// Route: /home
// Daily landing screen - activities, streak, companion, breathing overlay.
// Emotionally safe: no scores, no SLD labels shown to the child.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calculator, Palette, Brain, Flame, Trophy, Heart,
  ArrowRight, Sparkles, Wind, Sun, Moon, CloudSun, LogOut,
} from 'lucide-react';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { STRINGS, READING_CONTENT, MATH_ACTIVITIES } from '../data';

// ─── BREATHING CYCLE CONFIG ───────────────────────────────────────────────────
// 3 phases × 3 cycles = ~30s total (4s + 2s + 4s per cycle)
const BREATH_PHASES = [
  { label: 'Breathe in...', labelHI: 'सांस लो...', duration: 4000 },
  { label: 'Hold...',       labelHI: 'रोको...',     duration: 2000 },
  { label: 'Breathe out...', labelHI: 'छोड़ो...',   duration: 4000 },
];

// ─── ACTIVITY CARD DATA BUILDER ───────────────────────────────────────────────
const buildActivities = (lang, S) => [
  {
    id: 'focus',
    icon: Brain,
    title: lang === 'HI' ? 'फोकस ज़ोन' : 'Focus Zone',
    subtitle: lang === 'HI' ? 'ध्यान और याददाश्त के खेल' : 'Attention & memory warm-up',
    duration: lang === 'HI' ? '~5 मिनट' : '~5 min',
    borderColor: 'border-calm',
    iconBg: 'bg-calm/10',
    iconColor: 'text-calm',
    route: '/focus-zone',
  },
  {
    id: 'reading',
    icon: BookOpen,
    title: S.readingRoom,
    subtitle: lang === 'HI'
      ? `"${READING_CONTENT[0]?.titleHI || 'चतुर कौआ'}"`
      : `"${READING_CONTENT[0]?.title || 'The Clever Crow'}"`,
    duration: lang === 'HI' ? '~10 मिनट' : '~10 min',
    borderColor: 'border-accent',
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    route: '/reading-room',
  },
  {
    id: 'numbers',
    icon: Calculator,
    title: S.numberWorld,
    subtitle: lang === 'HI'
      ? (MATH_ACTIVITIES[0]?.titleHI || 'सेब जोड़ो')
      : (MATH_ACTIVITIES[0]?.title || 'Adding Apples'),
    duration: lang === 'HI' ? '~8 मिनट' : '~8 min',
    borderColor: 'border-warm',
    iconBg: 'bg-warm/10',
    iconColor: 'text-warm',
    route: '/number-world',
  },
  {
    id: 'expression',
    icon: Palette,
    title: S.expressionStudio,
    subtitle: lang === 'HI' ? 'बोलो, बनाओ, या शब्द जोड़ो' : 'Speak, draw, or build words',
    duration: lang === 'HI' ? '~12 मिनट' : '~12 min',
    borderColor: 'border-success',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    route: '/expression-studio',
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const StudentHome = () => {
  const { appState, updateState, resetState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;

  // Local state
  const [showBreathingOverlay, setShowBreathingOverlay] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [breathCycles, setBreathCycles] = useState(0);
  const [showPostBreathPrompt, setShowPostBreathPrompt] = useState(false);
  const [companionState, setCompanionState] = useState('idle');

  // ─── TIME-AWARE GREETING ──────────────────────────────────────────────────
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return lang === 'HI' ? 'शुभ प्रभात' : 'Good morning';
    if (hour < 17) return lang === 'HI' ? 'नमस्ते' : 'Good afternoon';
    return lang === 'HI' ? 'शुभ संध्या' : 'Good evening';
  };

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) return <Sun className="w-6 h-6 text-warm" />;
    if (hour < 17) return <CloudSun className="w-6 h-6 text-warm" />;
    return <Moon className="w-6 h-6 text-accent" />;
  };

  const todayLabel = new Date().toLocaleDateString(
    lang === 'HI' ? 'hi-IN' : 'en-IN',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );

  // ─── BREATHING CYCLE LOGIC ────────────────────────────────────────────────
  useEffect(() => {
    if (!showBreathingOverlay) return;

    let timeout;
    const advance = (phaseIdx, cycleCount) => {
      const nextPhase = (phaseIdx + 1) % BREATH_PHASES.length;
      const nextCycles = nextPhase === 0 ? cycleCount + 1 : cycleCount;

      timeout = setTimeout(() => {
        if (nextCycles >= 3) {
          // 3 cycles complete - show post-breath prompt
          setShowPostBreathPrompt(true);
          return;
        }
        setBreathPhase(nextPhase);
        setBreathCycles(nextCycles);
        advance(nextPhase, nextCycles);
      }, BREATH_PHASES[phaseIdx].duration);
    };

    // Reset and start
    setBreathPhase(0);
    setBreathCycles(0);
    setShowPostBreathPrompt(false);
    advance(0, 0);

    return () => clearTimeout(timeout);
  }, [showBreathingOverlay]);

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const openBreathingOverlay = () => {
    setShowBreathingOverlay(true);
    setCompanionState('encouraging');
  };

  const closeBreathingOverlay = () => {
    setShowBreathingOverlay(false);
    setCompanionState('idle');
  };

  const handleActivityStart = (route) => {
    setCompanionState('happy');
    setTimeout(() => navigate(route), 200);
  };

  // Activity data
  const activities = buildActivities(lang, S);

  // Stagger class for entrance animation
  const staggerClasses = ['stagger-1', 'stagger-2', 'stagger-3'];

  return (
    <Layout
      title={S.appName}
      showBack={false}
      showCompanion
      pageContext="On the main home dashboard"
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      {/* ── Page wrapper ─────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 py-6 pb-28">

        {/* ── Greeting Section ───────────────────────────── */}
        <div className="mb-6 animate-fadeIn">
          <div className="flex items-center gap-3 mb-1">
            {getGreetingIcon()}
            <h1 className="text-2xl font-bold text-primary leading-tight">
              {getGreeting()}, {appState.studentName || 'Arjun'}
            </h1>
          </div>
          <p className="text-muted text-sm ml-9">{todayLabel}</p>

          {/* Motivational companion banner */}
          <div className="mt-4 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">
              {appState.companion?.emoji || '🦉'}
            </span>
            <div className="flex-1">
              <p className="text-primary font-medium text-base leading-snug">
                {lang === 'HI'
                  ? `${appState.companion?.nickname || 'Gyaan'} यहाँ है! आज भी हम साथ सीखेंगे`
                  : `${appState.companion?.nickname || 'Gyaan'} is here! Let's learn together today`}
              </p>
              <p className="text-muted text-sm mt-0.5">
                {lang === 'HI' ? 'आपके लिए अनुकूलित' : 'Adapted for you'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Today's Journey ────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-warm" />
            <h2 className="text-lg font-semibold text-primary">{S.todaysJourney}</h2>
          </div>

          <div className="space-y-3">
            {activities.map((act, idx) => {
              const IconComponent = act.icon;
              return (
                <div
                  key={act.id}
                  className={`card-elevated p-4 border-l-4 ${act.borderColor} animate-slideUp ${staggerClasses[idx]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Icon + text */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${act.iconBg}`}
                        aria-hidden="true"
                      >
                        <IconComponent className={`w-6 h-6 ${act.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-primary text-base leading-tight">
                          {act.title}
                        </h3>
                        <p className="text-muted text-sm mt-0.5 truncate">
                          {act.subtitle}
                        </p>
                        <span className="text-xs text-muted mt-1 inline-block">
                          {act.duration}
                        </span>
                      </div>
                    </div>

                    {/* Start button */}
                    <button
                      onClick={() => handleActivityStart(act.route)}
                      className="flex-shrink-0 bg-accent text-white px-4 py-2 rounded-xl min-h-[48px] font-semibold text-sm flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all duration-200"
                      aria-label={`Start ${act.title}`}
                    >
                      {lang === 'HI' ? 'शुरू' : 'Start'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Achievement teaser ─────────────────────────── */}
        <div className="animate-slideUp stagger-3">
          <button
            onClick={() => navigate('/achievements')}
            className="w-full bg-gradient-to-r from-success/10 to-accent/10 rounded-2xl p-4 flex items-center gap-3 border border-success/20 text-left hover:shadow-md transition-all duration-200"
            aria-label={lang === 'HI' ? 'उपलब्धि दीवार देखें' : 'View Achievement Wall'}
          >
            <Trophy className="w-8 h-8 text-success flex-shrink-0" />
            <div className="flex-1">
              <p className="text-primary font-semibold text-base">
                {lang === 'HI' ? 'आपकी उपलब्धियाँ देखें' : 'See your achievements'}
              </p>
              <p className="text-muted text-sm">
                {lang === 'HI' ? 'आपने इस हफ्ते 287 शब्द पढ़े!' : 'You read 287 words this week!'}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted flex-shrink-0" />
          </button>
        </div>

      </div>

      {/* ── Fixed Bottom Bar ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-gray-100 px-4 py-3 flex items-center justify-between z-30">

        {/* Streak display */}
        <div className="flex items-center gap-1.5 min-h-[48px]">
          <Flame className="w-5 h-5 text-warm" />
          <span className="text-sm font-semibold text-primary">
            {appState.streakDays > 0 ? appState.streakDays : 0}
            {lang === 'HI' ? ' दिन' : '-day'}
          </span>
          {lang !== 'HI' && <span className="text-muted text-xs">streak</span>}
        </div>

        {/* Achievement wall link */}
        <button
          onClick={() => navigate('/achievements')}
          className="flex items-center gap-1.5 min-h-[48px] px-3 text-accent font-semibold text-sm hover:bg-accent/10 rounded-xl transition-colors"
          aria-label="Achievement Wall"
        >
          <Trophy className="w-5 h-5" />
          <span className="hidden sm:inline">{S.achievementWall}</span>
        </button>

        {/* "I need help" button */}
        <button
          onClick={openBreathingOverlay}
          className="bg-warm text-white rounded-xl px-4 py-2 min-h-[48px] text-sm font-semibold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all duration-200"
          aria-label={S.iAmStruggling}
        >
          <Heart className="w-4 h-4" />
          <span>{S.iAmStruggling}</span>
        </button>

        {/* Logout / switch student */}
        <button
          onClick={() => { resetState(); navigate('/', { replace: true }); }}
          className="flex items-center gap-1.5 text-muted text-xs min-h-[48px] px-2 hover:text-red-500 transition-colors"
          aria-label={lang === 'HI' ? 'लॉगआउट' : 'Log out'}
          title={lang === 'HI' ? 'लॉगआउट / छात्र बदलें' : 'Log out / switch student'}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* ── Breathing Overlay ─────────────────────────────── */}
      {showBreathingOverlay && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'HI' ? 'साँस लेने का अभ्यास' : 'Breathing exercise'}
        >
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scaleIn">

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-primary mb-1">
                {S.breathe}
              </h2>
              <p className="text-muted text-base">
                {lang === 'HI'
                  ? 'यह बिल्कुल ठीक है। साथ में करते हैं।'
                  : "That's okay. Let's do this together."}
              </p>
            </div>

            {/* Breathing animation or post-breath prompt */}
            {!showPostBreathPrompt ? (
              <div className="flex flex-col items-center gap-4 my-4">
                {/* Animated breathing circle */}
                <div
                  className="w-28 h-28 rounded-full bg-gradient-to-br from-accent to-calm flex items-center justify-center shadow-lg animate-breathe"
                  role="img"
                  aria-label={BREATH_PHASES[breathPhase].label}
                >
                  <Wind className="w-10 h-10 text-white opacity-80" />
                </div>

                {/* Phase label */}
                <p className="text-primary font-semibold text-lg">
                  {lang === 'HI'
                    ? BREATH_PHASES[breathPhase].labelHI
                    : BREATH_PHASES[breathPhase].label}
                </p>

                {/* Remaining cycles */}
                <p className="text-muted text-sm">
                  {lang === 'HI'
                    ? `${3 - breathCycles} और चक्र`
                    : `${3 - breathCycles} more cycle${3 - breathCycles !== 1 ? 's' : ''}`}
                </p>
              </div>
            ) : (
              /* Post-breathing prompt with two options */
              <div className="my-4 animate-fadeIn">
                <div className="flex items-center justify-center gap-2 mb-5">
                  <Sparkles className="w-5 h-5 text-warm" />
                  <p className="text-primary font-semibold text-base">
                    {S.tryEasier}
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      closeBreathingOverlay();
                      navigate('/reading-room?easy=true');
                    }}
                    className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] hover:shadow-md transition-all duration-200"
                    aria-label={lang === 'HI' ? 'कुछ आसान करें' : 'Something easier'}
                  >
                    {lang === 'HI' ? 'हाँ, कुछ आसान करें' : 'Something easier'}
                  </button>
                  <button
                    onClick={closeBreathingOverlay}
                    className="w-full border-2 border-accent text-accent py-3 rounded-xl font-semibold min-h-[48px] hover:bg-accent hover:text-white transition-all duration-200"
                    aria-label={lang === 'HI' ? 'फिर कोशिश करूँगा' : "I'll try again"}
                  >
                    {lang === 'HI' ? 'मैं फिर कोशिश करूँगा' : "I'll try again"}
                  </button>
                </div>
              </div>
            )}

            {/* Always-visible close */}
            <button
              onClick={closeBreathingOverlay}
              className="w-full mt-3 text-muted text-sm py-2 min-h-[48px] hover:text-primary transition-colors"
              aria-label={lang === 'HI' ? 'बंद करें' : 'Close'}
            >
              {lang === 'HI' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default StudentHome;
