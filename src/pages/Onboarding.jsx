// src/pages/Onboarding.jsx
// Route: /onboarding
// Two-step flow: profile setup (Step 1) + companion selection (Step 2).
// Module 1 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';

export default function Onboarding() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays } = appState;

  return (
    <Layout
      title="Set Up"
      showNav
      showBack={false}
      showCompanion={false}
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
      companion={companion}
      streak={streakDays}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">Onboarding</p>
        <p className="text-sm mt-2">Profile setup + companion selection — Module 1 will build this.</p>
      </div>
    </Layout>
  );
}
