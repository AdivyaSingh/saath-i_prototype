// src/App.jsx
// Router + AppContext provider + all shared state.
// All pages are imported and routed here. No separate context file.

import { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Page imports
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import Screening from './pages/Screening';
import StudentHome from './pages/StudentHome';
import ReadingRoom from './pages/ReadingRoom';
import NumberWorld from './pages/NumberWorld';
import ExpressionStudio from './pages/ExpressionStudio';
import AchievementWall from './pages/AchievementWall';
import TeacherDashboard from './pages/TeacherDashboard';
import IEPGenerator from './pages/IEPGenerator';
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
  studentName: 'Arjun',          // pre-filled for demo
  studentClass: 4,
  sldType: null,                 // null until screening determines it
  language: 'EN',                // 'EN' | 'HI'
  companion: { id: 'owl', emoji: '🦉', nickname: 'Gyaan' },

  // Demo flags
  isDemoMode: true,              // when true, screening is tuned toward dyslexia for demo walkthrough
  showOfflineBanner: true,
  streakDays: 4,

  // Screening results (stored for teacher dashboard reference)
  screeningResults: null,

  // Activity progress tracking
  activitiesCompleted: {
    reading: 0,
    maths: 0,
    expression: 0,
  },

  // Teacher state
  teacherLoggedIn: false,
  teacherName: 'Ms. Lata',
  activeStudentId: null,         // which student's panel is open in dashboard
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
   * Reset state to defaults — useful for starting fresh demo.
   */
  const resetState = () => {
    localStorage.removeItem('saathi_state');
    setAppState(defaultState);
  };

  return (
    <AppContext.Provider value={{ appState, updateState, resetState }}>
      <BrowserRouter>
        <Routes>
          {/* Student journey */}
          <Route path="/" element={<Splash />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/screening" element={<Screening />} />
          <Route path="/home" element={<StudentHome />} />
          <Route path="/reading-room" element={<ReadingRoom />} />
          <Route path="/number-world" element={<NumberWorld />} />
          <Route path="/expression-studio" element={<ExpressionStudio />} />
          <Route path="/achievements" element={<AchievementWall />} />

          {/* Teacher journey */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/iep/:id" element={<IEPGenerator />} />
          <Route path="/teacher/resources" element={<ResourceLibrary />} />

          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}
