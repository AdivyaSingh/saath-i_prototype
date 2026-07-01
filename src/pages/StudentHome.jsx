// src/pages/StudentHome.jsx
// Route: /home
// Daily landing screen — activities, streak, companion, breathing overlay.
// Emotionally safe: no scores, no SLD labels shown to the child.
//
// New features (v2):
//   • Activity priority ordering  — derived from the child's support profile;
//     activities most relevant to their needs appear first with a priority badge
//     and personalised duration. Falls back to default order if not yet screened.
//   • My Learning Plan card       — shown once the student has been screened.
//     Opens a modal with a 5-day AI schedule, per-activity tips, and a
//     Regenerate button.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calculator, Palette, Brain, Flame, Trophy, Heart,
  ArrowRight, Sparkles, Wind, Sun, Moon, CloudSun, LogOut, HelpCircle,
  Map, X, RefreshCw, Loader2, Star, CalendarDays, CheckCircle2,
} from 'lucide-react';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { STRINGS, READING_CONTENT, MATH_ACTIVITIES } from '../data';
import WalkthroughOverlay from '../components/WalkthroughOverlay';
import { generateInterventionPlan } from '../gemini';
import { updateStudentProgress } from '../firebase';

// localStorage key — set to 'done' once the student completes/skips the tour
const STUDENT_TOUR_KEY = 'saathi_student_tour_done';

// ─── BREATHING CYCLE CONFIG ───────────────────────────────────────────────────
const BREATH_PHASES = [
  { label: 'Breathe in...', labelHI: 'सांस लो...', duration: 4000 },
  { label: 'Hold...',       labelHI: 'रोको...',     duration: 2000 },
  { label: 'Breathe out...', labelHI: 'छोड़ो...',   duration: 4000 },
];

// ─── ACTIVITY METADATA (icons, routes, support-area mapping) ─────────────────
// supportAreas: which supportProfile keys each activity most directly helps.
// Used to compute personalised priority from the child's screening results.
const ACTIVITY_META = [
  {
    id: 'focus',
    icon: Brain,
    titleEN: 'Focus Zone',
    titleHI: 'फोकस ज़ोन',
    subtitleEN: 'Attention & memory warm-up',
    subtitleHI: 'ध्यान और याददाश्त के खेल',
    defaultDurationEN: '~5 min',
    defaultDurationHI: '~5 मिनट',
    borderColor: 'border-calm',
    iconBg: 'bg-calm/10',
    iconColor: 'text-calm',
    route: '/focus-zone',
    supportAreas: ['attention', 'memory'],
  },
  {
    id: 'reading',
    icon: BookOpen,
    titleEN: 'Reading Room',
    titleHI: 'पढ़ाई का कमरा',
    subtitleEN: null, // filled dynamically from READING_CONTENT
    subtitleHI: null,
    defaultDurationEN: '~10 min',
    defaultDurationHI: '~10 मिनट',
    borderColor: 'border-accent',
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    route: '/reading-room',
    supportAreas: ['reading'],
  },
  {
    id: 'numbers',
    icon: Calculator,
    titleEN: 'Number World',
    titleHI: 'संख्या की दुनिया',
    subtitleEN: null, // filled from MATH_ACTIVITIES
    subtitleHI: null,
    defaultDurationEN: '~8 min',
    defaultDurationHI: '~8 मिनट',
    borderColor: 'border-warm',
    iconBg: 'bg-warm/10',
    iconColor: 'text-warm',
    route: '/number-world',
    supportAreas: ['numeracy'],
  },
  {
    id: 'catchup',
    icon: Sparkles,
    titleEN: 'Catch-Up Courses',
    titleHI: 'कैच-अप कोर्स',
    subtitleEN: 'Build your skills, step by step',
    subtitleHI: 'अपनी गति से सीखो, कदम दर कदम',
    defaultDurationEN: '~10 min',
    defaultDurationHI: '~10 मिनट',
    borderColor: 'border-accent',
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    route: '/catch-up',
    supportAreas: ['writing', 'organisation', 'memory', 'reading', 'numeracy'],
  },
];

