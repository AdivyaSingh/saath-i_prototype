// src/pages/AchievementWall.jsx
// Route: /achievements
// Purpose: Show students what they CAN do. Counteracts shame spiral. Emotionally positive only.
// Companion is always in HAPPY state on this page.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { ACHIEVEMENTS, STRINGS } from '../data';

// ─── CATEGORY TAB CONFIG ──────────────────────────────────────────────────────
const TABS = [
  { id: 'all',        label: 'All',        labelHI: 'सभी',          icon: '🌟' },
  { id: 'reading',    label: 'Reading',    labelHI: 'पढ़ना',         icon: '📖' },
  { id: 'maths',      label: 'Maths',      labelHI: 'गणित',          icon: '🔢' },
  { id: 'expression', label: 'Expression', labelHI: 'अभिव्यक्ति',   icon: '🎤' },
  { id: 'streak',     label: 'Streaks',    labelHI: 'स्ट्रीक',       icon: '🔥' },
];

// ─── CATEGORY BADGE COLOURS ───────────────────────────────────────────────────
const categoryBadge = {
  reading:    'bg-blue-100 text-blue-700',
  maths:      'bg-purple-100 text-purple-700',
  expression: 'bg-orange-100 text-orange-700',
  streak:     'bg-red-100 text-red-700',
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function AchievementWall() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const { language, companion, streakDays, studentName } = appState;
  const S = STRINGS[language];

  const [activeTab, setActiveTab] = useState('all');

  // Filter achievements based on active tab
  const filtered = activeTab === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(a => a.category === activeTab);

  // Title in current language
  const pageTitle = language === 'HI' ? 'उपलब्धि दीवार 🏆' : 'Achievement Wall 🏆';

  return (
    <Layout
      title={pageTitle}
      showNav
      showBack
      showCompanion
      companionState="happy"
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
      companion={companion}
      streak={streakDays}
    >
      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary leading-tight">
          {language === 'HI' ? 'आपकी उपलब्धि दीवार 🏆' : 'Your Achievement Wall 🏆'}
        </h1>
        <p className="text-lg text-muted mt-1">
          {language === 'HI'
            ? 'देखो तुमने कितना सीखा है! 🌟'
            : "Look at everything you've learned! 🌟"}
        </p>

        {/* Celebratory banner — warm gradient strip */}
        <div className="mt-4 bg-gradient-to-r from-warm to-orange-400 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-3xl">🎉</span>
          <div>
            <p className="text-white font-semibold text-base leading-tight">
              {language === 'HI'
                ? `शाबाश, ${studentName}!`
                : `Amazing work, ${studentName}!`}
            </p>
            <p className="text-orange-100 text-sm">
              {language === 'HI'
                ? `तुम्हारी मेहनत दिख रही है 💪`
                : 'Your effort really shows 💪'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Category Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-label={`Filter by ${tab.label}`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap min-h-[48px] transition-all duration-200 border-2 ${
                isActive
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-card text-muted border-gray-200 hover:border-accent hover:text-accent'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{language === 'HI' ? tab.labelHI : tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Achievement count ─────────────────────────────────────────────── */}
      <p className="text-sm text-muted mb-3">
        {language === 'HI'
          ? `${filtered.length} उपलब्धियाँ`
          : `${filtered.length} achievement${filtered.length !== 1 ? 's' : ''}`}
      </p>

      {/* ── Achievement Cards Grid (2 columns) ───────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl">🌱</span>
          <p className="text-muted text-lg mt-3">
            {language === 'HI' ? 'अभी कोई उपलब्धि नहीं — चलते रहो!' : 'No achievements here yet — keep going!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {filtered.map((achievement) => {
            const title = language === 'HI' ? achievement.titleHI : achievement.title;
            const shareText = encodeURIComponent(`${achievement.title} — Saath-i`);

            return (
              <div
                key={achievement.id}
                className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {/* Icon */}
                <div className="text-4xl mb-2">{achievement.icon}</div>

                {/* Category badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full self-start mb-2 ${categoryBadge[achievement.category] || 'bg-gray-100 text-gray-600'}`}>
                  {achievement.category === 'reading'    ? (language === 'HI' ? 'पढ़ना' : 'Reading')
                  : achievement.category === 'maths'     ? (language === 'HI' ? 'गणित' : 'Maths')
                  : achievement.category === 'expression'? (language === 'HI' ? 'अभिव्यक्ति' : 'Expression')
                  : achievement.category === 'streak'    ? (language === 'HI' ? 'स्ट्रीक' : 'Streak')
                  : achievement.category}
                </span>

                {/* Achievement title */}
                <p className="text-sm font-semibold text-primary leading-snug mb-3">
                  {title}
                </p>

                {/* WhatsApp share button */}
                <a
                  href={`https://wa.me/?text=${shareText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Share ${title} on WhatsApp`}
                  className="text-green-600 text-xs font-semibold flex items-center gap-1 mt-auto hover:text-green-700 transition-colors min-h-[32px]"
                >
                  <span>📱</span>
                  <span>{language === 'HI' ? 'शेयर करें' : 'Share'}</span>
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-accent to-primary rounded-2xl p-5 mb-8">
        <p className="text-white font-semibold text-base mb-1">
          {language === 'HI'
            ? 'आगे बढ़ते रहो! अगली उपलब्धि बहुत पास है 🚀'
            : 'Keep going! Your next achievement is close 🚀'}
        </p>
        <p className="text-blue-100 text-sm mb-4">
          {language === 'HI'
            ? `तुम्हारी ${streakDays}-दिन की स्ट्रीक जारी है 🔥`
            : `Your ${streakDays}-day streak is alive 🔥`}
        </p>
        <button
          onClick={() => navigate('/home')}
          aria-label="Back to home"
          className="bg-white text-primary font-semibold py-2.5 px-5 rounded-xl min-h-[48px] hover:bg-orange-50 transition-colors shadow-sm text-sm"
        >
          {language === 'HI' ? '← वापस घर' : '← Back to Home'}
        </button>
      </div>

      {/* Spacer so companion widget doesn't overlap CTA */}
      <div className="h-20" />
    </Layout>
  );
}
