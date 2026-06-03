// src/pages/TeacherDashboard.jsx
// Route: /teacher
// Two states: Login (teacherLoggedIn=false) → Dashboard (teacherLoggedIn=true)
// Student profile panel is a slide-in overlay within this page — not a separate route.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, LogOut, ChevronDown, School, User, Wifi, BookOpen,
  Users, BarChart3, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Flame, Lightbulb, Loader2, Mic, Image as ImageIcon,
  Eye, Hash, PenTool, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { DEMO_STUDENTS, STRINGS } from '../data';
import { subscribeToStudents } from '../firebase';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Maps SLD type → CSS badge class defined in index.css
const sldBadgeClass = {
  dyslexia:    'badge badge-dyslexia',
  dyscalculia: 'badge badge-dyscalculia',
  dysgraphia:  'badge badge-dysgraphia',
};

// Maps status → CSS status-dot class defined in index.css
const statusDotClass = {
  green:  'status-dot status-dot-green',
  yellow: 'status-dot status-dot-yellow',
  red:    'status-dot status-dot-red',
};

// Mastery map tile styles
const masteryStyle = {
  mastered:    'bg-green-100 text-green-700 border border-green-200',
  in_progress: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  struggling:  'bg-red-100 text-red-700 border border-red-200',
  not_started: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const masteryLabel = {
  mastered:    { EN: 'Mastered', HI: 'सीखा' },
  in_progress: { EN: 'In Progress', HI: 'जारी है' },
  struggling:  { EN: 'Needs Support', HI: 'मदद चाहिए' },
  not_started: { EN: 'Not Started', HI: 'शुरू नहीं' },
};

// Trend icons — Lucide components
const trendConfig = {
  improving: { Icon: TrendingUp,   cls: 'text-green-600' },
  stable:    { Icon: Minus,        cls: 'text-muted' },
  worsening: { Icon: TrendingDown, cls: 'text-red-500' },
};

// ─── FILTER TABS ──────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: 'all',       labelEN: 'All',              labelHI: 'सभी' },
  { id: 'attention', labelEN: 'Needs Attention',   labelHI: 'ध्यान चाहिए' },
  { id: 'active',    labelEN: 'Active',            labelHI: 'सक्रिय' },
  { id: 'sld',       labelEN: 'By SLD Type',       labelHI: 'SLD प्रकार' },
];

