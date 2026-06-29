// src/pages/TeacherDashboard.jsx
// Route: /teacher
// Two states: Login (teacherLoggedIn=false) → Dashboard (teacherLoggedIn=true)
// Student profile panel is a slide-in overlay within this page - not a separate route.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X, LogOut, ChevronDown, School, User, Wifi, BookOpen,
  Users, BarChart3, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Flame, Lightbulb, Loader2, Mic, Image as ImageIcon,
  Eye, Hash, PenTool, Activity, Lock, CheckCircle2, KeyRound,
  Delete, EyeOff, Bot, Stethoscope, Send, ClipboardList, HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { DEMO_STUDENTS, STRINGS, SUPPORT_AREAS, TIER_LABELS, REFERRAL_STATUS_LABELS } from '../data';
import { subscribeToStudents, verifyTeacherPin, createTeacher, generateClassCode, saveStudentToFirebase } from '../firebase';
import WalkthroughOverlay from '../components/WalkthroughOverlay';

// localStorage key — set to 'done' once the teacher completes/skips the tour
const TEACHER_TOUR_KEY = 'saathi_teacher_tour_done';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Maps support area → CSS badge class defined in index.css
const supportAreaBadgeClass = {
  reading:      'badge badge-reading',
  writing:      'badge badge-writing',
  numeracy:     'badge badge-numeracy',
  attention:    'badge badge-attention',
  memory:       'badge badge-memory',
  organisation: 'badge badge-organisation',
};

// Maps tier (1/2/3) → CSS badge class defined in index.css
const tierBadgeClass = {
  1: 'badge badge-tier-1',
  2: 'badge badge-tier-2',
  3: 'badge badge-tier-3',
};

// Human-readable label for a student's primary support area
const supportAreaLabel = (areaId, language) => {
  const area = SUPPORT_AREAS.find(a => a.id === areaId);
  if (!area) return language === 'HI' ? 'सहायता चाहिए' : 'Support needed';
  return language === 'HI' ? area.labelHI : area.labelEN;
};

// Short tier label, e.g. "Tier 2" / "स्तर 2"
const tierShortLabel = (tier, language) => {
  const n = tier || 1;
  return language === 'HI' ? `स्तर ${n}` : `Tier ${n}`;
};

// Maps status → CSS status-dot class defined in index.css
const statusDotClass = {
  green:  'status-dot status-dot-green',
  yellow: 'status-dot status-dot-yellow',
  red:    'status-dot status-dot-red',
};

// ── PRIORITY 6: Special Educator Referral helpers ──────────────────────────
// 'recommended' is never written to the database by anything automated — it
// is only ever computed here for display, so a Tier 3 student with no
// referral yet still nudges the teacher without anyone having "decided" for them.
const referralPillClass = {
  none:         'bg-gray-100 text-gray-500',
  recommended:  'bg-warm/10 text-warm',
  submitted:    'bg-accent/10 text-accent',
  under_review: 'bg-amber-100 text-amber-700',
  complete:     'bg-green-100 text-green-700',
};

const displayReferralStatus = (student) => {
  const stored = student.referralStatus;
  if (stored && stored !== 'none') return stored;
  return student.tier === 3 ? 'recommended' : 'none';
};

