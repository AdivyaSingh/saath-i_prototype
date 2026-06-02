// src/pages/TeacherDashboard.jsx
// Route: /teacher
// Two states in one file: Login form → Dashboard with student grid + slide-in profile panel.
// Student profile panel is NOT a separate route — it is a slide-in overlay within this page.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogOut, ChevronDown } from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { DEMO_STUDENTS, STRINGS } from '../data';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const sldBadge = {
  dyslexia:    'bg-blue-100 text-blue-700',
  dyscalculia: 'bg-purple-100 text-purple-700',
  dysgraphia:  'bg-orange-100 text-orange-700',
};

const masteryStyle = {
  mastered:    'bg-green-100 text-green-700 border border-green-200',
  in_progress: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  struggling:  'bg-red-100 text-red-700 border border-red-200',
  not_started: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const masteryLabel = {
  mastered:    { EN: 'Mastered ✓', HI: 'सीखा ✓' },
  in_progress: { EN: 'In Progress', HI: 'जारी है' },
  struggling:  { EN: 'Needs Support', HI: 'मदद चाहिए' },
  not_started: { EN: 'Not Started', HI: 'शुरू नहीं' },
};

const trendIcon = {
  improving: { icon: '↑', cls: 'text-green-600 font-bold' },
  stable:    { icon: '→', cls: 'text-muted' },
  worsening: { icon: '↓', cls: 'text-red-500 font-bold' },
};

const statusDot = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
};

