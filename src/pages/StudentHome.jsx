// src/pages/StudentHome.jsx
// Route: /home
// Daily landing screen — activities, streak, companion, "I'm struggling" button.
// Module 2 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS } from '../data';

export default function StudentHome() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays, studentName } = appState;
  const S = STRINGS[language];

  return (
    <Layout
      title={S.todaysJourney}
      showNav
      showBack={false}
      showCompanion
      companionState="idle"
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
      companion={companion}
      streak={streakDays}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">
          {S.goodMorning}, {studentName}! 👋
        </p>
        <p className="text-sm mt-2">Student Home — Module 2 will build this.</p>
      </div>
    </Layout>
  );
}
