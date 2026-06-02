// src/pages/Splash.jsx
// Route: /
// Module 1 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';

export default function Splash() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays } = appState;

  return (
    <Layout
      showNav={false}
      showCompanion={false}
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
      companion={companion}
      streak={streakDays}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">Saath-i</p>
        <p className="text-sm mt-2">Splash page — Module 1 will build this.</p>
      </div>
    </Layout>
  );
}
