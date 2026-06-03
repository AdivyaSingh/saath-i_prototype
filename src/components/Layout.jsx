// src/components/Layout.jsx
// Shared shell component — wraps every page.
// Includes: offline banner, top nav bar, language toggle, companion widget.

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff, Flame, Globe } from 'lucide-react';

/**
 * Layout props:
 *   children       — page content
 *   title          — page title shown in nav bar
 *   showBack       — show back arrow in nav (default: false)
 *   showNav        — show top nav bar (default: true; pass false for Splash)
 *   showCompanion  — show companion floating widget (student pages only)
 *   companionState — 'idle' | 'happy' | 'encouraging'
 *   isTeacherPage  — true for teacher pages (hides companion, adjusts max-width)
 *   lang           — 'EN' | 'HI' (from appState.language)
 *   setLanguage    — function to toggle language (wraps updateState)
 *   companion      — { emoji, nickname } from appState.companion
 *   streak         — streakDays from appState (shown on student pages)
 */
export default function Layout({
  children,
  title = '',
  showBack = false,
  showNav = true,
  showCompanion = false,
  companionState = 'idle',
  isTeacherPage = false,
  lang = 'EN',
  setLanguage,
  companion,
  streak,
}) {
  const navigate = useNavigate();

  // ─── OFFLINE BANNER ──────────────────────────────────────────────────────────
  const OfflineBanner = () => (
    <div className="bg-primary/95 backdrop-blur-sm text-white text-xs text-center py-1.5 px-4 flex items-center justify-center gap-2">
      <WifiOff size={12} className="opacity-80" />
      <span className="opacity-90">
        {lang === 'HI'
          ? 'ऑफलाइन मोड — कनेक्ट होने पर डेटा सिंक होगा'
          : 'Offline mode — data will sync when connected'}
      </span>
    </div>
  );

  // ─── LANGUAGE TOGGLE ─────────────────────────────────────────────────────────
  const LanguageToggle = () => (
    <button
      onClick={() => setLanguage && setLanguage(lang === 'EN' ? 'HI' : 'EN')}
      aria-label="Toggle language"
      className="flex items-center gap-1.5 bg-white border border-gray-200 text-primary font-semibold text-sm px-3 py-2 rounded-lg min-h-[40px] hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
    >
      <Globe size={14} className="text-muted" />
      <span>{lang === 'EN' ? 'हिंदी' : 'EN'}</span>
    </button>
  );

  // ─── TOP NAV BAR ─────────────────────────────────────────────────────────────
  const NavBar = () => (
    <div className="bg-card/95 backdrop-blur-md border-b border-gray-100/80 px-4 py-2 flex items-center justify-between min-h-[56px] sticky top-0 z-30">
      {/* Left: back arrow + title */}
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={20} className="text-primary" />
          </button>
        )}
        {title && (
          <h1 className="text-base font-semibold text-primary leading-tight">
            {title}
          </h1>
        )}
      </div>

      {/* Right: streak (student pages) + language toggle */}
      <div className="flex items-center gap-3">
        {!isTeacherPage && streak !== undefined && (
          <div className="flex items-center gap-1 text-sm font-semibold text-warm bg-warm/10 px-2.5 py-1 rounded-lg">
            <Flame size={14} className="text-warm" />
            <span>{streak}</span>
          </div>
        )}
        <LanguageToggle />
      </div>
    </div>
  );

  // ─── COMPANION WIDGET ─────────────────────────────────────────────────────────
  const CompanionWidget = () => (
    <div
      className="fixed bottom-20 right-4 flex flex-col items-center gap-1.5 z-40 animate-fadeIn"
      aria-label={`${companion?.nickname || 'Gyaan'} your learning companion`}
    >
      <div
        className={`companion-container ${
          companionState === 'happy' ? 'happy' : 
          companionState === 'encouraging' ? 'encouraging' : ''
        }`}
      >
        {companion?.emoji || '🦉'}
      </div>
      <span className="text-[10px] font-medium text-muted bg-card px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
        {companion?.nickname || 'Gyaan'}
      </span>
    </div>
  );

  // ─── PAGE MAX-WIDTH ───────────────────────────────────────────────────────────
  const maxWidthClass = isTeacherPage ? 'max-w-5xl' : 'max-w-md';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Always-on offline banner */}
      <OfflineBanner />

      {/* Top nav bar (hidden on Splash) */}
      {showNav && <NavBar />}

      {/* Page content */}
      <main className={`flex-1 ${maxWidthClass} mx-auto w-full px-4 py-6`}>
        {children}
      </main>

      {/* Companion widget — student pages only */}
      {showCompanion && <CompanionWidget />}
    </div>
  );
}
