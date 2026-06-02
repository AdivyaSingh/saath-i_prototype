// src/pages/Screening.jsx
// Route: /screening
// 3 mini-games that identify SLD type. Always framed as games, never as tests.
// Module 2 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';

export default function Screening() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays } = appState;

  return (
    <Layout
      title={language === 'HI' ? 'देखते हैं आपको सीखना कैसे पसंद है! 🎮' : "Let's see how YOU like to learn! 🎮"}
      showNav
      showBack
      showCompanion
      companionState="idle"
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
      companion={companion}
      streak={streakDays}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">Screening</p>
        <p className="text-sm mt-2">3 mini-games — Module 2 will build this.</p>
      </div>
    </Layout>
  );
}
