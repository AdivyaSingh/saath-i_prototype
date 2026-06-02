// src/pages/IEPGenerator.jsx
// Route: /teacher/iep/:id
// 4-step flow with real Gemini IEP generation.
// Module 7 will build this page fully.
// Placeholder: unblocks routing.

import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { STRINGS, DEMO_STUDENTS } from '../data';

export default function IEPGenerator() {
  const { id } = useParams();
  const { appState, updateState } = useApp();
  const { language } = appState;
  const S = STRINGS[language];

  const student = DEMO_STUDENTS.find(s => s.id === id);

  return (
    <Layout
      title={`${S.generateIEP}${student ? ` — ${student.name}` : ''}`}
      showNav
      showBack
      showCompanion={false}
      isTeacherPage
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
    >
      <div className="p-8 text-center text-muted">
        <p className="text-lg font-semibold text-primary">{S.generateIEP}</p>
        {student && (
          <p className="text-sm mt-1 text-accent font-medium">Student: {student.name}</p>
        )}
        <p className="text-sm mt-2">4-step IEP flow with Gemini — Module 7 will build this.</p>
      </div>
    </Layout>
  );
}