// Level weights for computing activity priority score from supportProfile
const LEVEL_WEIGHT = { high: 3, some: 2, low: 0 };

/**
 * Returns a sorted list of activity objects with added priority fields.
 * If no supportProfile is available, preserves the original default order.
 * Also returns the total minutes from the AI plan (or derives from profile).
 */
function buildPrioritisedActivities(lang, supportProfile, interventionPlan, S) {
  // Build a score for each activity based on how much support the child needs
  // in the areas that activity covers.
  const scored = ACTIVITY_META.map(meta => {
    let score = 0;
    if (supportProfile && typeof supportProfile === 'object') {
      meta.supportAreas.forEach(area => {
        score += LEVEL_WEIGHT[supportProfile[area]] ?? 0;
      });
    }

    // Look up AI-recommended duration for this activity
    let recommendedMinutes = null;
    if (interventionPlan?.activities) {
      const found = interventionPlan.activities.find(a => a.activityId === meta.id);
      if (found) recommendedMinutes = found.recommendedMinutes;
    }

    // Dynamic subtitles
    const subtitleEN = meta.id === 'reading'
      ? `"${READING_CONTENT[0]?.title || 'The Clever Crow'}"`
      : meta.id === 'numbers'
      ? (MATH_ACTIVITIES[0]?.title || 'Adding Apples')
      : meta.subtitleEN;
    const subtitleHI = meta.id === 'reading'
      ? `"${READING_CONTENT[0]?.titleHI || 'चतुर कौआ'}"`
      : meta.id === 'numbers'
      ? (MATH_ACTIVITIES[0]?.titleHI || 'सेब जोड़ो')
      : meta.subtitleHI;

    // Duration to display: AI-recommended if available, else default
    const durationEN = recommendedMinutes ? `~${recommendedMinutes} min` : meta.defaultDurationEN;
    const durationHI = recommendedMinutes ? `~${recommendedMinutes} मिनट` : meta.defaultDurationHI;

    return {
      ...meta,
      score,
      recommendedMinutes,
      title:    lang === 'HI' ? meta.titleHI    : meta.titleEN,
      subtitle: lang === 'HI' ? subtitleHI      : subtitleEN,
      duration: lang === 'HI' ? durationHI      : durationEN,
    };
  });

  // Only sort if we have screening data; otherwise keep default order
  if (supportProfile) {
    scored.sort((a, b) => b.score - a.score);
  }

  // Assign display priority rank (1 = most important)
  return scored.map((act, i) => ({ ...act, rank: i + 1 }));
}

// Priority badge config
const PRIORITY_BADGE = {
  1: { textEN: 'Start here', textHI: 'यहाँ से शुरू करें', cls: 'bg-warm text-white',    dot: 'bg-warm' },
  2: { textEN: 'Important',  textHI: 'ज़रूरी',             cls: 'bg-accent text-white',  dot: 'bg-accent' },
  3: { textEN: 'Recommended',textHI: 'सुझाया गया',         cls: 'bg-calm/80 text-white', dot: 'bg-calm' },
  4: { textEN: null,         textHI: null,                 cls: '',                       dot: 'bg-gray-300' },
};

