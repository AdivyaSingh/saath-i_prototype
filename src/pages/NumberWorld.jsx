// src/pages/NumberWorld.jsx
// Route: /number-world
// Dyscalculia activity — object-first maths, no timers.
// Module 4 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS } from '../data';

export default function NumberWorld() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays } = appState;
  const S = STRINGS[language];

  return (
    <Layout
      title={`${S.numberWorld} 🔢`}
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
        <p className="text-lg font-semibold text-primary">{S.numberWorld} 🔢</p>
        <p className="text-sm mt-2">Dyscalculia activity — Module 4 will build this.</p>
      </div>
    </Layout>
  );
}