// ─── FILTER TABS ──────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: 'all',       label: 'All' },
  { id: 'attention', label: 'Needs Attention' },
  { id: 'active',    label: 'Active' },
  { id: 'sld',       label: 'By SLD Type' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const { language, teacherLoggedIn, teacherName } = appState;
  const S = STRINGS[language];

  // Login form local state
  const [schoolCode, setSchoolCode]   = useState('SCH001');
  const [inputName, setInputName]     = useState('Ms. Lata');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard local state
  const [activeTab, setActiveTab]           = useState('all');
  const [sortBy, setSortBy]                 = useState('status');
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Profile panel AI suggestion editing
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [suggestionText, setSuggestionText]       = useState('');

  // ── Login handler ────────────────────────────────────────────────────────
  const handleLogin = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
      updateState({ teacherLoggedIn: true, teacherName: inputName || 'Ms. Lata' });
      setIsLoggingIn(false);
    }, 500);
  };

  // ── Filter + sort students ───────────────────────────────────────────────
  const filteredStudents = DEMO_STUDENTS
    .filter(s => {
      if (activeTab === 'attention') return s.status === 'red' || s.status === 'yellow';
      if (activeTab === 'active')    return s.status === 'green';
      return true; // 'all' and 'sld' — 'sld' shows all, could add grouping
    })
    .sort((a, b) => {
      if (sortBy === 'name')   return a.name.localeCompare(b.name);
      if (sortBy === 'status') {
        const order = { red: 0, yellow: 1, green: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      }
      return 0; // lastActive — leave as-is for demo
    });

  // ── Active student for slide-in panel ───────────────────────────────────
  const activeStudent = activeStudentId
    ? DEMO_STUDENTS.find(s => s.id === activeStudentId)
    : null;

  const openPanel = (student) => {
    setSuggestionText(student.aiSuggestion);
    setEditingSuggestion(false);
    setActiveStudentId(student.id);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 1 — LOGIN FORM
  // ─────────────────────────────────────────────────────────────────────────
  if (!teacherLoggedIn) {
    return (
      <Layout
        title=""
        showNav={false}
        showCompanion={false}
        isTeacherPage
        lang={language}
        setLanguage={(lang) => updateState({ language: lang })}
      >
        <div className="min-h-[calc(100vh-32px)] flex flex-col items-center justify-center px-4 py-8">
          {/* Language toggle — rendered outside nav since showNav=false */}
          <div className="absolute top-8 right-4">
            <button
              onClick={() => updateState({ language: language === 'EN' ? 'HI' : 'EN' })}
              className="bg-white border border-gray-200 text-primary font-semibold text-sm px-3 py-1 rounded-lg min-h-[48px] hover:bg-gray-50 transition-colors"
            >
              {language === 'EN' ? 'हिंदी' : 'EN'}
            </button>
          </div>

          <div className="w-full max-w-sm">
            {/* Logo area */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-calm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <span className="text-3xl">📊</span>
              </div>
              <h1 className="text-2xl font-bold text-primary">
                Saath-i
              </h1>
              <p className="text-calm font-semibold text-lg mt-0.5">
                {S.loginTitle}
              </p>
              <p className="text-muted text-sm mt-2">
                {language === 'HI'
                  ? 'अपने छात्रों की प्रगति देखें'
                  : "Monitor your students' progress"}
              </p>
            </div>

            {/* Login card */}
            <div className="bg-card rounded-2xl shadow-sm border border-gray-100 p-6">
              {/* School Code */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-primary mb-1.5">
                  {S.schoolCode}
                </label>
                <input
                  type="text"
                  value={schoolCode}
                  onChange={e => setSchoolCode(e.target.value)}
                  placeholder="e.g. SCH001"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base text-primary font-medium focus:border-calm focus:outline-none transition-colors min-h-[48px]"
                />
              </div>

              {/* Teacher Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-primary mb-1.5">
                  {S.teacherName}
                </label>
                <input
                  type="text"
                  value={inputName}
                  onChange={e => setInputName(e.target.value)}
                  placeholder="Ms. Lata"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base text-primary font-medium focus:border-calm focus:outline-none transition-colors min-h-[48px]"
                />
              </div>

              {/* Login button */}
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                aria-label="Login as teacher"
                className="w-full bg-calm text-white font-semibold py-3 px-6 rounded-xl min-h-[48px] hover:bg-teal-600 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoggingIn
                  ? <><span className="animate-spin">⏳</span> {language === 'HI' ? 'लॉगिन हो रहा है...' : 'Logging in...'}</>
                  : S.loginButton}
              </button>

              {/* Demo note */}
              <p className="text-xs text-muted text-center mt-4">
                {language === 'HI'
                  ? 'डेमो: स्कूल कोड SCH001, नाम Ms. Lata'
                  : 'Demo: School Code SCH001, Name Ms. Lata'}
              </p>
            </div>

            {/* Back to student view */}
            <button
              onClick={() => navigate('/')}
              className="w-full mt-4 text-muted text-sm text-center hover:text-accent transition-colors min-h-[48px]"
            >
              ← {language === 'HI' ? 'छात्र मोड पर वापस जाएं' : 'Back to student mode'}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 2 — TEACHER DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout
      title=""
      showNav={false}
      showCompanion={false}
      isTeacherPage
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
    >
      {/* ── Custom Top Bar (replaces Layout nav on teacher pages) ──────────── */}
      <div className="bg-card border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-8 z-30 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-primary leading-tight">
            {language === 'HI' ? `${teacherName} की कक्षा` : `${teacherName}'s Class`}
          </h1>
          <p className="text-xs text-muted flex items-center gap-1">
            <span>📶</span>
            <span>{language === 'HI' ? 'अभी सिंक हुआ' : 'Last synced: Just now'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateState({ language: language === 'EN' ? 'HI' : 'EN' })}
            className="bg-white border border-gray-200 text-primary font-semibold text-sm px-3 py-1 rounded-lg min-h-[48px] hover:bg-gray-50 transition-colors"
          >
            {language === 'EN' ? 'हिंदी' : 'EN'}
          </button>
          <button
            onClick={() => updateState({ teacherLoggedIn: false })}
            aria-label="Logout"
            className="flex items-center gap-1.5 text-sm text-muted border border-gray-200 px-3 py-1 rounded-lg min-h-[48px] hover:text-red-500 hover:border-red-200 transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">{language === 'HI' ? 'लॉगआउट' : 'Logout'}</span>
          </button>
        </div>
      </div>

      <div className="py-6">
        {/* ── Summary Stats Row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
          {[
            { icon: '👥', value: '3', label: language === 'HI' ? 'छात्र सक्रिय' : 'students active' },
            { icon: '📊', value: '1', label: language === 'HI' ? 'IEP बाकी' : 'IEP due' },
            { icon: '⚠️', value: '1', label: language === 'HI' ? 'ध्यान चाहिए' : 'needs attention' },
            { icon: '📈', value: '4', label: language === 'HI' ? 'औसत सत्र/सप्ताह' : 'avg sessions/week' },
          ].map((stat, i) => (
            <div key={i} className="bg-card rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className="text-xl font-bold text-primary leading-none">{stat.value}</p>
                <p className="text-xs text-muted mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter Bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          {/* Tab pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={`Filter ${tab.label}`}
                className={`px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap min-h-[48px] border-2 transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-muted border-gray-200 hover:border-calm hover:text-calm'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              aria-label="Sort students"
              className="appearance-none bg-card border-2 border-gray-200 text-primary text-sm font-semibold px-4 py-2 pr-8 rounded-xl min-h-[48px] focus:border-calm focus:outline-none cursor-pointer"
            >
              <option value="status">{language === 'HI' ? 'स्थिति से' : 'By Status'}</option>
              <option value="name">{language === 'HI' ? 'नाम से' : 'By Name'}</option>
              <option value="lastActive">{language === 'HI' ? 'अंतिम सक्रिय' : 'Last Active'}</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        </div>

        {/* ── Student Grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map(student => (
            <div
              key={student.id}
              className="bg-card rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow duration-200"
            >
              {/* Card header: status dot + SLD badge */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${statusDot[student.status] || 'bg-gray-400'}`}
                  aria-label={`Status: ${student.status}`}
                />
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${sldBadge[student.sldType] || 'bg-gray-100 text-gray-600'}`}>
                  {student.sldType}
                </span>
                <span className="ml-auto text-xs text-muted font-medium">
                  {language === 'HI' ? `कक्षा ${student.class}` : `Class ${student.class}`}
                </span>
              </div>

              {/* Student name */}
              <h2 className="text-base font-bold text-primary mb-1">{student.name}</h2>

              {/* Last active */}
              <p className="text-xs text-muted mb-1">
                {language === 'HI' ? 'अंतिम सक्रिय:' : 'Last active:'} {student.lastActive}
              </p>

              {/* Streak */}
              {student.streakDays > 0 ? (
                <p className="text-xs text-warm font-semibold mb-3">
                  🔥 {student.streakDays}{language === 'HI' ? '-दिन स्ट्रीक' : '-day streak'}
                </p>
              ) : (
                <p className="text-xs text-red-400 font-semibold mb-3">
                  ⚠️ {language === 'HI' ? 'कोई सक्रियता नहीं' : 'No recent activity'}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => openPanel(student)}
                  aria-label={`View ${student.name}'s profile`}
                  className="flex-1 bg-accent text-white text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {language === 'HI' ? 'प्रोफाइल देखें' : 'View Profile'}
                </button>
                <button
                  onClick={() => navigate(`/teacher/iep/${student.id}`)}
                  aria-label={`Generate IEP for ${student.name}`}
                  className="flex-1 bg-calm text-white text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-teal-600 transition-colors shadow-sm"
                >
                  {language === 'HI' ? 'IEP बनाएं' : 'Generate IEP'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Resource Library link */}
        <div className="mt-6 bg-gradient-to-r from-primary to-accent rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">
              {language === 'HI' ? '📚 संसाधन पुस्तकालय' : '📚 Resource Library'}
            </p>
            <p className="text-blue-200 text-xs mt-0.5">
              {language === 'HI' ? 'पाठ योजनाएं और टेम्पलेट' : 'Lesson plans, guides & templates'}
            </p>
          </div>
          <button
            onClick={() => navigate('/teacher/resources')}
            aria-label="Browse resources"
            className="bg-white text-primary text-sm font-semibold px-4 py-2 rounded-xl min-h-[48px] hover:bg-orange-50 transition-colors"
          >
            {language === 'HI' ? 'देखें →' : 'Browse →'}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          STUDENT PROFILE SLIDE-IN PANEL
          ───────────────────────────────────────────────────────────────────── */}

      {/* Backdrop */}
      {activeStudentId && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setActiveStudentId(null)}
          aria-label="Close panel"
        />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          activeStudentId ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Student profile panel"
      >
        {activeStudent && (
          <div className="h-full overflow-y-auto">
            {/* ── Panel Header ─────────────────────────────────────────── */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-primary">{activeStudent.name}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${sldBadge[activeStudent.sldType] || ''}`}>
                    {activeStudent.sldType}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
                    {activeStudent.severity}
                  </span>
                  <span className="text-xs text-muted">
                    {language === 'HI' ? `कक्षा ${activeStudent.class}` : `Class ${activeStudent.class}`}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">{activeStudent.school}</p>
              </div>
              <button
                onClick={() => setActiveStudentId(null)}
                aria-label="Close student profile"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center text-muted hover:text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-6">
              {/* ── Section 1: Mastery Map ────────────────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3">
                  {language === 'HI' ? '📊 दक्षता मानचित्र' : '📊 Mastery Map'}
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(activeStudent.masteryMap).map(([concept, status]) => (
                    <span
                      key={concept}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl ${masteryStyle[status] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {concept}
                    </span>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {Object.entries(masteryLabel).map(([key, labels]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded-full inline-block ${
                        key === 'mastered'    ? 'bg-green-500'
                        : key === 'in_progress' ? 'bg-yellow-400'
                        : key === 'struggling'  ? 'bg-red-400'
                        : 'bg-gray-300'
                      }`} />
                      <span className="text-xs text-muted">{labels[language] || labels.EN}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Section 2: Error Pattern Insights ────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3">
                  {language === 'HI' ? '🔍 त्रुटि पैटर्न' : '🔍 Error Pattern Insights'}
                </h3>
                <div className="space-y-2">
                  {activeStudent.errorPatterns.map((ep, i) => {
                    const trend = trendIcon[ep.trend] || { icon: '→', cls: 'text-muted' };
                    return (
                      <div key={i} className="bg-surface rounded-xl p-3 flex items-start gap-3 border border-gray-100">
                        <span className={`text-lg font-bold mt-0.5 flex-shrink-0 ${trend.cls}`}>
                          {trend.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-primary leading-snug">{ep.pattern}</p>
                          <p className="text-xs text-muted mt-0.5">{ep.frequency}</p>
                        </div>
                        <span className={`text-xs font-medium capitalize flex-shrink-0 ${trend.cls}`}>
                          {ep.trend}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* ── Section 3: This Week ──────────────────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3">
                  {language === 'HI' ? '📅 इस सप्ताह' : '📅 This Week'}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      value: activeStudent.weeklyStats.timeSpent,
                      label: language === 'HI' ? 'समय बिताया' : 'Time spent',
                      icon: '⏱️',
                    },
                    {
                      value: activeStudent.weeklyStats.activitiesCompleted,
                      label: language === 'HI' ? 'गतिविधियाँ' : 'Activities',
                      icon: '✅',
                    },
                    {
                      value: activeStudent.weeklyStats.helpRequests,
                      label: language === 'HI' ? 'मदद माँगी' : 'Help asked',
                      icon: '🙋',
                    },
                  ].map((stat, i) => (
                    <div key={i} className="bg-surface rounded-xl p-3 text-center border border-gray-100">
                      <p className="text-lg mb-1">{stat.icon}</p>
                      <p className="text-base font-bold text-primary">{stat.value}</p>
                      <p className="text-xs text-muted mt-0.5 leading-tight">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Section 4: AI Suggestion ──────────────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3">
                  {language === 'HI' ? '💡 AI सुझाव' : '💡 AI Suggestion'}
                </h3>
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl flex-shrink-0">💡</span>
                    {editingSuggestion ? (
                      <textarea
                        value={suggestionText}
                        onChange={e => setSuggestionText(e.target.value)}
                        rows={4}
                        className="flex-1 text-sm text-primary border border-teal-300 rounded-lg p-2 bg-white focus:outline-none focus:border-calm resize-none"
                        aria-label="Edit AI suggestion"
                      />
                    ) : (
                      <p className="text-sm text-primary leading-relaxed flex-1">
                        {suggestionText}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted">
                      {language === 'HI'
                        ? 'AI द्वारा — कृपया समीक्षा करें'
                        : 'AI-generated — please review before acting'}
                    </p>
                    <button
                      onClick={() => setEditingSuggestion(prev => !prev)}
                      className="text-calm text-xs font-semibold border border-calm/30 px-3 py-1 rounded-lg hover:bg-teal-100 transition-colors min-h-[32px]"
                    >
                      {editingSuggestion
                        ? (language === 'HI' ? 'सहेजें' : 'Save')
                        : (language === 'HI' ? 'संपादित करें' : 'Edit')}
                    </button>
                  </div>
                </div>
              </section>

              {/* ── Section 5: Recent Portfolio ───────────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3">
                  {language === 'HI' ? '🎨 हालिया पोर्टफोलियो' : '🎨 Recent Portfolio'}
                </h3>
                <div className="bg-card border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎤</span>
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {language === 'HI' ? "मीरा का जादुई दरवाज़ा" : "Meera's Magical Door"}
                      </p>
                      <p className="text-xs text-muted">
                        {language === 'HI' ? 'अभिव्यक्ति स्टूडियो — जून 2025' : 'Expression Studio — June 2025'}
                      </p>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    placeholder={language === 'HI' ? 'यहाँ अपनी टिप्पणी लिखें...' : 'Add your notes here...'}
                    className="w-full text-xs text-primary border border-gray-200 rounded-lg p-2 focus:border-calm focus:outline-none resize-none mt-1"
                    aria-label="Teacher comment on portfolio item"
                  />
                </div>
              </section>

              {/* ── Bottom CTA ────────────────────────────────────────── */}
              <div className="pb-6">
                <button
                  onClick={() => navigate(`/teacher/iep/${activeStudent.id}`)}
                  aria-label={`Generate IEP for ${activeStudent.name}`}
                  className="w-full bg-warm text-white font-semibold py-3 px-6 rounded-xl min-h-[48px] hover:bg-orange-600 transition-colors shadow-sm"
                >
                  {language === 'HI'
                    ? `${activeStudent.name} के लिए IEP बनाएं →`
                    : `Generate IEP for ${activeStudent.name} →`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