// Map activityId → icon component (for plan modal)
const ACTIVITY_ICON = {
  focus:   Brain,
  reading: BookOpen,
  numbers: Calculator,
  catchup: Sparkles,
};
const ACTIVITY_LABEL_EN = { focus: 'Focus Zone', reading: 'Reading Room', numbers: 'Number World', catchup: 'Catch-Up Courses' };
const ACTIVITY_LABEL_HI = { focus: 'फोकस ज़ोन', reading: 'पढ़ाई का कमरा', numbers: 'संख्या की दुनिया', catchup: 'कैच-अप कोर्स' };
const ACTIVITY_COLOR   = { focus: 'text-calm', reading: 'text-accent', numbers: 'text-warm', catchup: 'text-accent' };
const ACTIVITY_BG      = { focus: 'bg-calm/10', reading: 'bg-accent/10', numbers: 'bg-warm/10', catchup: 'bg-accent/10' };

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const StudentHome = () => {
  const { appState, updateState, resetState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const S    = STRINGS[lang] || STRINGS.EN;

  // Screening profile (set by Screening.jsx finalize → updateState)
  const supportProfile    = appState.supportProfile    || null;
  const primarySupportArea= appState.primarySupportArea|| null;
  const tier              = appState.tier              || null;
  const isScreened        = !!supportProfile;

  // AI plan from appState (persisted by Screening.jsx after generation)
  const [plan, setPlan]               = useState(appState.interventionPlan || null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  // Keep plan in sync if appState changes (e.g. background generation completes)
  useEffect(() => {
    if (appState.interventionPlan && !plan) {
      setPlan(appState.interventionPlan);
    }
  }, [appState.interventionPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prioritised activity list (memoised inline)
  const activities = buildPrioritisedActivities(lang, supportProfile, plan, S);

  // ─── REGENERATE PLAN ────────────────────────────────────────────────────────
  const regeneratePlan = useCallback(async () => {
    if (planLoading || !isScreened) return;
    setPlanLoading(true);
    const newPlan = await generateInterventionPlan({
      name:               appState.studentName  || 'Student',
      class:              appState.studentClass  || 4,
      language:           lang,
      supportProfile,
      primarySupportArea,
      tier,
    });
    setPlanLoading(false);
    if (!newPlan) return;
    setPlan(newPlan);
    updateState({ interventionPlan: newPlan });
    const sid = appState.studentId || appState.firebaseStudentId;
    if (sid) updateStudentProgress(sid, { interventionPlan: newPlan }).catch(() => {});
  }, [planLoading, isScreened, lang, supportProfile, primarySupportArea, tier, appState]);

  // ─── WALKTHROUGH STATE ────────────────────────────────────────────────────
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(STUDENT_TOUR_KEY)) {
      const t = setTimeout(() => setShowWalkthrough(true), 600);
      return () => clearTimeout(t);
    }
  }, []);
  const handleWalkthroughComplete = () => {
    localStorage.setItem(STUDENT_TOUR_KEY, 'done');
    setShowWalkthrough(false);
  };

  // ─── LOCAL STATE ──────────────────────────────────────────────────────────
  const [showBreathingOverlay, setShowBreathingOverlay] = useState(false);
  const [breathPhase, setBreathPhase]     = useState(0);
  const [breathCycles, setBreathCycles]   = useState(0);
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
      const nextPhase  = (phaseIdx + 1) % BREATH_PHASES.length;
      const nextCycles = nextPhase === 0 ? cycleCount + 1 : cycleCount;
      timeout = setTimeout(() => {
        if (nextCycles >= 3) { setShowPostBreathPrompt(true); return; }
        setBreathPhase(nextPhase);
        setBreathCycles(nextCycles);
        advance(nextPhase, nextCycles);
      }, BREATH_PHASES[phaseIdx].duration);
    };
    setBreathPhase(0); setBreathCycles(0); setShowPostBreathPrompt(false);
    advance(0, 0);
    return () => clearTimeout(timeout);
  }, [showBreathingOverlay]);

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const openBreathingOverlay = () => { setShowBreathingOverlay(true); setCompanionState('encouraging'); };
  const closeBreathingOverlay = () => { setShowBreathingOverlay(false); setCompanionState('idle'); };
  const handleActivityStart = (route) => { setCompanionState('happy'); setTimeout(() => navigate(route), 200); };

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
        <div className="mb-5 animate-fadeIn">
          <div className="flex items-center gap-3 mb-1">
            {getGreetingIcon()}
            <h1 className="text-2xl font-bold text-primary leading-tight">
              {getGreeting()}, {appState.studentName || 'Arjun'}
            </h1>
          </div>
          <p className="text-muted text-sm ml-9">{todayLabel}</p>

          {/* Companion banner */}
          <div id="walkthrough-companion-banner" className="mt-4 bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-3xl" aria-hidden="true">{appState.companion?.emoji || '🦉'}</span>
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

        {/* ── My Learning Plan card (only shown post-screening) ─────── */}
        {isScreened && (
          <div className="mb-5 animate-fadeIn">
            <button
              onClick={() => setShowPlanModal(true)}
              className="w-full bg-gradient-to-r from-warm/10 via-accent/10 to-calm/10 border border-warm/20 rounded-2xl p-4 flex items-center gap-3 text-left hover:shadow-md transition-all duration-200 group"
              aria-label={lang === 'HI' ? 'मेरी लर्निंग प्लान देखें' : 'View My Learning Plan'}
            >
              <div className="w-11 h-11 rounded-xl bg-warm/15 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Map className="w-6 h-6 text-warm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-base">
                  {lang === 'HI' ? 'मेरी लर्निंग प्लान' : 'My Learning Plan'}
                </p>
                <p className="text-muted text-sm mt-0.5">
                  {plan
                    ? (lang === 'HI' ? 'आपका 5-दिन का व्यक्तिगत शेड्यूल तैयार है' : 'Your personalised 5-day schedule is ready')
                    : (lang === 'HI' ? 'आपकी योजना तैयार हो रही है…' : 'Your plan is being prepared…')}
                </p>
              </div>
              <div className="flex-shrink-0">
                {plan
                  ? <ArrowRight className="w-5 h-5 text-warm group-hover:translate-x-0.5 transition-transform" />
                  : <Loader2 className="w-5 h-5 text-muted animate-spin" />}
              </div>
            </button>
          </div>
        )}

        {/* ── Today's Journey ────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-warm" />
            <h2 className="text-lg font-semibold text-primary">{S.todaysJourney}</h2>
          </div>

          {/* Priority legend — only shown if screened */}
          {isScreened && (
            <p className="text-xs text-muted mb-3 ml-7">
              {lang === 'HI'
                ? 'आपके लिए सबसे ज़रूरी गतिविधि सबसे पहले है'
                : 'Most important activity for you is shown first'}
            </p>
          )}

          <div className="space-y-3">
            {activities.map((act) => {
              const IconComponent = act.icon;
              const badge = PRIORITY_BADGE[act.rank] || PRIORITY_BADGE[4];
              const showBadge = isScreened && act.rank <= 3;

              // Map id → walkthrough spotlight id
              const walkthroughId = {
                focus:   'walkthrough-focus-zone',
                reading: 'walkthrough-reading-room',
                numbers: 'walkthrough-number-world',
                catchup: 'walkthrough-catchup',
              }[act.id];

              return (
                <div
                  key={act.id}
                  id={walkthroughId}
                  className={`card-elevated p-4 border-l-4 ${act.borderColor} animate-slideUp relative`}
                >
                  {/* Priority badge */}
                  {showBadge && (
                    <span className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {act.rank === 1 && <Star className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />}
                      {lang === 'HI' ? badge.textHI : badge.textEN}
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    {/* Icon + text */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${act.iconBg} relative`}>
                        <IconComponent className={`w-6 h-6 ${act.iconColor}`} />
                        {/* Priority dot for rank 1 */}
                        {isScreened && act.rank === 1 && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-warm rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="min-w-0 pr-2">
                        <h3 className="font-semibold text-primary text-base leading-tight">
                          {act.title}
                        </h3>
                        <p className="text-muted text-sm mt-0.5 truncate">{act.subtitle}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium ${isScreened && act.rank === 1 ? 'text-warm' : 'text-muted'}`}>
                            {act.duration}
                          </span>
                          {isScreened && act.rank === 1 && (
                            <span className="text-xs text-warm font-semibold">
                              · {lang === 'HI' ? 'आज यही करो!' : 'Do this today!'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Start button */}
                    <button
                      onClick={() => handleActivityStart(act.route)}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl min-h-[48px] font-semibold text-sm flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all duration-200 ${
                        isScreened && act.rank === 1
                          ? 'bg-warm text-white hover:bg-orange-600'
                          : 'bg-accent text-white hover:bg-blue-600'
                      }`}
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
        <div id="walkthrough-achievements" className="animate-slideUp stagger-3">
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
          id="walkthrough-help-button"
          onClick={openBreathingOverlay}
          className="bg-warm text-white rounded-xl px-4 py-2 min-h-[48px] text-sm font-semibold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all duration-200"
          aria-label={S.iAmStruggling}
        >
          <Heart className="w-4 h-4" />
          <span>{S.iAmStruggling}</span>
        </button>

        {/* Take a Tour button */}
        <button
          onClick={() => setShowWalkthrough(true)}
          className="flex items-center gap-1.5 text-muted text-xs min-h-[48px] px-2 hover:text-accent transition-colors"
          aria-label={lang === 'HI' ? 'दौरा करें' : 'Take a Tour'}
          title={lang === 'HI' ? 'ऐप का दौरा करें' : 'Take a tour of the app'}
        >
          <HelpCircle className="w-4 h-4" />
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

      {/* ── My Learning Plan Modal ────────────────────────── */}
      {showPlanModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:px-4 animate-fadeIn"
          onClick={() => setShowPlanModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'HI' ? 'मेरी लर्निंग प्लान' : 'My Learning Plan'}
        >
          <div
            className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-warm" />
                <h2 className="text-lg font-bold text-primary">
                  {lang === 'HI' ? 'मेरी लर्निंग प्लान' : 'My Learning Plan'}
                </h2>
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

              {!plan ? (
                /* Loading / not yet generated state */
                <div className="text-center py-10">
                  <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-3" />
                  <p className="text-primary font-semibold">
                    {lang === 'HI' ? 'आपकी योजना तैयार हो रही है…' : 'Preparing your plan…'}
                  </p>
                  <p className="text-muted text-sm mt-1">
                    {lang === 'HI' ? 'बस कुछ सेकंड और!' : 'Just a few seconds!'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Overall goal */}
                  {plan.overallGoal && (
                    <div className="bg-gradient-to-r from-warm/10 to-accent/10 rounded-2xl p-4">
                      <div className="flex items-start gap-2.5">
                        <Sparkles className="w-5 h-5 text-warm flex-shrink-0 mt-0.5" />
                        <p className="text-primary font-medium text-sm leading-relaxed">{plan.overallGoal}</p>
                      </div>
                    </div>
                  )}

                  {/* Activity priority list */}
                  <div>
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-warm" />
                      {lang === 'HI' ? 'आपके लिए प्राथमिकता' : 'Your Priority Order'}
                    </h3>
                    <div className="space-y-2">
                      {(plan.activities || [])
                        .sort((a, b) => a.priority - b.priority)
                        .map((act, i) => {
                          const Icon = ACTIVITY_ICON[act.activityId] || Sparkles;
                          return (
                            <div key={act.activityId} className="flex items-start gap-3 bg-surface rounded-xl p-3">
                              <div className="flex-shrink-0 flex items-center gap-2 w-6">
                                <span className={`text-sm font-bold ${i === 0 ? 'text-warm' : 'text-muted'}`}>{act.priority}</span>
                              </div>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ACTIVITY_BG[act.activityId]}`}>
                                <Icon className={`w-4 h-4 ${ACTIVITY_COLOR[act.activityId]}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-primary text-sm">{act.activityName}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${i === 0 ? 'bg-warm/15 text-warm' : 'bg-surface text-muted border border-gray-200'}`}>
                                    {act.recommendedMinutes} {lang === 'HI' ? 'मिनट' : 'min'}
                                  </span>
                                </div>
                                {act.whyKid && (
                                  <p className="text-xs text-muted mt-0.5 leading-snug">{act.whyKid}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* 5-day weekly schedule */}
                  <div>
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-accent" />
                      {lang === 'HI' ? 'इस सप्ताह का शेड्यूल' : 'This Week\'s Schedule'}
                    </h3>
                    <div className="space-y-2">
                      {(plan.weeklyPlan || []).map((day, di) => (
                        <div key={di} className="bg-surface rounded-xl px-3 py-2.5 flex items-center gap-3">
                          <span className="text-sm font-semibold text-primary w-24 flex-shrink-0">{day.day}</span>
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            {(day.activities || []).map((a, ai) => {
                              const Icon = ACTIVITY_ICON[a.id] || Sparkles;
                              const label = lang === 'HI' ? ACTIVITY_LABEL_HI[a.id] : ACTIVITY_LABEL_EN[a.id];
                              return (
                                <span key={ai} className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${ACTIVITY_BG[a.id]} ${ACTIVITY_COLOR[a.id]}`}>
                                  <Icon className="w-3 h-3" />
                                  {label} · {a.minutes}{lang === 'HI' ? 'मि' : 'm'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tip */}
                  {plan.tip && (
                    <div className="bg-calm/5 border border-calm/20 rounded-2xl p-4 flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-calm flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-primary leading-relaxed">{plan.tip}</p>
                    </div>
                  )}

                  {/* Generated date */}
                  {plan.generatedAt && (
                    <p className="text-xs text-muted text-center">
                      {lang === 'HI' ? `${plan.generatedAt} को बनाया गया` : `Generated on ${plan.generatedAt}`}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Modal footer — Regenerate button */}
            <div className="px-5 pb-5 pt-3 flex-shrink-0 border-t border-gray-100">
              <button
                onClick={regeneratePlan}
                disabled={planLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-accent text-accent font-semibold text-sm min-h-[48px] hover:bg-accent hover:text-white transition-all duration-200 disabled:opacity-40"
                aria-label={lang === 'HI' ? 'नई योजना बनाएं' : 'Regenerate Plan'}
              >
                {planLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{lang === 'HI' ? 'तैयार हो रहा है…' : 'Generating…'}</>
                  : <><RefreshCw className="w-4 h-4" />{lang === 'HI' ? 'नई योजना बनाएं' : 'Regenerate Plan'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Breathing Overlay ─────────────────────────────── */}
      {showBreathingOverlay && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label={lang === 'HI' ? 'साँस लेने का अभ्यास' : 'Breathing exercise'}
        >
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scaleIn">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-primary mb-1">{S.breathe}</h2>
              <p className="text-muted text-base">
                {lang === 'HI' ? 'यह बिल्कुल ठीक है। साथ में करते हैं।' : "That's okay. Let's do this together."}
              </p>
            </div>

            {!showPostBreathPrompt ? (
              <div className="flex flex-col items-center gap-4 my-4">
                <div
                  className="w-28 h-28 rounded-full bg-gradient-to-br from-accent to-calm flex items-center justify-center shadow-lg animate-breathe"
                  role="img"
                  aria-label={BREATH_PHASES[breathPhase].label}
                >
                  <Wind className="w-10 h-10 text-white opacity-80" />
                </div>
                <p className="text-primary font-semibold text-lg">
                  {lang === 'HI' ? BREATH_PHASES[breathPhase].labelHI : BREATH_PHASES[breathPhase].label}
                </p>
                <p className="text-muted text-sm">
                  {lang === 'HI'
                    ? `${3 - breathCycles} और चक्र`
                    : `${3 - breathCycles} more cycle${3 - breathCycles !== 1 ? 's' : ''}`}
                </p>
              </div>
            ) : (
              <div className="my-4 animate-fadeIn">
                <div className="flex items-center justify-center gap-2 mb-5">
                  <Sparkles className="w-5 h-5 text-warm" />
                  <p className="text-primary font-semibold text-base">{S.tryEasier}</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => { closeBreathingOverlay(); navigate('/reading-room?easy=true'); }}
                    className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] hover:shadow-md transition-all duration-200"
                  >
                    {lang === 'HI' ? 'हाँ, कुछ आसान करें' : 'Something easier'}
                  </button>
                  <button
                    onClick={closeBreathingOverlay}
                    className="w-full border-2 border-accent text-accent py-3 rounded-xl font-semibold min-h-[48px] hover:bg-accent hover:text-white transition-all duration-200"
                  >
                    {lang === 'HI' ? 'मैं फिर कोशिश करूँगा' : "I'll try again"}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={closeBreathingOverlay}
              className="w-full mt-3 text-muted text-sm py-2 min-h-[48px] hover:text-primary transition-colors"
            >
              {lang === 'HI' ? 'बंद करें' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* ── Student Walkthrough ───────────────────────────── */}
      {showWalkthrough && (
        <WalkthroughOverlay
          mode="student"
          lang={lang}
          onComplete={handleWalkthroughComplete}
        />
      )}
    </Layout>
  );
};

export default StudentHome;
