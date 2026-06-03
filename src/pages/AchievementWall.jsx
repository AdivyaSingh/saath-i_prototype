// src/pages/AchievementWall.jsx
// Route: /achievements
// Purpose: Show students what they CAN do. Counteracts shame spiral. Emotionally positive only.
// Companion is always in HAPPY state on this page.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Star, Library, Calculator, Mic, Flame,
  Lock, Share2, ArrowLeft, Sparkles, Award,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { ACHIEVEMENTS, STRINGS } from '../data';

// ─── ICON MAP ─────────────────────────────────────────────────────────────────
// Maps the string icon names stored in ACHIEVEMENTS data to Lucide components
const ICON_MAP = {
  BookOpen,
  Star,
  Library,
  Calculator,
  Mic,
  Flame,
};

// ─── CATEGORY TAB CONFIG ──────────────────────────────────────────────────────
const TABS = [
  { id: 'all',        label: 'All',        labelHI: 'सभी',          icon: Sparkles },
  { id: 'reading',    label: 'Reading',    labelHI: 'पढ़ना',         icon: BookOpen },
  { id: 'maths',      label: 'Maths',      labelHI: 'गणित',          icon: Calculator },
  { id: 'expression', label: 'Expression', labelHI: 'अभिव्यक्ति',   icon: Mic },
  { id: 'streak',     label: 'Streaks',    labelHI: 'स्ट्रीक',       icon: Flame },
];

// ─── CATEGORY ICON BACKGROUND COLORS ─────────────────────────────────────────
const categoryStyles = {
  reading:    { iconBg: 'bg-accent/15',  iconColor: 'text-accent',  badgeBg: 'bg-blue-100 text-blue-700' },
  maths:      { iconBg: 'bg-calm/15',    iconColor: 'text-calm',    badgeBg: 'bg-purple-100 text-purple-700' },
  expression: { iconBg: 'bg-warm/15',    iconColor: 'text-warm',    badgeBg: 'bg-orange-100 text-orange-700' },
  streak:     { iconBg: 'bg-warm/15',    iconColor: 'text-warm',    badgeBg: 'bg-red-100 text-red-700' },
};

// ─── CATEGORY LABELS ──────────────────────────────────────────────────────────
const categoryLabel = (category, lang) => {
  const labels = {
    reading:    { EN: 'Reading',    HI: 'पढ़ना' },
    maths:      { EN: 'Maths',      HI: 'गणित' },
    expression: { EN: 'Expression', HI: 'अभिव्यक्ति' },
    streak:     { EN: 'Streak',     HI: 'स्ट्रीक' },
  };
  return labels[category]?.[lang] || category;
};

