// src/pages/ReadingRoom.jsx
// Route: /reading-room
// Core Dyslexia activity — Gemini-powered comprehension question.
// Module 3 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS } from '../data';

export default function ReadingRoom() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays } = appState;
  const S = STRINGS[language];

  return (
    <Layout
      title={`${S.readingRoom} 📖`}
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
        <p className="text-lg font-semibold text-primary">{S.readingRoom} 📖</p>
        <p className="text-sm mt-2">Dyslexia activity with Gemini — Module 3 will build this.</p>
      </div>
    </Layout>
  );
}
