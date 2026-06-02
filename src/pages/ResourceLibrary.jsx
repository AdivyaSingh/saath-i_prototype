// src/pages/ResourceLibrary.jsx
// Route: /teacher/resources
// Browsable teaching materials filtered by SLD type and resource type.
// Module 7 will build this page fully.
// Placeholder: unblocks routing.

import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS } from '../data';

export default function ResourceLibrary() {
  const { appState, updateState } = useApp();
  const { language } = appState;
  const S = STRINGS[language];

  return (
    <Layout
      title="Resource Library 📚"
      showNav
      showBack
      showCompanion={false}
      isTeacherPage
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">Resource Library 📚</p>
        <p className="text-sm mt-2">Filterable resource cards — Module 7 will build this.</p>
      </div>
    </Layout>
  );
}