// ─── UNLOCK CHECK ─────────────────────────────────────────────────────────────
// Checks whether an achievement is unlocked based on completed activities
const isUnlocked = (achievement, activitiesCompleted) => {
  const condition = achievement.unlockCondition;
  if (condition === 'streak') return true; // Streak achievements always show as unlocked in demo
  if (condition === 'reading') return (activitiesCompleted?.reading || 0) > 0;
  if (condition === 'maths') return (activitiesCompleted?.maths || 0) > 0;
  if (condition === 'expression') return (activitiesCompleted?.expression || 0) > 0;
  return true; // Default: unlocked
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────
const AchievementWall = () => {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const { language, companion, streakDays, studentName, activitiesCompleted } = appState;
  const lang = language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;

  const [activeTab, setActiveTab] = useState('all');

  // Filter achievements based on active tab
  const filtered = activeTab === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => a.category === activeTab);

  // Stagger classes for grid card entrance
  const staggerClasses = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5', 'stagger-6'];

  return (
    <Layout
      title={S.achievementWall}
      showNav
      showBack
      showCompanion
      pageContext="Viewing their achievements and progress"
      companionState="happy"
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={companion}
      streak={streakDays}
    >
      <div className="max-w-md mx-auto">

        {/* ── Page Header ──────────────────────────────────── */}
        <div className="mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-6 h-6 text-warm" />
            <h1 className="text-2xl font-bold text-primary leading-tight">
              {lang === 'HI' ? 'आपकी उपलब्धि दीवार' : 'Your Achievement Wall'}
            </h1>
          </div>
          <p className="text-lg text-muted mt-1">
            {lang === 'HI'
              ? 'देखो तुमने कितना सीखा है!'
              : "Look at everything you've learned!"}
          </p>

          {/* Celebratory banner */}
          <div className="mt-4 bg-gradient-to-r from-warm to-warm/80 rounded-2xl px-4 py-3 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-white flex-shrink-0" />
            <div>
              <p className="text-white font-semibold text-base leading-tight">
                {lang === 'HI'
                  ? `शाबाश, ${studentName || 'Arjun'}!`
                  : `Amazing work, ${studentName || 'Arjun'}!`}
              </p>
              <p className="text-white/80 text-sm">
                {lang === 'HI'
                  ? 'तुम्हारी मेहनत दिख रही है'
                  : 'Your effort really shows'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Category Tabs ────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide animate-slideUp stagger-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={`Filter by ${tab.label}`}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap min-h-[48px] transition-all duration-200 border-2 ${
                  isActive
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-card text-muted border-gray-200 hover:border-accent hover:text-accent'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{lang === 'HI' ? tab.labelHI : tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Achievement count ─────────────────────────────── */}
        <p className="text-sm text-muted mb-3 animate-fadeIn">
          {lang === 'HI'
            ? `${filtered.length} उपलब्धियाँ`
            : `${filtered.length} achievement${filtered.length !== 1 ? 's' : ''}`}
        </p>

        {/* ── Achievement Cards Grid ───────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 animate-fadeIn">
            <Sparkles className="w-12 h-12 text-muted mx-auto mb-3" />
            <p className="text-muted text-lg">
              {lang === 'HI'
                ? 'अभी कोई उपलब्धि नहीं - चलते रहो!'
                : 'No achievements here yet - keep going!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {filtered.map((achievement, idx) => {
              const title = lang === 'HI' ? achievement.titleHI : achievement.title;
              const shareText = encodeURIComponent(`${achievement.title} - Saath-i`);
              const unlocked = isUnlocked(achievement, activitiesCompleted);
              const style = categoryStyles[achievement.category] || categoryStyles.reading;

              // Resolve Lucide icon component from the icon name string
              const AchievementIcon = ICON_MAP[achievement.icon] || Star;

              return (
                <div
                  key={achievement.id}
                  className={`relative bg-gradient-to-br from-accent/5 to-primary/5 border rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-all duration-200 animate-fadeIn ${staggerClasses[idx % staggerClasses.length]} ${
                    unlocked
                      ? 'border-gray-200 hover:shadow-md'
                      : 'border-gray-100 opacity-60'
                  }`}
                >
                  {/* Lock overlay for locked achievements */}
                  {!unlocked && (
                    <div className="absolute top-3 right-3" aria-label="Locked">
                      <Lock className="w-4 h-4 text-muted" />
                    </div>
                  )}

                  {/* Achievement icon in styled circle */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      unlocked ? style.iconBg : 'bg-gray-100'
                    }`}
                    aria-hidden="true"
                  >
                    <AchievementIcon
                      className={`w-6 h-6 ${unlocked ? style.iconColor : 'text-muted'}`}
                    />
                  </div>

                  {/* Category badge */}
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full self-start mb-2 ${
                      unlocked ? style.badgeBg : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {categoryLabel(achievement.category, lang)}
                  </span>

                  {/* Achievement title */}
                  <p className={`text-sm font-semibold leading-snug mb-3 ${
                    unlocked ? 'text-primary' : 'text-muted'
                  }`}>
                    {title}
                  </p>

                  {/* WhatsApp share link - only for unlocked */}
                  {unlocked ? (
                    <a
                      href={`https://wa.me/?text=${shareText}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Share "${title}" on WhatsApp`}
                      className="text-success text-xs font-semibold flex items-center gap-1 mt-auto hover:text-green-700 transition-colors min-h-[32px]"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{lang === 'HI' ? 'शेयर करें' : 'Share'}</span>
                    </a>
                  ) : (
                    <p className="text-xs text-muted mt-auto min-h-[32px] flex items-center">
                      {lang === 'HI' ? 'जारी रखो!' : 'Keep going!'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Bottom CTA ───────────────────────────────────── */}
        <div className="bg-gradient-to-r from-accent to-primary rounded-2xl p-5 mb-8 animate-slideUp stagger-3">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-5 h-5 text-white" />
            <p className="text-white font-semibold text-base">
              {lang === 'HI'
                ? 'आगे बढ़ते रहो! अगली उपलब्धि बहुत पास है'
                : 'Keep going! Your next achievement is close'}
            </p>
          </div>
          <p className="text-white/70 text-sm mb-4">
            {lang === 'HI'
              ? `तुम्हारी ${streakDays || 4}-दिन की स्ट्रीक जारी है`
              : `Your ${streakDays || 4}-day streak is alive`}
          </p>
          <button
            onClick={() => navigate('/home')}
            aria-label={lang === 'HI' ? 'वापस घर जाएं' : 'Back to Home'}
            className="bg-white text-primary font-semibold py-2.5 px-5 rounded-xl min-h-[48px] hover:shadow-md transition-all duration-200 shadow-sm text-sm flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {lang === 'HI' ? 'वापस घर' : 'Back to Home'}
          </button>
        </div>

        {/* Spacer so companion widget doesn't overlap CTA */}
        <div className="h-20" />
      </div>
    </Layout>
  );
};

export default AchievementWall;
