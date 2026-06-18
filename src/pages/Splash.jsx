// src/pages/Splash.jsx
// Route: /
// Premium landing page - first impression for judges and users.
// Clean design with gradient background, staggered animations, and no emojis.

import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { STRINGS } from '../data';
import Layout from '../components/Layout';
import {
  Globe,
  WifiOff,
  Brain,
  GraduationCap,
  Sparkles,
  ArrowRight,
  KeyRound,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ─── Footer badge data (icon + label) ─────────────────────────────────────────
const FOOTER_BADGES = (lang) => [
  {
    Icon: Globe,
    label: lang === 'HI' ? '8 भारतीय भाषाएँ' : '8 Indian languages',
  },
  {
    Icon: WifiOff,
    label: lang === 'HI' ? 'ऑफलाइन-फर्स्ट' : 'Offline-first',
  },
  {
    Icon: Brain,
    label: lang === 'HI' ? 'AI-संचालित' : 'AI-powered',
  },
  {
    Icon: GraduationCap,
    label: lang === 'HI' ? 'NEP 2020 अनुरूप' : 'NEP 2020 aligned',
  },
];

const Splash = () => {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  const badges = FOOTER_BADGES(lang);

  return (
    <Layout
      title=""
      showBack={false}
      showNav={false}
      showCompanion={false}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      {/* Full-viewport gradient background */}
      <div className="bg-gradient-to-b from-surface via-blue-50 to-surface min-h-screen">
        <div
          className="max-w-md mx-auto px-6 flex flex-col items-center justify-between py-10"
          style={{ minHeight: '100vh' }}
        >
          {/* ── Section 1: App Identity ── */}
          <div className="w-full text-center mt-8 animate-fadeIn">
            <h1 className="text-6xl font-bold gradient-text tracking-tight leading-none select-none">
              Saath-i
            </h1>
            <p className="text-2xl text-muted font-medium mt-1.5 tracking-wide select-none">
              साथी
            </p>
            <p className="text-lg text-muted mt-4 leading-relaxed max-w-xs mx-auto">
              {S.tagline}
            </p>
          </div>

          {/* ── Section 2: Companion Owl + Impact Stat ── */}
          <div className="flex flex-col items-center gap-5 my-8 animate-slideUp stagger-2">
            {/* Owl in a styled companion-container */}
            <div
              className="companion-container w-28 h-28 text-5xl animate-float"
              aria-label="Gyaan the Owl - your learning companion"
            >
              🦉
            </div>

            {/* Companion badge label */}
            <span className="text-sm font-semibold text-muted bg-card px-4 py-1.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-1.5">
              <Sparkles size={14} className="text-warm" />
              {lang === 'HI' ? 'ज्ञान आपका साथी है' : 'Meet Gyaan, your companion'}
            </span>

            {/* Impact stat card */}
            <div className="glass-card rounded-2xl px-5 py-4 text-center max-w-xs">
              <p className="text-sm text-muted leading-relaxed">
                {lang === 'HI'
                  ? 'भारत के 2.5 करोड़ बच्चों को सीखने में विशेष मदद की ज़रूरत है। साथी उनके लिए है।'
                  : 'Supporting 2.5 crore children with learning disabilities in India.'}
              </p>
            </div>
          </div>

          {/* ── Section 3: CTA Buttons ── */}
          <div className="w-full space-y-3 animate-slideUp stagger-3">
            <button
              onClick={() => navigate('/onboarding?mode=new')}
              className="btn-primary w-full text-lg"
              aria-label={S.startExploring}
            >
              {S.startExploring}
              <ArrowRight size={20} />
            </button>

            <button
              onClick={() => navigate('/onboarding?mode=returning')}
              className="btn-ghost w-full text-lg"
              aria-label={S.haveClassCode}
            >
              <KeyRound size={18} />
              {S.haveClassCode}
            </button>
          </div>

          {/* ── Section 4: Footer Badges ── */}
          <div className="w-full mt-8 pb-16 animate-fadeIn stagger-4">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {badges.map(({ Icon, label }, i) => (
                <span
                  key={i}
                  className="text-xs text-muted bg-card px-3 py-1.5 rounded-full border border-gray-100 shadow-sm flex items-center gap-1.5"
                >
                  <Icon size={12} className="text-accent opacity-80" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Demo Mode Toggle (bottom-left pill) ── */}
          <div className="fixed bottom-5 left-4 z-50 animate-fadeIn stagger-5">
            <button
              onClick={() => updateState({ isDemoMode: !appState.isDemoMode })}
              className="flex items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-gray-200 text-xs font-medium text-muted px-3 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all duration-200"
              aria-label={`${S.demoModeLabel}: ${appState.isDemoMode ? 'On' : 'Off'}`}
            >
              {appState.isDemoMode ? (
                <ToggleRight size={14} className="text-success" />
              ) : (
                <ToggleLeft size={14} className="text-muted" />
              )}
              <span>{S.demoModeLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Splash;