const ReferralPill = ({ student, language }) => {
  const status = displayReferralStatus(student);
  const label = REFERRAL_STATUS_LABELS[status] || REFERRAL_STATUS_LABELS.none;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${referralPillClass[status]}`}>
      {language === 'HI' ? label.HI : label.EN}
    </span>
  );
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

// Trend icons - Lucide components
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
  { id: 'tier',      labelEN: 'By Tier',           labelHI: 'स्तर अनुसार' },
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

// Portfolio items per student - maps student id → portfolio entries
const STUDENT_PORTFOLIO = {
  student_001: [
    { type: 'voice', titleEN: "The Clever Crow - Retelling", titleHI: "चतुर कौआ - पुनर्कथन", dateEN: 'Reading Room - May 2025', dateHI: 'पठन कक्ष - मई 2025' },
    { type: 'story', titleEN: "Meera's Magical Door", titleHI: "मीरा का जादुई दरवाज़ा", dateEN: 'Expression Studio - June 2025', dateHI: 'अभिव्यक्ति स्टूडियो - जून 2025' },
  ],
  student_002: [
    { type: 'image', titleEN: "Object Counting - 14 stars", titleHI: "वस्तु गिनती - 14 तारे", dateEN: 'Number World - May 2025', dateHI: 'संख्या जगत - मई 2025' },
  ],
  student_003: [
    { type: 'voice', titleEN: "Lion and Mouse - Retelling", titleHI: "शेर और चूहा - पुनर्कथन", dateEN: 'Reading Room - April 2025', dateHI: 'पठन कक्ष - अप्रैल 2025' },
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
  const location = useLocation();
  const { appState, updateState } = useApp();
  const { language, teacherLoggedIn, teacherName, teacherClassCode } = appState;
  const S = STRINGS[language];

  // ── Login / Register state ────────────────────────────────────────────────
  const [loginMode, setLoginMode]           = useState('login');  // 'login' | 'register'
  const [loginClassCode, setLoginClassCode] = useState('SCH001');
  const [loginPin, setLoginPin]             = useState('');
  const [isLoggingIn, setIsLoggingIn]       = useState(false);
  const [loginError, setLoginError]         = useState('');

  // Register form
  const [regName, setRegName]               = useState('');
  const [regSchool, setRegSchool]           = useState('');
  const [regPin, setRegPin]                 = useState('');
  const [regConfirmPin, setRegConfirmPin]   = useState('');
  const [showRegPin, setShowRegPin]         = useState(false);
  const [isRegistering, setIsRegistering]   = useState(false);
  const [registerError, setRegisterError]   = useState('');
  const [generatedCode, setGeneratedCode]   = useState(null); // shown after successful register

  // ── Login handler (verifies PIN against Firestore teachers collection) ──────
  const handleLogin = async () => {
    const code = loginClassCode.trim().toUpperCase();
    if (!code || loginPin.length < 4) return;
    setIsLoggingIn(true);
    setLoginError('');
    const teacher = await verifyTeacherPin(code, loginPin);
    setIsLoggingIn(false);
    if (teacher) {
      updateState({
        teacherLoggedIn:  true,
        teacherName:      teacher.name,
        teacherClassCode: teacher.classCode,
      });
    } else {
      setLoginError(
        language === 'HI'
          ? 'गलत कोड या PIN। कृपया फिर से कोशिश करें। (डेमो: SCH001 / 1234)'
          : 'Incorrect class code or PIN. Please try again. (Demo: SCH001 / 1234)'
      );
      setLoginPin('');
    }
  };

  // ── Register handler ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!regName.trim() || !regSchool.trim()) {
      setRegisterError(language === 'HI' ? 'सभी फ़ील्ड भरें' : 'Please fill all fields');
      return;
    }
    if (regPin.length < 4) {
      setRegisterError(language === 'HI' ? '4 अंकों का PIN चाहिए' : 'PIN must be 4 digits');
      return;
    }
    if (regPin !== regConfirmPin) {
      setRegisterError(language === 'HI' ? 'PIN मेल नहीं खाता' : 'PINs do not match');
      return;
    }
    setIsRegistering(true);
    setRegisterError('');
    const classCode = await generateClassCode(regSchool);
    const result = await createTeacher({ name: regName.trim(), schoolName: regSchool.trim(), classCode, pin: regPin });
    setIsRegistering(false);
    if (result) {
      setGeneratedCode(classCode);
    } else {
      setRegisterError(language === 'HI' ? 'पंजीकरण विफल। पुनः कोशिश करें।' : 'Registration failed. Please try again.');
    }
  };

  // ── Dashboard local state ─────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState('all');
  const [tierSubFilter,   setTierSubFilter]   = useState('all');
  const [sortBy,          setSortBy]          = useState('status');
  const [activeStudentId, setActiveStudentId] = useState(null);

  // ── Walkthrough state ─────────────────────────────────────────────────────
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // Auto-trigger on first login; small delay so dashboard elements render
  useEffect(() => {
    if (teacherLoggedIn && !localStorage.getItem(TEACHER_TOUR_KEY)) {
      const t = setTimeout(() => setShowWalkthrough(true), 700);
      return () => clearTimeout(t);
    }
  }, [teacherLoggedIn]);

  const handleWalkthroughComplete = () => {
    localStorage.setItem(TEACHER_TOUR_KEY, 'done');
    setShowWalkthrough(false);
  };

  // Profile panel AI suggestion editing
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [suggestionText,    setSuggestionText]    = useState('');

  // ── PRIORITY 6: Special Educator Referral modal state ──────────────────────
  const [referralModalStudent, setReferralModalStudent] = useState(null); // student object or null
  const [referralReason,  setReferralReason]  = useState('');
  const [referralNotes,   setReferralNotes]   = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);

  const openReferralModal = (student) => {
    setReferralReason(student.teacherReferralReason || '');
    setReferralNotes(student.teacherNotes || '');
    setReferralModalStudent(student);
  };

  const submitReferral = async () => {
    if (!referralModalStudent || !referralReason.trim()) return;
    setSubmittingReferral(true);
    try {
      await saveStudentToFirebase({
        id: referralModalStudent.id,
        referralStatus: 'submitted',
        referralDate: new Date().toISOString().slice(0, 10),
        teacherReferralReason: referralReason.trim(),
        teacherNotes: referralNotes.trim(),
        referredBy: teacherName,
      });
      setReferralModalStudent(null);
    } catch (e) {
      console.error('[TeacherDashboard] referral submit failed:', e);
    } finally {
      setSubmittingReferral(false);
    }
  };

  // Firebase real-time students — filtered to this teacher's class code only.
  const [firebaseStudents, setFirebaseStudents] = useState([]);

  useEffect(() => {
    if (!teacherLoggedIn || !teacherClassCode) return;
    const unsub = subscribeToStudents(setFirebaseStudents, teacherClassCode);
    return unsub;
  }, [teacherLoggedIn, teacherClassCode]);

  // Only prepend demo students when the logged-in teacher is the SCH001 demo teacher.
  // A newly registered teacher starts with an empty list until real students join.
  const allStudents = useMemo(() => {
    const isDemoClass = (teacherClassCode || '').toUpperCase() === 'SCH001';
    if (isDemoClass) {
      const demoIds = new Set(DEMO_STUDENTS.map(s => s.id));
      const uniqueFirebase = firebaseStudents.filter(s => !demoIds.has(s.id));
      return [...DEMO_STUDENTS, ...uniqueFirebase];
    }
    return firebaseStudents;
  }, [firebaseStudents, teacherClassCode]);

  // Close panel on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setActiveStudentId(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Filter + sort students ───────────────────────────────────────────────

  const filteredStudents = allStudents
    .filter(s => {
      if (activeTab === 'attention') return s.status === 'red' || s.status === 'yellow';
      if (activeTab === 'active')    return s.status === 'green';
      if (activeTab === 'tier')      return tierSubFilter === 'all' || String(s.tier || 1) === tierSubFilter;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'status') {
        const order = { red: 0, yellow: 1, green: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      }
      if (sortBy === 'lastActive') {
        const formatLastActive = (val) => {
          if (!val) return null;
          if (typeof val === 'string') return val;
          if (val.toMillis) return `${Math.floor((Date.now() - val.toMillis()) / 3600000)} hours ago`;
          if (val.seconds) return `${Math.floor((Date.now() - (val.seconds * 1000)) / 3600000)} hours ago`;
          return String(val);
        };
        // Parse "2 hours ago", "1 day ago", "8 days ago" for rough sort
        const parseTime = (val) => {
          const str = formatLastActive(val);
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

  // ── PRIORITY 6: Deep-link from the AI Teacher Assistant ─────────────────────
  // When the assistant's escalation button sends a teacher here with a specific
  // student in mind (location.state.openReferralFor), open that student's panel
  // and pre-open the referral modal. The AI never submits the referral itself —
  // this just saves the teacher a click; they still have to fill in the reason
  // and hit Submit.
  useEffect(() => {
    const targetId = location.state?.openReferralFor;
    if (!targetId || allStudents.length === 0) return;
    const target = allStudents.find(s => s.id === targetId);
    if (target) {
      openPanel(target);
      openReferralModal(target);
    }
    // Clear the nav state so refreshing/back doesn't re-trigger this.
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStudents]);

  // Pending referrals (submitted or under review) — shown as a small badge on
  // the queue nav button so teachers notice without having to open it.
  const pendingReferralCount = allStudents.filter(
    s => s.referralStatus === 'submitted' || s.referralStatus === 'under_review'
  ).length;

  // Stats derived from data
  const stats = deriveStats(allStudents, language);

  // ─────────────────────────────────────────────────────────────────────────
  // STATE 1 - LOGIN FORM
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
          {/* Language toggle */}
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
            {/* Logo */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-calm/15 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-calm/20">
                <BarChart3 size={32} className="text-calm" />
              </div>
              <h1 className="text-2xl font-bold text-primary">Saath-i</h1>
              <p className="text-calm font-semibold text-lg mt-0.5">{S.loginTitle}</p>
            </div>

            {/* Tab switcher: Login / Register */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              {['login','register'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setLoginMode(mode); setLoginError(''); setRegisterError(''); setGeneratedCode(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    loginMode === mode ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-primary'
                  }`}
                >
                  {mode === 'login'
                    ? (language === 'HI' ? 'लॉगिन' : 'Login')
                    : (language === 'HI' ? 'पंजीकरण' : 'Register')}
                </button>
              ))}
            </div>

            {/* ── LOGIN FORM ── */}
            {loginMode === 'login' && (
              <div className="bg-card rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                {/* Class Code */}
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1.5">{S.schoolCode}</label>
                  <div className="relative">
                    <School size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      value={loginClassCode}
                      onChange={e => { setLoginClassCode(e.target.value.toUpperCase()); setLoginError(''); }}
                      placeholder="SCH001"
                      aria-label="School code"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base text-primary font-mono tracking-widest focus:border-calm focus:outline-none transition-colors min-h-[48px]"
                    />
                  </div>
                </div>

                {/* PIN */}
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1.5">
                    {language === 'HI' ? 'आपका PIN' : 'Your PIN'}
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type={showRegPin ? 'text' : 'password'}
                      value={loginPin}
                      onChange={e => { setLoginPin(e.target.value.replace(/\D/g,'').slice(0,4)); setLoginError(''); }}
                      placeholder="••••"
                      maxLength={4}
                      aria-label="PIN"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-10 py-3 text-base text-primary font-mono tracking-widest focus:border-calm focus:outline-none transition-colors min-h-[48px]"
                    />
                    <button onClick={() => setShowRegPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" type="button">
                      {showRegPin ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{loginError}</p>
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn || loginPin.length < 4 || !loginClassCode.trim()}
                  aria-label="Login as teacher"
                  className="btn-calm w-full disabled:opacity-50"
                >
                  {isLoggingIn
                    ? <><Loader2 size={16} className="animate-spin" /> {language === 'HI' ? 'जाँच रहे हैं...' : 'Verifying...'}</>
                    : <><KeyRound size={16}/> {S.loginButton}</>}
                </button>

                <p className="text-xs text-muted text-center">
                  {language === 'HI' ? 'डेमो: SCH001 / PIN: 1234' : 'Demo: Code SCH001 / PIN: 1234'}
                </p>
              </div>
            )}

            {/* ── REGISTER FORM ── */}
            {loginMode === 'register' && !generatedCode && (
              <div className="bg-card rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <p className="text-xs text-muted text-center">
                  {language === 'HI'
                    ? 'पंजीकरण करें और अपना class code पाएं'
                    : 'Register to get your unique class code for students'}
                </p>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1.5">{S.teacherName}</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Ms. Lata"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base text-primary font-medium focus:border-calm focus:outline-none min-h-[48px]"
                      aria-label="Teacher name" />
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1.5">
                    {language === 'HI' ? 'स्कूल का नाम' : 'School Name'}
                  </label>
                  <div className="relative">
                    <School size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input type="text" value={regSchool} onChange={e => setRegSchool(e.target.value)} placeholder="Team: CaseLyticals"
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base text-primary font-medium focus:border-calm focus:outline-none min-h-[48px]"
                      aria-label="School name" />
                  </div>
                </div>

                {/* Create PIN */}
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1.5">
                    {language === 'HI' ? 'PIN बनाएं (4 अंक)' : 'Create PIN (4 digits)'}
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input type={showRegPin ? 'text' : 'password'} value={regPin}
                      onChange={e => setRegPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                      placeholder="••••" maxLength={4}
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-10 py-3 text-base text-primary font-mono tracking-widest focus:border-calm focus:outline-none min-h-[48px]"
                      aria-label="Create PIN" />
                    <button onClick={() => setShowRegPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" type="button">
                      {showRegPin ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>

                {/* Confirm PIN */}
                <div>
                  <label className="block text-sm font-semibold text-primary mb-1.5">
                    {language === 'HI' ? 'PIN पुनः दर्ज करें' : 'Confirm PIN'}
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input type={showRegPin ? 'text' : 'password'} value={regConfirmPin}
                      onChange={e => setRegConfirmPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                      placeholder="••••" maxLength={4}
                      className={`w-full border-2 rounded-xl pl-10 pr-4 py-3 text-base text-primary font-mono tracking-widest focus:outline-none min-h-[48px] ${
                        regConfirmPin.length === 4 && regPin !== regConfirmPin
                          ? 'border-red-300 focus:border-red-400'
                          : 'border-gray-200 focus:border-calm'
                      }`}
                      aria-label="Confirm PIN" />
                  </div>
                  {regConfirmPin.length === 4 && regPin !== regConfirmPin && (
                    <p className="text-xs text-red-500 mt-1">{language === 'HI' ? 'PIN मेल नहीं खाता' : 'PINs do not match'}</p>
                  )}
                </div>

                {registerError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{registerError}</p>
                  </div>
                )}

                <button
                  onClick={handleRegister}
                  disabled={isRegistering || !regName.trim() || !regSchool.trim() || regPin.length < 4 || regPin !== regConfirmPin}
                  className="btn-calm w-full disabled:opacity-50"
                >
                  {isRegistering
                    ? <><Loader2 size={16} className="animate-spin" /> {language === 'HI' ? 'बना रहे हैं...' : 'Creating...'}</>
                    : (language === 'HI' ? 'पंजीकरण करें →' : 'Register & Get Code →')}
                </button>
              </div>
            )}

            {/* ── REGISTER SUCCESS ── */}
            {loginMode === 'register' && generatedCode && (
              <div className="bg-card rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-4 animate-fadeIn">
                <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} className="text-success" />
                </div>
                <h3 className="text-lg font-bold text-primary">
                  {language === 'HI' ? 'पंजीकरण सफल!' : 'Registration successful!'}
                </h3>
                <p className="text-sm text-muted">
                  {language === 'HI' ? 'आपका Class Code:' : 'Your Class Code is:'}
                </p>
                <div className="bg-primary/5 border-2 border-primary/20 rounded-xl py-4 px-6">
                  <p className="text-3xl font-bold text-primary tracking-widest font-mono">{generatedCode}</p>
                </div>
                <p className="text-xs text-muted">
                  {language === 'HI'
                    ? 'यह कोड अपने छात्रों को दें ताकि वे आपकी कक्षा से जुड़ सकें।'
                    : 'Share this code with your students so they can join your class.'}
                </p>
                <button
                  onClick={() => { setLoginMode('login'); setLoginClassCode(generatedCode); setGeneratedCode(null); }}
                  className="btn-calm w-full"
                >
                  {language === 'HI' ? 'अब लॉगिन करें →' : 'Now Login →'}
                </button>
              </div>
            )}

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
  // STATE 2 - TEACHER DASHBOARD
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
            {teacherClassCode && (
              <span className="ml-2 font-mono font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded text-xs">
                {teacherClassCode}
              </span>
            )}
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
          {/* AI Assistant */}
          <button
            id="walkthrough-ai-assistant"
            onClick={() => navigate('/teacher/assistant')}
            aria-label="AI Teacher Assistant"
            className="flex items-center gap-1.5 text-sm text-warm border border-warm/30 px-3 py-1 rounded-lg min-h-[48px] hover:bg-warm/10 transition-colors font-semibold"
          >
            <Bot size={14} />
            <span className="hidden sm:inline">{language === 'HI' ? 'AI सहायक' : 'AI Assistant'}</span>
          </button>
          {/* Progress Analytics */}
          <button
            id="walkthrough-analytics"
            onClick={() => navigate('/teacher/analytics')}
            aria-label="Progress Analytics"
            className="flex items-center gap-1.5 text-sm text-accent border border-accent/30 px-3 py-1 rounded-lg min-h-[48px] hover:bg-accent/10 transition-colors font-semibold"
          >
            <BarChart3 size={14} />
            <span className="hidden sm:inline">{language === 'HI' ? 'विश्लेषण' : 'Analytics'}</span>
          </button>
          {/* Special Educator Queue */}
          <button
            id="walkthrough-specialist-queue"
            onClick={() => navigate('/teacher/queue')}
            aria-label="Special Educator Queue"
            className="relative flex items-center gap-1.5 text-sm text-warm border border-warm/30 px-3 py-1 rounded-lg min-h-[48px] hover:bg-warm/10 transition-colors font-semibold"
          >
            <Stethoscope size={14} />
            <span className="hidden sm:inline">{language === 'HI' ? 'विशेषज्ञ कतार' : 'Specialist Queue'}</span>
            {pendingReferralCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center">
                {pendingReferralCount}
              </span>
            )}
          </button>
          {/* Resource Library */}
          <button
            id="walkthrough-resources"
            onClick={() => navigate('/teacher/resources')}
            aria-label="Resource Library"
            className="flex items-center gap-1.5 text-sm text-calm border border-calm/30 px-3 py-1 rounded-lg min-h-[48px] hover:bg-calm/10 transition-colors font-semibold"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">{language === 'HI' ? 'संसाधन' : 'Resources'}</span>
          </button>
          {/* Take a Tour */}
          <button
            onClick={() => setShowWalkthrough(true)}
            aria-label={language === 'HI' ? 'ऐप का दौरा करें' : 'Take a tour'}
            title={language === 'HI' ? 'ऐप का दौरा करें' : 'Take a tour of the dashboard'}
            className="flex items-center gap-1 text-sm text-muted border border-gray-200 px-3 py-1 rounded-lg min-h-[48px] hover:text-accent hover:border-accent/30 transition-colors"
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">{language === 'HI' ? 'दौरा' : 'Tour'}</span>
          </button>
          {/* Logout */}
          <button
            onClick={() => updateState({ teacherLoggedIn: false, teacherClassCode: null, teacherName: 'Ms. Lata' })}
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
        <div id="walkthrough-teacher-stats" className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
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
        <div id="walkthrough-teacher-filters" className="flex items-center justify-between gap-3 mb-4 flex-wrap">
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

        {/* ── Tier sub-filter (only when tab = 'tier') ───────────────────── */}
        {activeTab === 'tier' && (
          <div className="flex gap-2 mb-4 animate-fadeIn">
            {['all', '1', '2', '3'].map(t => (
              <motion.button
                key={t}
                onClick={() => setTierSubFilter(t)}
                whileTap={{ scale: 0.97 }}
                aria-label={`Filter by Tier ${t}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold min-h-[40px] border-2 transition-all ${
                  tierSubFilter === t
                    ? 'bg-calm text-white border-calm'
                    : 'bg-card text-muted border-gray-200 hover:border-calm'
                }`}
              >
                {t === 'all' ? (language === 'HI' ? 'सभी' : 'All') : tierShortLabel(Number(t), language)}
              </motion.button>
            ))}
          </div>
        )}

        {/* ── Student Grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student, cardIndex) => (
            <motion.div
              key={student.id}
              id={cardIndex === 0 ? 'walkthrough-student-card' : undefined}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bg-card rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow duration-200"
            >
              {/* Card header: status dot + support area badge + tier badge */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={statusDotClass[student.status] || 'status-dot bg-gray-400'}
                  aria-label={`Status: ${student.status}`}
                />
                <span className={supportAreaBadgeClass[student.primarySupportArea] || 'badge bg-gray-100 text-gray-600'}>
                  {supportAreaLabel(student.primarySupportArea, language)}
                </span>
                <span className={tierBadgeClass[student.tier] || 'badge bg-gray-100 text-gray-600'}>
                  {tierShortLabel(student.tier, language)}
                </span>
                <ReferralPill student={student} language={language} />
                <span className="ml-auto text-xs text-muted font-medium">
                  {language === 'HI' ? `कक्षा ${student.class}` : `Class ${student.class}`}
                </span>
              </div>

              {/* Student name */}
              <h2 className="text-base font-bold text-primary mb-1">{student.name}</h2>

              {/* Last active */}
              <p className="text-xs text-muted mb-1">
                {language === 'HI' ? 'अंतिम सक्रिय:' : 'Last active:'} {
                  (function(val) {
                    if (!val) return '-';
                    if (typeof val === 'string') return val;
                    if (val.toMillis) {
                      const diffHours = (Date.now() - val.toMillis()) / 3600000;
                      if (diffHours < 1) return language === 'HI' ? 'अभी-अभी' : 'just now';
                      if (diffHours < 24) return `${Math.floor(diffHours)} ${language === 'HI' ? 'घंटे पहले' : 'hours ago'}`;
                      return `${Math.floor(diffHours / 24)} ${language === 'HI' ? 'दिन पहले' : 'days ago'}`;
                    }
                    if (val.seconds) {
                      const diffHours = (Date.now() - (val.seconds * 1000)) / 3600000;
                      if (diffHours < 1) return language === 'HI' ? 'अभी-अभी' : 'just now';
                      if (diffHours < 24) return `${Math.floor(diffHours)} ${language === 'HI' ? 'घंटे पहले' : 'hours ago'}`;
                      return `${Math.floor(diffHours / 24)} ${language === 'HI' ? 'दिन पहले' : 'days ago'}`;
                    }
                    return String(val);
                  })(student.lastActive)
                }
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
              <div id={cardIndex === 0 ? 'walkthrough-iep-button' : undefined} className="flex gap-2 flex-wrap">
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
                {/* Refer to Special Educator — manual override always available;
                    only hidden once a referral already exists for this student. */}
                {(!student.referralStatus || student.referralStatus === 'none') && (
                  <motion.button
                    onClick={() => openReferralModal(student)}
                    whileTap={{ scale: 0.97 }}
                    aria-label={`Refer ${student.name} to Special Educator`}
                    className={`w-full text-xs font-semibold py-2 px-3 rounded-xl min-h-[44px] transition-colors shadow-sm flex items-center justify-center gap-1.5 ${
                      student.tier === 3
                        ? 'bg-warm text-white hover:bg-orange-600'
                        : 'bg-white text-warm border border-warm/30 hover:bg-warm/10'
                    }`}
                  >
                    <Stethoscope size={13} />
                    {language === 'HI' ? 'विशेष शिक्षक को रेफर करें' : 'Refer to Special Educator'}
                  </motion.button>
                )}
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
              onClick={() => { setActiveTab('all'); setTierSubFilter('all'); }}
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
                  <span className={supportAreaBadgeClass[activeStudent.primarySupportArea] || 'badge'}>
                    {supportAreaLabel(activeStudent.primarySupportArea, language)}
                  </span>
                  <span className={tierBadgeClass[activeStudent.tier] || 'badge'}>
                    {tierShortLabel(activeStudent.tier, language)}
                  </span>
                  <ReferralPill student={activeStudent} language={language} />
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
                          value={`${activeStudent.telemetry.rhymingSpeed ?? 0}s avg`}
                          barPercent={Math.max(0, 100 - ((activeStudent.telemetry.rhymingSpeed ?? 0) / 5) * 100)}
                          barColor="bg-accent"
                        />
                        <TelemetryStat
                          label={language === 'HI' ? 'ऑडियो सहायता उपयोग' : 'Audio Help Used'}
                          value={`${activeStudent.telemetry.audioHelpUsed ?? 0} ${language === 'HI' ? 'बार' : 'times'}`}
                          barPercent={Math.min(100, ((activeStudent.telemetry.audioHelpUsed ?? 0) / 10) * 100)}
                          barColor="bg-blue-400"
                        />
                        <TelemetryStat
                          label={language === 'HI' ? 'तुकबंदी सटीकता' : 'Rhyming Accuracy'}
                          value={`${activeStudent.telemetry.rhymingAccuracy ?? 0}%`}
                          barPercent={activeStudent.telemetry.rhymingAccuracy ?? 0}
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
                          value={`${activeStudent.telemetry.countingSpeed ?? 0}s avg`}
                          barPercent={Math.max(0, 100 - ((activeStudent.telemetry.countingSpeed ?? 0) / 5) * 100)}
                          barColor="bg-indigo-500"
                        />
                        <TelemetryStat
                          label={language === 'HI' ? 'गिनती सटीकता' : 'Counting Accuracy'}
                          value={`${activeStudent.telemetry.countingAccuracy ?? 0}%`}
                          barPercent={activeStudent.telemetry.countingAccuracy ?? 0}
                          barColor="bg-green-500"
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
                          value={`${activeStudent.telemetry.pathAccuracy ?? 0}px off-center`}
                          barPercent={Math.min(100, ((activeStudent.telemetry.pathAccuracy ?? 0) / 30) * 100)}
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

              {/* ── Section 3b: Teacher Observations (feeds the IEP) ──── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <User size={14} className="text-calm" />
                  {language === 'HI' ? 'शिक्षक टिप्पणियाँ' : 'Teacher Observations'}
                </h3>
                <div className="space-y-2">
                  {(activeStudent.teacherObservations || []).map((obs, i) => (
                    <div key={i} className="bg-surface rounded-xl p-3 border border-gray-100">
                      <p className="text-sm text-primary leading-snug">{obs.note}</p>
                      <p className="text-xs text-muted mt-1">{obs.author} · {obs.date}</p>
                    </div>
                  ))}
                  {(!activeStudent.teacherObservations || activeStudent.teacherObservations.length === 0) && (
                    <p className="text-xs text-muted italic">
                      {language === 'HI' ? 'अभी कोई टिप्पणी दर्ज नहीं' : 'No observations recorded yet'}
                    </p>
                  )}
                </div>
              </section>

              {/* ── Section 3c: Special Educator Referral (Priority 6) ──── */}
              <section>
                <h3 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Stethoscope size={14} className="text-warm" />
                  {language === 'HI' ? 'विशेष शिक्षक रेफरल' : 'Special Educator Referral'}
                </h3>

                {(!activeStudent.referralStatus || activeStudent.referralStatus === 'none') ? (
                  <div className="bg-surface rounded-xl p-3 border border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted">
                      {activeStudent.tier === 3
                        ? (language === 'HI'
                            ? 'यह छात्र स्तर 3 पर है — रेफरल पर विचार करें।'
                            : 'This student is Tier 3 — referral may be worth considering.')
                        : (language === 'HI' ? 'अभी कोई रेफरल नहीं भेजा गया।' : 'No referral has been submitted yet.')}
                    </p>
                    <button
                      onClick={() => openReferralModal(activeStudent)}
                      className="text-xs font-semibold text-warm border border-warm/30 px-3 py-1.5 rounded-lg hover:bg-warm/10 transition-colors flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Send size={12} />
                      {language === 'HI' ? 'रेफर करें' : 'Refer'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-surface rounded-xl p-3 border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <ReferralPill student={activeStudent} language={language} />
                      {activeStudent.referralDate && (
                        <span className="text-xs text-muted">{activeStudent.referralDate}</span>
                      )}
                    </div>
                    {activeStudent.teacherReferralReason && (
                      <p className="text-sm text-primary">{activeStudent.teacherReferralReason}</p>
                    )}
                    {activeStudent.referredBy && (
                      <p className="text-xs text-muted">— {activeStudent.referredBy}</p>
                    )}

                    {activeStudent.referralStatus === 'complete' && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
                          {language === 'HI' ? 'विशेषज्ञ सुझाव' : 'Specialist Recommendations'}
                        </p>
                        <ul className="space-y-1 mb-1">
                          {(activeStudent.specialEducatorRecommendations || []).map((rec, i) => (
                            <li key={i} className="text-xs text-primary flex items-start gap-1.5">
                              <CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                        {activeStudent.specialEducatorNotes && (
                          <p className="text-xs text-muted italic">{activeStudent.specialEducatorNotes}</p>
                        )}
                        <p className="text-xs text-muted mt-1">
                          — {activeStudent.specialEducatorReviewer || (language === 'HI' ? 'विशेष शिक्षक' : 'Special Educator')}
                          {activeStudent.reviewDate ? `, ${activeStudent.reviewDate}` : ''}
                        </p>
                        <p className="text-xs text-calm mt-2 flex items-center gap-1.5">
                          <ClipboardList size={12} />
                          {language === 'HI'
                            ? 'ये सुझाव अब IEP बनाते समय शामिल होंगे।'
                            : 'These are now included automatically when you generate an IEP.'}
                        </p>
                      </div>
                    )}

                    {(activeStudent.referralStatus === 'submitted' || activeStudent.referralStatus === 'under_review') && (
                      <button
                        onClick={() => navigate('/teacher/queue')}
                        className="text-xs font-semibold text-accent mt-1"
                      >
                        {language === 'HI' ? 'विशेषज्ञ कतार में देखें →' : 'View in Specialist Queue →'}
                      </button>
                    )}
                  </div>
                )}
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
                          ? 'AI द्वारा - कृपया समीक्षा करें'
                          : 'AI-generated - please review before acting'}
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
              <div className="pb-6 space-y-3">
                <button
                  onClick={() => navigate(`/teacher/observe/${activeStudent.id}`)}
                  aria-label={`Observation and tendencies for ${activeStudent.name}`}
                  className="w-full bg-accent text-white font-semibold py-3 px-6 rounded-xl min-h-[48px] hover:bg-blue-600 transition-colors shadow-sm"
                >
                  {activeStudent.screeningStatus === 'complete'
                    ? (language === 'HI' ? 'प्रवृत्तियाँ देखें' : 'View tendencies')
                    : (language === 'HI' ? 'अवलोकन भरें / प्रवृत्तियाँ →' : 'Observation & tendencies →')}
                </button>
                {activeStudent.referralStatus === 'complete' && (
                  <p className="text-xs text-calm text-center flex items-center justify-center gap-1.5">
                    <ClipboardList size={12} />
                    {language === 'HI'
                      ? 'विशेषज्ञ सुझाव इस IEP में स्वतः शामिल होंगे।'
                      : "Specialist recommendations will be included in this student's IEP automatically."}
                  </p>
                )}
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

      {/* ── PRIORITY 6: Refer to Special Educator modal ──────────────────── */}
      <AnimatePresence>
        {referralModalStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center px-4"
            onClick={() => setReferralModalStudent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Refer to Special Educator"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Stethoscope size={20} className="text-warm" />
                  <h2 className="text-lg font-bold text-primary">
                    {language === 'HI' ? 'विशेष शिक्षक को रेफर करें' : 'Refer to Special Educator'}
                  </h2>
                </div>
                <button
                  onClick={() => setReferralModalStudent(null)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-muted"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-muted mb-4">{referralModalStudent.name}</p>

              <label className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5 block">
                {language === 'HI' ? 'चिंता का कारण' : 'Reason for concern'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={referralReason}
                onChange={(e) => setReferralReason(e.target.value)}
                rows={3}
                placeholder={language === 'HI' ? 'क्यों आपको लगता है कि इसे विशेषज्ञ की राय चाहिए...' : 'Why do you feel this student needs specialist input...'}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 mb-4 focus:border-warm focus:outline-none resize-none"
              />

              <label className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5 block">
                {language === 'HI' ? 'अतिरिक्त टिप्पणियाँ (वैकल्पिक)' : 'Optional observations'}
              </label>
              <textarea
                value={referralNotes}
                onChange={(e) => setReferralNotes(e.target.value)}
                rows={2}
                placeholder={language === 'HI' ? 'कोई और जानकारी जो विशेषज्ञ को मदद कर सके...' : 'Anything else that might help the specialist...'}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 mb-4 focus:border-warm focus:outline-none resize-none"
              />

              <p className="text-xs text-muted mb-4">
                {language === 'HI'
                  ? 'यह छात्र को कोई निदान नहीं देता — यह केवल विशेषज्ञ समीक्षा के लिए एक अनुरोध है।'
                  : 'This does not diagnose the student — it only requests a specialist review.'}
              </p>

              <button
                onClick={submitReferral}
                disabled={!referralReason.trim() || submittingReferral}
                className="w-full bg-warm text-white font-semibold py-3 rounded-xl min-h-[48px] disabled:opacity-40 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                {submittingReferral ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {language === 'HI' ? 'रेफरल भेजें' : 'Submit Referral'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Teacher Walkthrough ───────────────────────────── */}
      {showWalkthrough && (
        <WalkthroughOverlay
          mode="teacher"
          lang={language}
          onComplete={handleWalkthroughComplete}
        />
      )}
    </Layout>
  );
}
