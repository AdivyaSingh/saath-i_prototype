// src/pages/TeacherDashboard.jsx
// Route: /teacher
// Two states in one file: Login (teacherLoggedIn === false) + Dashboard (teacherLoggedIn === true).
// Student profile opens as a slide-in panel within this page — no separate route.
// Module 6 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS } from '../data';

export default function TeacherDashboard() {
  const { appState, updateState } = useApp();
  const { language, teacherLoggedIn, teacherName } = appState;
  const S = STRINGS[language];

  return (
    <Layout
      title={S.teacherDashboard}
      showNav
      showBack={false}
      showCompanion={false}
      isTeacherPage
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">{S.teacherDashboard}</p>
        <p className="text-sm mt-2">
          {teacherLoggedIn
            ? `Logged in as ${teacherName} — Module 6 will build this.`
            : 'Login form + dashboard — Module 6 will build this.'}
        </p>
      </div>
    </Layout>
  );
}
