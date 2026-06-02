// src/pages/ExpressionStudio.jsx
// Route: /expression-studio
// Dysgraphia activity — voice, canvas drawing, word tiles.
// Module 4 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS } from '../data';

export default function ExpressionStudio() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays } = appState;
  const S = STRINGS[language];

  return (
    <Layout
      title={`${S.expressionStudio} 🎨`}
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
        <p className="text-lg font-semibold text-primary">{S.expressionStudio} 🎨</p>
        <p className="text-sm mt-2">Dysgraphia activity — Module 4 will build this.</p>
      </div>
    </Layout>
  );
}