// ─── DYNAMIC STATS DERIVED FROM DATA ──────────────────────────────────────────
const deriveStats = (students, language) => {
  const total = students.length;
  if (total === 0) {
    return [
      { Icon: Users, value: 0, label: language === 'HI' ? 'छात्र सक्रिय' : 'students active', color: 'text-accent', bg: 'bg-accent/10' },
      { Icon: BarChart3, value: 0, label: language === 'HI' ? 'औसत गतिविधियाँ/सप्ताह' : 'avg activities/week', color: 'text-calm', bg: 'bg-calm/10' },
      { Icon: AlertTriangle, value: 0, label: language === 'HI' ? 'ध्यान चाहिए' : 'needs attention', color: 'text-warm', bg: 'bg-warm/10' },
      { Icon: TrendingUp, value: 0, label: language === 'HI' ? 'सुधार रुझान' : 'improving trends', color: 'text-green-600', bg: 'bg-green-50' },
    ];
  }
  const needsAttention = students.filter(s => s.status === 'red' || s.status === 'yellow').length;
  const avgSessions = Math.round(students.reduce((sum, s) => sum + (s.weeklyStats?.activitiesCompleted || 0), 0) / total);
  const improvingCount = students.reduce((sum, s) =>
    sum + (s.errorPatterns || []).filter(ep => ep.trend === 'improving').length, 0);

  return [
    {
      Icon: Users,
      value: total,
      label: language === 'HI' ? 'छात्र सक्रिय' : 'students active',
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      Icon: BarChart3,
      value: avgSessions,
      label: language === 'HI' ? 'औसत गतिविधियाँ/सप्ताह' : 'avg activities/week',
      color: 'text-calm',
      bg: 'bg-calm/10',
    },
    {
      Icon: AlertTriangle,
      value: needsAttention,
      label: language === 'HI' ? 'ध्यान चाहिए' : 'needs attention',
      color: 'text-warm',
      bg: 'bg-warm/10',
    },
    {
      Icon: TrendingUp,
      value: improvingCount,
      label: language === 'HI' ? 'सुधार रुझान' : 'improving trends',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];
};

// Portfolio items per student — maps student id → portfolio entries
const STUDENT_PORTFOLIO = {
  student_001: [
    { type: 'voice', titleEN: "The Clever Crow — Retelling", titleHI: "चतुर कौआ — पुनर्कथन", dateEN: 'Reading Room — May 2025', dateHI: 'पठन कक्ष — मई 2025' },
    { type: 'story', titleEN: "Meera's Magical Door", titleHI: "मीरा का जादुई दरवाज़ा", dateEN: 'Expression Studio — June 2025', dateHI: 'अभिव्यक्ति स्टूडियो — जून 2025' },
  ],
  student_002: [
    { type: 'image', titleEN: "Object Counting — 14 stars", titleHI: "वस्तु गिनती — 14 तारे", dateEN: 'Number World — May 2025', dateHI: 'संख्या जगत — मई 2025' },
  ],
  student_003: [
    { type: 'voice', titleEN: "Lion and Mouse — Retelling", titleHI: "शेर और चूहा — पुनर्कथन", dateEN: 'Reading Room — April 2025', dateHI: 'पठन कक्ष — अप्रैल 2025' },
  ],
};

const portfolioIcon = {
  voice: Mic,
  story: BookOpen,
  image: ImageIcon,
};

// ─── SCREENING TELEMETRY HELPERS ──────────────────────────────────────────────

/** Small horizontal bar for a metric value. widthPercent: 0–100 */
function MetricBar({ widthPercent, color }) {
  return (
    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(Math.max(widthPercent, 4), 100)}%` }}
      />
    </div>
  );
}

/** Single telemetry stat row */
function TelemetryStat({ label, value, barPercent, barColor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted flex-shrink-0 w-32">{label}</span>
      <MetricBar widthPercent={barPercent} color={barColor} />
      <span className="text-xs font-semibold text-primary text-right w-24 flex-shrink-0">{value}</span>
    </div>
  );
}

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
  const [activeTab, setActiveTab]             = useState('all');
  const [sldSubFilter, setSldSubFilter]       = useState('all'); // sub-filter when tab = 'sld'
  const [sortBy, setSortBy]                   = useState('status');
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Profile panel AI suggestion editing
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [suggestionText, setSuggestionText]       = useState('');

  // Firebase real-time students
  const [firebaseStudents, setFirebaseStudents] = useState([]);

  // Subscribe to Firestore students
  useEffect(() => {
    const unsub = subscribeToStudents(setFirebaseStudents);
    return unsub;
  }, []);

  // Merge DEMO_STUDENTS with Firebase students, deduplicate by id
  const allStudents = useMemo(() => {
    const demoIds = new Set(DEMO_STUDENTS.map(s => s.id));
    const uniqueFirebase = firebaseStudents.filter(s => !demoIds.has(s.id));
    return [...DEMO_STUDENTS, ...uniqueFirebase];
  }, [firebaseStudents]);

  // Close panel on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setActiveStudentId(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Login handler ────────────────────────────────────────────────────────
  const handleLogin = () => {
    setIsLoggingIn(true);
    setTimeout(() => {
      updateState({ teacherLoggedIn: true, teacherName: inputName || 'Ms. Lata' });
      setIsLoggingIn(false);
    }, 500);
  };

  // ── Filter + sort students ───────────────────────────────────────────────
  const filteredStudents = allStudents
    .filter(s => {
      if (activeTab === 'attention') return s.status === 'red' || s.status === 'yellow';
      if (activeTab === 'active')    return s.status === 'green';
      if (activeTab === 'sld')       return sldSubFilter === 'all' || s.sldType === sldSubFilter;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'status') {
        const order = { red: 0, yellow: 1, green: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      }
      if (sortBy === 'lastActive') {
        // Parse "2 hours ago", "1 day ago", "8 days ago" for rough sort
        const parseTime = (str) => {
          if (!str) return 9999;
          const n = parseInt(str) || 0;
          if (str.includes('hour')) return n;
          if (str.includes('day'))  return n * 24;
          return n * 24 * 7;
        };
        return parseTime(a.lastActive) - parseTime(b.lastActive);
      }
      return 0;
    });

  // ── Active student for slide-in panel ───────────────────────────────────
  const activeStudent = activeStudentId
    ? allStudents.find(s => s.id === activeStudentId)
    : null;

  const openPanel = (student) => {
    setSuggestionText(student.aiSuggestion || '');
    setEditingSuggestion(false);
    setActiveStudentId(student.id);
  };

  // Stats derived from data
  const stats = deriveStats(allStudents, language);

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
              aria-label="Toggle language"
            >
              {language === 'EN' ? 'हिंदी' : 'EN'}
            </button>
          </div>

          <div className="w-full max-w-sm animate-fadeIn">
            {/* Logo area */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-calm/15 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-calm/20">
                <BarChart3 size={32} className="text-calm" />
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
                <div className="relative">
                  <School size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={schoolCode}
                    onChange={e => setSchoolCode(e.target.value)}
                    placeholder="e.g. SCH001"
                    aria-label="School code"
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base text-primary font-medium focus:border-calm focus:outline-none transition-colors min-h-[48px]"
                  />
                </div>
              </div>

              {/* Teacher Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-primary mb-1.5">
                  {S.teacherName}
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={inputName}
                    onChange={e => setInputName(e.target.value)}
                    placeholder="Ms. Lata"
                    aria-label="Teacher name"
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base text-primary font-medium focus:border-calm focus:outline-none transition-colors min-h-[48px]"
                  />
                </div>
              </div>

              {/* Login button */}
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                aria-label="Login as teacher"
                className="btn-calm w-full"
              >
                {isLoggingIn
                  ? <><Loader2 size={16} className="animate-spin" /> {language === 'HI' ? 'लॉगिन हो रहा है...' : 'Logging in...'}</>
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
              aria-label="Back to student mode"
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
      {/* ── Custom Top Bar ──────────────────────────────────────────────── */}
      <div className="bg-card border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-8 z-30 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-primary leading-tight">
            {language === 'HI' ? `${teacherName} की कक्षा` : `${teacherName}'s Class`}
          </h1>
          <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
            <Wifi size={12} className="text-green-500" />
            <span>{language === 'HI' ? 'अभी सिंक हुआ' : 'Last synced: Just now'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => updateState({ language: language === 'EN' ? 'HI' : 'EN' })}
            aria-label="Toggle language"
            className="bg-white border border-gray-200 text-primary font-semibold text-sm px-3 py-1 rounded-lg min-h-[48px] hover:bg-gray-50 transition-colors"
          >
            {language === 'EN' ? 'हिंदी' : 'EN'}
          </button>
          {/* Resource Library */}
          <button
            onClick={() => navigate('/teacher/resources')}
            aria-label="Resource Library"
            className="flex items-center gap-1.5 text-sm text-calm border border-calm/30 px-3 py-1 rounded-lg min-h-[48px] hover:bg-calm/10 transition-colors font-semibold"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">{language === 'HI' ? 'संसाधन' : 'Resources'}</span>
          </button>
          {/* Logout */}
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
          {stats.map((stat, i) => (
            <div key={i} className="bg-card rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <stat.Icon size={20} className={stat.color} />
              </div>
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
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.97 }}
                aria-label={`Filter ${tab.labelEN}`}
                className={`px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap min-h-[48px] border-2 transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-muted border-gray-200 hover:border-calm hover:text-calm'
                }`}
              >
                {language === 'HI' ? tab.labelHI : tab.labelEN}
              </motion.button>
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

        {/* ── SLD sub-filter (only when tab = 'sld') ─────────────────────── */}
        {activeTab === 'sld' && (
          <div className="flex gap-2 mb-4 animate-fadeIn">
            {['all', 'dyslexia', 'dyscalculia', 'dysgraphia'].map(type => (
              <motion.button
                key={type}
                onClick={() => setSldSubFilter(type)}
                whileTap={{ scale: 0.97 }}
                aria-label={`Filter by ${type}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold min-h-[40px] border-2 transition-all capitalize ${
                  sldSubFilter === type
                    ? 'bg-calm text-white border-calm'
                    : 'bg-card text-muted border-gray-200 hover:border-calm'
                }`}
              >
                {type === 'all' ? (language === 'HI' ? 'सभी' : 'All') : type}
              </motion.button>
            ))}
          </div>
        )}

        {/* ── Student Grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map(student => (
            <motion.div
              key={student.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow duration-200"
            >
              {/* Card header: status dot + SLD badge */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={statusDotClass[student.status] || 'status-dot bg-gray-400'}
                  aria-label={`Status: ${student.status}`}
                />
                <span className={sldBadgeClass[student.sldType] || 'badge bg-gray-100 text-gray-600'}>
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
                {language === 'HI' ? 'अंतिम सक्रिय:' : 'Last active:'} {student.lastActive || '—'}
              </p>

              {/* Streak */}
              {student.streakDays > 0 ? (
                <p className="text-xs text-warm font-semibold mb-3 flex items-center gap-1">
                  <Flame size={13} className="text-warm" />
                  {student.streakDays}{language === 'HI' ? '-दिन स्ट्रीक' : '-day streak'}
                </p>
              ) : (
                <p className="text-xs text-red-400 font-semibold mb-3 flex items-center gap-1">
                  <AlertTriangle size={13} />
                  {language === 'HI' ? 'कोई सक्रियता नहीं' : 'No recent activity'}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <motion.button
                  onClick={() => openPanel(student)}
                  whileTap={{ scale: 0.97 }}
                  aria-label={`View ${student.name}'s profile`}
                  className="flex-1 bg-accent text-white text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {language === 'HI' ? 'प्रोफाइल देखें' : 'View Profile'}
                </motion.button>
                <motion.button
                  onClick={() => navigate(`/teacher/iep/${student.id}`)}
                  whileTap={{ scale: 0.97 }}
                  aria-label={`Generate IEP for ${student.name}`}
                  className="flex-1 bg-calm text-white text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-teal-600 transition-colors shadow-sm"
                >
                  {language === 'HI' ? 'IEP बनाएं' : 'Generate IEP'}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {filteredStudents.length === 0 && (
          <div className="text-center py-12 animate-fadeIn">
            <Users size={40} className="text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted text-sm">
              {language === 'HI' ? 'इस फ़िल्टर के लिए कोई छात्र नहीं मिला।' : 'No students match this filter.'}
            </p>
            <button
              onClick={() => { setActiveTab('all'); setSldSubFilter('all'); }}
              className="mt-3 text-calm text-sm font-semibold hover:underline min-h-[48px]"
              aria-label="Clear filters"
            >
              {language === 'HI' ? 'फ़िल्टर हटाएं' : 'Clear filters'}
            </button>
          </div>
        )}

        {/* Resource Library link banner */}
        <div className="mt-6 bg-gradient-to-r from-primary to-accent rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-white/80" />
            <div>
              <p className="text-white font-semibold text-sm">
                {language === 'HI' ? 'संसाधन पुस्तकालय' : 'Resource Library'}
              </p>
              <p className="text-blue-200 text-xs mt-0.5">
                {language === 'HI' ? 'पाठ योजनाएं और टेम्पलेट' : 'Lesson plans, guides & templates'}
              </p>
            </div>
          </div>
          <motion.button
            onClick={() => navigate('/teacher/resources')}
            whileTap={{ scale: 0.97 }}
            aria-label="Browse resources"
            className="bg-white text-primary text-sm font-semibold px-4 py-2 rounded-xl min-h-[48px] hover:bg-orange-50 transition-colors"
          >
            {language === 'HI' ? 'देखें →' : 'Browse →'}
          </motion.button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          STUDENT PROFILE SLIDE-IN PANEL
          ───────────────────────────────────────────────────────────────────── */}

      {/* Backdrop */}
      <AnimatePresence>
        {activeStudentId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setActiveStudentId(null)}
            aria-label="Close panel"
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          activeStudentId ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-label="Student profile panel"
        role="dialog"
        aria-modal="true"
      >
        {activeStudent && (
          <div className="h-full overflow-y-auto">
            {/* ── Panel Header ─────────────────────────────────────────── */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-primary">{activeStudent.name}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={sldBadgeClass[activeStudent.sldType] || 'badge'}>
                    {activeStudent.sldType}
                  </span>
                  <span className="badge bg-gray-100 text-gray-600 border border-gray-200">
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
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <BarChart3 size={14} className="text-calm" />
                  {language === 'HI' ? 'दक्षता मानचित्र' : 'Mastery Map'}
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {activeStudent.masteryMap && Object.entries(activeStudent.masteryMap).map(([concept, status]) => (
                    <span
                      key={concept}
                      className={`text-xs font-medium px-3 py-1.5 rounded-xl ${masteryStyle[status] || 'bg-gray-100 text-gray-500'}`}
                    >
                      {concept}
                    </span>
                  ))}
                  {!activeStudent.masteryMap && (
                    <p className="text-xs text-muted italic">
                      {language === 'HI' ? 'दक्षता डेटा उपलब्ध नहीं' : 'Mastery data not yet available'}
                    </p>
                  )}
                </div>
                {/* Legend */}
                {activeStudent.masteryMap && (
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
                )}
              </section>

              {/* ── Section 2: Screening Insights (Telemetry) ────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Activity size={14} className="text-accent" />
                  {language === 'HI' ? 'स्क्रीनिंग अंतर्दृष्टि' : 'Screening Insights'}
                </h3>

                {activeStudent.screeningResults && activeStudent.telemetry ? (
                  <div className="space-y-4">
                    {/* ── Reading & Sound Tracking ── */}
                    <div className="bg-surface rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Eye size={13} className="text-accent" />
                        </div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wide">
                          {language === 'HI' ? 'पठन और ध्वनि ट्रैकिंग' : 'Reading & Sound Tracking'}
                        </h4>
                      </div>
                      <div className="divide-y divide-gray-100">
                        <TelemetryStat
                          label={language === 'HI' ? 'तुकबंदी गति' : 'Rhyming Speed'}
                          value={`${activeStudent.telemetry.rhymingSpeed}s avg`}
                          barPercent={Math.min(100, (activeStudent.telemetry.rhymingSpeed / 5) * 100)}
                          barColor="bg-accent"
                        />
                        <TelemetryStat
                          label={language === 'HI' ? 'ऑडियो सहायता उपयोग' : 'Audio Help Used'}
                          value={`${activeStudent.telemetry.audioHelpUsed} ${language === 'HI' ? 'बार' : 'times'}`}
                          barPercent={Math.min(100, (activeStudent.telemetry.audioHelpUsed / 10) * 100)}
                          barColor="bg-blue-400"
                        />
                        <TelemetryStat
                          label={language === 'HI' ? 'तुकबंदी सटीकता' : 'Rhyming Accuracy'}
                          value={`${activeStudent.telemetry.rhymingAccuracy}%`}
                          barPercent={activeStudent.telemetry.rhymingAccuracy}
                          barColor="bg-green-500"
                        />
                      </div>
                    </div>

                    {/* ── Number Sense ── */}
                    <div className="bg-surface rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
                          <Hash size={13} className="text-warm" />
                        </div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wide">
                          {language === 'HI' ? 'संख्या बोध' : 'Number Sense'}
                        </h4>
                      </div>
                      <div className="divide-y divide-gray-100">
                        <TelemetryStat
                          label={language === 'HI' ? 'गिनती गति' : 'Counting Speed'}
                          value={`${activeStudent.telemetry.countingSpeed}s avg`}
                          barPercent={Math.min(100, (activeStudent.telemetry.countingSpeed / 5) * 100)}
                          barColor="bg-warm"
                        />
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-xs text-muted flex-shrink-0 w-32">
                            {language === 'HI' ? 'नज़दीकी संख्या भ्रम' : 'Close Number Confusion'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            activeStudent.telemetry.closeNumberConfusion
                              ? 'bg-red-100 text-red-600'
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {activeStudent.telemetry.closeNumberConfusion
                              ? (language === 'HI' ? 'हाँ' : 'Yes')
                              : (language === 'HI' ? 'नहीं' : 'No')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ── Motor Control ── */}
                    <div className="bg-surface rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-teal-100 rounded-lg flex items-center justify-center">
                          <PenTool size={13} className="text-calm" />
                        </div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wide">
                          {language === 'HI' ? 'मोटर नियंत्रण' : 'Motor Control'}
                        </h4>
                      </div>
                      <div className="divide-y divide-gray-100">
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-xs text-muted flex-shrink-0 w-32">
                            {language === 'HI' ? 'रेखा स्थिरता' : 'Line Steadiness'}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            activeStudent.telemetry.lineSteadiness === 'Steady'
                              ? 'bg-green-100 text-green-600'
                              : activeStudent.telemetry.lineSteadiness === 'Shaky'
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {activeStudent.telemetry.lineSteadiness}
                          </span>
                        </div>
                        <TelemetryStat
                          label={language === 'HI' ? 'पथ सटीकता' : 'Path Accuracy'}
                          value={`${activeStudent.telemetry.pathAccuracy}px off-center`}
                          barPercent={Math.min(100, (activeStudent.telemetry.pathAccuracy / 30) * 100)}
                          barColor="bg-calm"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface rounded-xl p-4 border border-gray-100 text-center">
                    <Activity size={20} className="text-muted mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-muted italic">
                      {language === 'HI'
                        ? 'छात्र द्वारा मूल्यांकन पूरा करने के बाद स्क्रीनिंग डेटा उपलब्ध होगा'
                        : 'Screening data available after student completes the assessment'}
                    </p>
                  </div>
                )}
              </section>

              {/* ── Section 3: Error Pattern Insights ────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-warm" />
                  {language === 'HI' ? 'त्रुटि पैटर्न' : 'Error Pattern Insights'}
                </h3>
                <div className="space-y-2">
                  {(activeStudent.errorPatterns || []).map((ep, i) => {
                    const trend = trendConfig[ep.trend] || trendConfig.stable;
                    return (
                      <div key={i} className="bg-surface rounded-xl p-3 flex items-start gap-3 border border-gray-100">
                        <span className={`mt-0.5 flex-shrink-0 ${trend.cls}`}>
                          <trend.Icon size={18} />
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
                  {(!activeStudent.errorPatterns || activeStudent.errorPatterns.length === 0) && (
                    <p className="text-xs text-muted italic">
                      {language === 'HI' ? 'अभी कोई त्रुटि पैटर्न नहीं' : 'No error patterns recorded yet'}
                    </p>
                  )}
                </div>
              </section>

              {/* ── Section 4: This Week ──────────────────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-accent" />
                  {language === 'HI' ? 'इस सप्ताह' : 'This Week'}
                </h3>
                {activeStudent.weeklyStats ? (
                  <div className="flex gap-2">
                    {[
                      {
                        value: activeStudent.weeklyStats.timeSpent,
                        label: language === 'HI' ? 'समय बिताया' : 'Time spent',
                      },
                      {
                        value: activeStudent.weeklyStats.activitiesCompleted,
                        label: language === 'HI' ? 'गतिविधियाँ' : 'Activities',
                      },
                      {
                        value: activeStudent.weeklyStats.helpRequests,
                        label: language === 'HI' ? 'मदद माँगी' : 'Help asked',
                      },
                    ].map((stat, i) => (
                      <div key={i} className="flex-1 bg-accent/5 border border-accent/10 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-base font-bold text-primary">{stat.value}</p>
                        <p className="text-xs text-muted mt-0.5 leading-tight">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted italic">
                    {language === 'HI' ? 'इस सप्ताह का डेटा उपलब्ध नहीं' : 'No weekly data available yet'}
                  </p>
                )}
              </section>

              {/* ── Section 5: AI Suggestion ──────────────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Lightbulb size={14} className="text-calm" />
                  {language === 'HI' ? 'AI सुझाव' : 'AI Suggestion'}
                </h3>
                {activeStudent.aiSuggestion ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
                    <div className="flex items-start gap-2.5 mb-2">
                      <Lightbulb size={18} className="text-calm flex-shrink-0 mt-0.5" />
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
                        aria-label={editingSuggestion ? 'Save suggestion' : 'Edit suggestion'}
                        className="text-calm text-xs font-semibold border border-calm/30 px-3 py-1 rounded-lg hover:bg-teal-100 transition-colors min-h-[32px]"
                      >
                        {editingSuggestion
                          ? (language === 'HI' ? 'सहेजें' : 'Save')
                          : (language === 'HI' ? 'संपादित करें' : 'Edit')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted italic">
                    {language === 'HI' ? 'AI सुझाव उपलब्ध नहीं' : 'AI suggestion not available yet'}
                  </p>
                )}
              </section>

              {/* ── Section 6: Recent Portfolio ───────────────────────── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <BookOpen size={14} className="text-warm" />
                  {language === 'HI' ? 'हालिया पोर्टफोलियो' : 'Recent Portfolio'}
                </h3>
                {(STUDENT_PORTFOLIO[activeStudent.id] || []).map((item, i) => {
                  const PortIcon = portfolioIcon[item.type] || BookOpen;
                  return (
                    <div key={i} className="bg-card border border-gray-100 rounded-2xl p-4 mb-3">
                      <div className="flex items-center gap-2.5 mb-2">
                        <PortIcon size={18} className="text-warm flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-primary">
                            {language === 'HI' ? item.titleHI : item.titleEN}
                          </p>
                          <p className="text-xs text-muted">
                            {language === 'HI' ? item.dateHI : item.dateEN}
                          </p>
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder={language === 'HI' ? 'यहाँ अपनी टिप्पणी लिखें...' : 'Add your notes here...'}
                        className="w-full text-xs text-primary border border-gray-200 rounded-lg p-2 focus:border-calm focus:outline-none resize-none mt-1"
                        aria-label={`Teacher comment on ${language === 'HI' ? item.titleHI : item.titleEN}`}
                      />
                    </div>
                  );
                })}
                {!(STUDENT_PORTFOLIO[activeStudent.id]?.length) && (
                  <p className="text-xs text-muted italic">
                    {language === 'HI' ? 'अभी कोई पोर्टफोलियो आइटम नहीं' : 'No portfolio items yet'}
                  </p>
                )}
              </section>

              {/* ── Bottom CTA ────────────────────────────────────────── */}
              <div className="pb-6">
                <motion.button
                  onClick={() => navigate(`/teacher/iep/${activeStudent.id}`)}
                  whileTap={{ scale: 0.97 }}
                  aria-label={`Generate IEP for ${activeStudent.name}`}
                  className="w-full bg-warm text-white font-semibold py-3 px-6 rounded-xl min-h-[48px] hover:bg-orange-600 transition-colors shadow-sm"
                >
                  {language === 'HI'
                    ? `${activeStudent.name} के लिए IEP बनाएं →`
                    : `Generate IEP for ${activeStudent.name} →`}
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
