// src/pages/AchievementWall.jsx
// Route: /achievements
// Shows what students CAN do — emotionally positive only.
// Module 5 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS } from '../data';

export default function AchievementWall() {
  const { appState, updateState } = useApp();
  const { language, companion, streakDays } = appState;
  const S = STRINGS[language];

  return (
    <Layout
      title={`${S.achievementWall} 🏆`}
      showNav
      showBack
      showCompanion
      companionState="happy"
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
      companion={companion}
      streak={streakDays}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">{S.achievementWall} 🏆</p>
        <p className="text-sm mt-2">Achievement Wall — Module 5 will build this.</p>
      </div>
    </Layout>
  );
}
