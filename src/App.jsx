// src/App.jsx
// Router + AppContext provider + all shared state.
// All pages are imported and routed here. No separate context file.

import { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { seedDemoData } from './firebase';

// Page imports
import Splash          from './pages/Splash';
import Onboarding      from './pages/Onboarding';
import ReturnStudent   from './pages/ReturnStudent';
import Screening       from './pages/Screening';
import StudentHome     from './pages/StudentHome';
import ReadingRoom     from './pages/ReadingRoom';
import NumberWorld     from './pages/NumberWorld';
import ExpressionStudio from './pages/ExpressionStudio';
import AchievementWall from './pages/AchievementWall';
import TeacherDashboard from './pages/TeacherDashboard';
import IEPGenerator    from './pages/IEPGenerator';
import ResourceLibrary from './pages/ResourceLibrary';

// ─── APP CONTEXT ──────────────────────────────────────────────────────────────
export const AppContext = createContext(null);

/**
 * Convenience hook — use this in every page instead of importing AppContext directly.
 * Usage: const { appState, updateState } = useApp();
 */
export const useApp = () => useContext(AppContext);

// ─── DEFAULT STATE ─────────────────────────────────────────────────────────────
const defaultState = {
  // Student profile
  studentName:  null,   // null = not yet registered
  studentClass: null,
  sldType:      null,   // null until screening determines it
  language:    'EN',    // 'EN' | 'HI'
  companion:    null,   // null until companion is chosen

  // Student identity (PIN-based, class-code-linked)
  classCode:        null, // The class code this student belongs to (e.g. 'SCH001')
  studentId:        null, // Deterministic Firestore document ID (e.g. 'arjun-sch001')
  firebaseStudentId: null, // Alias for studentId — kept for backward compat with activity pages
  studentPin:       null, // 4-digit PIN set during registration (MVP: stored in state)

  // Demo flags
  isDemoMode:       true,
  showOfflineBanner: true,
  streakDays:       0,   // 0 = fresh start; computed from activity history in production

  // Screening results
  screeningResults: null,

  // Activity progress tracking
  activitiesCompleted: {
    reading:    0,
    maths:      0,
    expression: 0,
  },

  // Teacher state
  teacherLoggedIn:  false,
  teacherName:     'Ms. Lata',
  teacherClassCode: null, // The class code of the logged-in teacher
  activeStudentId:  null, // which student's panel is open in dashboard
};

// ─── 404 PAGE ──────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="text-center animate-fadeIn">
        <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
        <p className="text-muted text-lg mb-6">Page not found</p>
        <a href="/" className="btn-primary">Go to Home</a>
      </div>
    </div>
  );
}

// ─── APP COMPONENT ─────────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState(() => {
    // Try to rehydrate from localStorage
    try {
      const saved = localStorage.getItem('saathi_state');
      return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
    } catch {
      return defaultState;
    }
  });

  /**
   * Update one or more fields in appState and persist to localStorage.
   * Usage: updateState({ language: 'HI' })
   */
  const updateState = (updates) => {
    setAppState(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('saathi_state', JSON.stringify(next));
      return next;
    });
  };

  /**
   * Reset state to defaults — useful for logging out or starting a fresh demo.
   */
  const resetState = () => {
    localStorage.removeItem('saathi_state');
    setAppState(defaultState);
  };

  // Seed Firestore with demo class SCH001 + teacher Ms. Lata on first load
  useEffect(() => {
    seedDemoData().catch(console.error);
  }, []);

  return (
    <AppContext.Provider value={{ appState, updateState, resetState }}>
      <BrowserRouter>
        <Routes>
          {/* Student journey */}
          <Route path="/"                  element={<Splash />} />
          <Route path="/onboarding"        element={<Onboarding />} />
          <Route path="/return"            element={<ReturnStudent />} />
          <Route path="/screening"         element={<Screening />} />
          <Route path="/home"              element={<StudentHome />} />
          <Route path="/reading-room"      element={<ReadingRoom />} />
          <Route path="/number-world"      element={<NumberWorld />} />
          <Route path="/expression-studio" element={<ExpressionStudio />} />
          <Route path="/achievements"      element={<AchievementWall />} />

          {/* Teacher journey */}
          <Route path="/teacher"           element={<TeacherDashboard />} />
          <Route path="/teacher/iep/:id"   element={<IEPGenerator />} />
          <Route path="/teacher/resources" element={<ResourceLibrary />} />

          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}
