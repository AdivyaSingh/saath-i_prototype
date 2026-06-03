// src/components/Layout.jsx
// Shared shell component — wraps every page.
// Includes: 3-state connectivity banner, top nav bar, language toggle, companion widget with chat.

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, WifiOff, Wifi, Flame, Globe, X, Send, Loader2 } from 'lucide-react';
import { getCompanionHint } from '../gemini';

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
 *   studentName    — student's name for companion chat
 *   pageContext    — brief description of what the student is currently doing
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
  studentName = '',
  pageContext = '',
}) {
  const navigate = useNavigate();

  // ─── CONNECTIVITY STATE ───────────────────────────────────────────────────────
  // Three states: 'online' | 'syncing' | 'offline'
  // Timings (ms) — tweak these to adjust demo feel:
  const SYNC_DURATION_MS = 3500;   // how long the yellow "syncing" state lasts (3-4 seconds for Firebase catch-up feel)

  const [connState, setConnState] = useState(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
  );
  // Banner is always visible
  const bannerVisible = true;
  const syncTimerRef = useRef(null);

  useEffect(() => {
    const handleOffline = () => {
      clearTimeout(syncTimerRef.current);
      setConnState('offline');
    };

    const handleOnline = () => {
      setConnState('syncing');
      syncTimerRef.current = setTimeout(() => {
        setConnState('online');
      }, SYNC_DURATION_MS);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearTimeout(syncTimerRef.current);
    };
  }, []);

  // ─── COMPANION CHAT STATE ─────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const handleCompanionTap = async () => {
    if (chatOpen) { setChatOpen(false); return; }
    setChatOpen(true);
    if (chatMessages.length === 0) {
      setChatLoading(true);
      const hint = await getCompanionHint(
        pageContext || title || 'exploring the app',
        companion?.nickname || 'Gyaan',
        studentName || 'friend',
        lang
      );
      setChatMessages([{ from: 'companion', text: hint }]);
      setChatLoading(false);
    }
  };

  const handleAskHint = async () => {
    setChatLoading(true);
    const hint = await getCompanionHint(
      pageContext || title || 'exploring the app',
      companion?.nickname || 'Gyaan',
      studentName || 'friend',
      lang
    );
    setChatMessages(prev => [...prev, { from: 'companion', text: hint }]);
    setChatLoading(false);
  };

  // ─── BANNER CONFIG ────────────────────────────────────────────────────────────
  const BANNER = {
    offline: {
      bg: 'bg-red-600',
      icon: WifiOff,
      textEN: 'Offline mode — data saved locally',
      textHI: 'ऑफलाइन मोड — बदलाव स्थानीय रूप से सेव हुए',
      spinning: false,
    },
    syncing: {
      bg: 'bg-amber-500',
      icon: Loader2,
      textEN: 'Reconnected — syncing to database...',
      textHI: 'कनेक्ट हुआ — डेटाबेस से सिंक हो रहा है...',
      spinning: true,
    },
    online: {
      bg: 'bg-blue-600',
      icon: Wifi,
      textEN: 'Online — Database connected',
      textHI: 'ऑनलाइन — डेटाबेस कनेक्टेड',
      spinning: false,
    },
  };
  const cfg = BANNER[connState];
  const BannerIcon = cfg.icon;

  // ─── LANGUAGE TOGGLE ─────────────────────────────────────────────────────────
  const LanguageToggle = () => (
    <button
      onClick={() => setLanguage && setLanguage(lang === 'EN' ? 'HI' : 'EN')}
      aria-label="Toggle language"
      className="flex items-center gap-1.5 bg-white border border-gray-200 text-primary font-semibold text-sm px-3 py-2 rounded-lg min-h-[40px] hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 active:scale-[0.97]"
    >
      <Globe size={14} className="text-muted" />
      <span>{lang === 'EN' ? 'हिंदी' : 'EN'}</span>
    </button>
  );

  // ─── TOP NAV BAR ─────────────────────────────────────────────────────────────
  const NavBar = () => (
    <div className="bg-card/95 backdrop-blur-md border-b border-gray-100/80 px-4 py-2 flex items-center justify-between min-h-[56px] sticky top-0 z-30">
      <div className="flex items-center gap-2">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.95]"
          >
            <ArrowLeft size={20} className="text-primary" />
          </button>
        )}
        {title && (
          <h1 className="text-base font-semibold text-primary leading-tight">{title}</h1>
        )}
      </div>
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

  // ─── COMPANION WIDGET WITH CHAT ───────────────────────────────────────────────
  const CompanionWidget = () => (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
      {chatOpen && (
        <div className="bg-card rounded-2xl shadow-xl border border-gray-100 w-72 max-h-64 flex flex-col animate-scaleIn origin-bottom-right">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-lg">{companion?.emoji || '🦉'}</span>
              <span className="text-sm font-semibold text-primary">{companion?.nickname || 'Gyaan'}</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close chat">
              <X size={14} className="text-muted" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[80px] max-h-[140px]">
            {chatMessages.map((msg, i) => (
              <div key={i} className="bg-warm/5 border border-warm/10 rounded-xl px-3 py-2 text-sm text-primary leading-relaxed animate-fadeIn">
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-muted text-xs py-1">
                <Loader2 size={12} className="animate-spin" />
                <span>{lang === 'HI' ? 'सोच रहा हूँ...' : 'Thinking...'}</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="px-3 py-2 border-t border-gray-100">
            <button
              onClick={handleAskHint}
              disabled={chatLoading}
              className="w-full bg-warm/10 text-warm text-sm font-medium py-2 rounded-xl hover:bg-warm/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <Send size={12} />
              {lang === 'HI' ? 'और मदद चाहिए' : 'Help me more'}
            </button>
          </div>
        </div>
      )}
      <button
        onClick={handleCompanionTap}
        className="flex flex-col items-center gap-1.5 animate-fadeIn group"
        aria-label={`${companion?.nickname || 'Gyaan'} — tap for help`}
      >
        <div
          className={`companion-container transition-all duration-300 group-hover:scale-105 ${
            companionState === 'happy' ? 'happy' :
            companionState === 'encouraging' ? 'encouraging' : ''
          } ${chatOpen ? 'ring-2 ring-warm/30 ring-offset-2' : ''}`}
        >
          {companion?.emoji || '🦉'}
        </div>
        <span className="text-[10px] font-medium text-muted bg-card px-2 py-0.5 rounded-full shadow-sm border border-gray-100">
          {companion?.nickname || 'Gyaan'}
        </span>
      </button>
    </div>
  );

  const maxWidthClass = isTeacherPage ? 'max-w-5xl' : 'max-w-md';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ── Three-state connectivity banner ── */}
      <div
        className={`${cfg.bg} text-white text-xs px-4 flex items-center justify-center gap-2 overflow-hidden transition-colors duration-500 ease-in-out py-1.5`}
        role="status"
        aria-live="polite"
      >
        <BannerIcon size={12} className={`flex-shrink-0 ${cfg.spinning ? 'animate-spin' : ''}`} />
        <span className="opacity-95">{lang === 'HI' ? cfg.textHI : cfg.textEN}</span>
      </div>

      {showNav && <NavBar />}

      <main className={`flex-1 ${maxWidthClass} mx-auto w-full px-4 py-6`}>
        {children}
      </main>

      {showCompanion && <CompanionWidget />}
    </div>
  );
}
