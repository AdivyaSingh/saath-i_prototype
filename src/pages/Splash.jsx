// src/pages/Splash.jsx
// Route: /
// Module 1 will build this page fully.
// Placeholder: unblocks routing.

// src/pages/Splash.jsx
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { STRINGS } from '../data';
import Layout from '../components/Layout';

export default function Splash() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  return (
    <Layout
      title=""
      showBack={false}
      showCompanion
      companionState="idle"
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      {/* Full-viewport gradient fill */}
      <div className="bg-gradient-to-b from-surface to-blue-50 min-h-screen">
        <div className="max-w-md mx-auto px-6 flex flex-col items-center justify-between py-8"
          style={{ minHeight: 'calc(100vh - 40px)' }}>

          {/* ── App identity ── */}
          <div className="w-full text-center mt-4">
            <h1 className="text-6xl font-bold text-primary tracking-tight leading-none">
              {lang === 'HI' ? 'साथी' : 'Saath-i'}
            </h1>
            {lang === 'EN' && (
              <p className="text-2xl text-muted font-medium mt-1 tracking-wide">साथी</p>
            )}
            <p className="text-lg text-muted mt-3 leading-relaxed max-w-xs mx-auto">
              {S.tagline}
            </p>
          </div>

          {/* ── Hero owl ── */}
          <div className="flex flex-col items-center gap-3 my-6">
            <div
              className="w-32 h-32 bg-warm rounded-full flex items-center justify-center shadow-lg"
              style={{ fontSize: '4rem' }}
              aria-label="Gyaan the Owl — your learning companion"
            >
              🦉
            </div>
            <span className="text-sm font-semibold text-muted bg-card px-4 py-1.5 rounded-full shadow-sm border border-gray-100">
              {lang === 'HI' ? 'ज्ञान आपका साथी है 👋' : 'Meet Gyaan, your buddy 👋'}
            </span>

            {/* SLD stat — gives judges immediate context */}
            <div className="mt-3 bg-card border border-gray-100 rounded-2xl px-5 py-3 shadow-sm text-center max-w-xs">
              <p className="text-xs text-muted leading-relaxed">
                {lang === 'HI'
                  ? '🇮🇳 भारत के 5.2 करोड़ बच्चों को सीखने में विशेष मदद की ज़रूरत है। साथी उनके लिए है।'
                  : '🇮🇳 52 million Indian children have unaddressed learning differences. Saath-i is built for them.'}
              </p>
            </div>
          </div>

          {/* ── CTA buttons ── */}
          <div className="w-full space-y-3">
            <button
              onClick={() => navigate('/onboarding?mode=new')}
              className="bg-warm text-white font-semibold py-3.5 px-6 rounded-xl min-h-[52px] hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-sm w-full text-lg focus:outline-none focus:ring-2 focus:ring-warm focus:ring-offset-2"
              aria-label={S.startExploring}
            >
              {S.startExploring} ✨
            </button>

            <button
              onClick={() => navigate('/onboarding?mode=returning')}
              className="border-2 border-accent text-accent font-semibold py-3.5 px-6 rounded-xl min-h-[52px] hover:bg-accent hover:text-white active:bg-blue-700 transition-all w-full text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              aria-label={S.haveClassCode}
            >
              {S.haveClassCode}
            </button>
          </div>

          {/* ── Footer badges ── */}
          <div className="text-center pb-20 mt-5">
            <p className="text-sm text-muted font-medium">
              {lang === 'HI' ? '8 भारतीय भाषाओं में उपलब्ध 🇮🇳' : 'Available in 8 Indian languages 🇮🇳'}
            </p>
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-muted bg-card px-2.5 py-1 rounded-full border border-gray-100 shadow-sm">
                {lang === 'HI' ? '📶 ऑफलाइन-फर्स्ट' : '📶 Offline-first'}
              </span>
              <span className="text-xs text-muted bg-card px-2.5 py-1 rounded-full border border-gray-100 shadow-sm">
                {lang === 'HI' ? '📋 NEP 2020 अनुरूप' : '📋 NEP 2020 aligned'}
              </span>
              <span className="text-xs text-muted bg-card px-2.5 py-1 rounded-full border border-gray-100 shadow-sm">
                {lang === 'HI' ? '🤖 AI-संचालित' : '🤖 AI-powered'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}