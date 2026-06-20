// src/pages/IEPGenerator.jsx
// Route: /teacher/iep/:id
// Purpose: End-to-end IEP creation - the single most impactful teacher feature.
// 4-step flow: Data Summary → Generating (Gemini) → Preview & Approve → Success

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Check, Edit3, Download, ArrowLeft,
  Loader2, CheckCircle2, User, AlertTriangle, Search,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { DEMO_STUDENTS, STRINGS, SUPPORT_AREAS } from '../data';
import { generateIEP } from '../gemini';
import { subscribeToStudents } from '../firebase';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Support area badge CSS classes from index.css
const supportAreaBadgeClass = {
  reading:      'badge badge-reading',
  writing:      'badge badge-writing',
  numeracy:     'badge badge-numeracy',
  attention:    'badge badge-attention',
  memory:       'badge badge-memory',
  organisation: 'badge badge-organisation',
};

const tierBadgeClass = {
  1: 'badge badge-tier-1',
  2: 'badge badge-tier-2',
  3: 'badge badge-tier-3',
};

const supportAreaLabel = (areaId, language) => {
  const area = SUPPORT_AREAS.find(a => a.id === areaId);
  if (!area) return language === 'HI' ? 'सहायता चाहिए' : 'Support needed';
  return language === 'HI' ? area.labelHI : area.labelEN;
};

const tierShortLabel = (tier, language) => {
  const n = tier || 1;
  return language === 'HI' ? `स्तर ${n}` : `Tier ${n}`;
};

// Parse Gemini markdown into sections split by "## Heading"
const parseIEPSections = (text) => {
  if (!text) return [];
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.replace('## ', '').trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
};

// Format today's date as "2 June 2025"
const todayFormatted = () =>
  new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

// ─── STEP INDICATORS (bilingual) ──────────────────────────────────────────────
const LOADING_STEPS_EN = [
  'Student profile compiled',
  'Performance summary written',
  'SMART goals generated',
  'Accommodations selected',
  'IEP ready for review',
];

const LOADING_STEPS_HI = [
  'छात्र प्रोफ़ाइल संकलित',
  'प्रदर्शन सारांश लिखा गया',
  'SMART लक्ष्य तैयार',
  'अनुकूलन चुने गए',
  'IEP समीक्षा के लिए तैयार',
];

// ─── STEP LABELS ──────────────────────────────────────────────────────────────
const STEP_LABELS = {
  EN: ['Data Summary', 'Generating', 'Preview & Approve', 'Saved'],
  HI: ['डेटा सारांश', 'तैयार हो रहा', 'पूर्वावलोकन', 'सहेजा गया'],
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function IEPGenerator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const { language, teacherName } = appState;
  const S = STRINGS[language];

  // ── Firebase subscription ──
  const [firebaseStudents, setFirebaseStudents] = useState([]);
  
  useEffect(() => {
    const unsubscribe = subscribeToStudents((students) => {
      setFirebaseStudents(students);
    });
    return () => unsubscribe();
  }, []);

  const demoIds = new Set(DEMO_STUDENTS.map(s => s.id));
  const allStudents = [
    ...DEMO_STUDENTS,
    ...firebaseStudents.filter(s => !demoIds.has(s.id))
  ];

  const student = allStudents.find(s => s.id === id);

  // Step state: 1 = Data Summary, 2 = Generating, 3 = Preview & Approve, 4 = Success
  const [currentStep, setCurrentStep] = useState(1);
  const [iepText, setIepText]         = useState('');
  const [iepSections, setIepSections] = useState([]);
  const [loadedSteps, setLoadedSteps] = useState([]);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionTexts, setSectionTexts]     = useState([]);
  const [signature, setSignature]           = useState(teacherName || 'Ms. Lata');
  // apiUsed: null = not yet called, true = real Gemini succeeded, false = used fallback
  const [apiUsed, setApiUsed]               = useState(null);

  // Derived data for Step 1 summary
  const mastered   = student ? Object.entries(student.masteryMap).filter(([, v]) => v === 'mastered').map(([k]) => k) : [];
  // Support areas come straight from the support profile (areas at 'some' or 'high'),
  // so this section can never disagree with the tier, the primary support area, or the
  // error patterns shown below. This removes the old "None identified" contradiction.
  const LEVEL_ORDER = { high: 2, some: 1, low: 0 };
  const supportAreas = (student && student.supportProfile)
    ? SUPPORT_AREAS
        .filter(a => student.supportProfile[a.id] === 'some' || student.supportProfile[a.id] === 'high')
        .map(a => ({ id: a.id, level: student.supportProfile[a.id] }))
        .sort((x, y) => LEVEL_ORDER[y.level] - LEVEL_ORDER[x.level])
    : [];
  // Specific still-developing skills (from mastery data), shown as supporting detail
  // under the support areas. Includes both 'struggling' and 'not_started' concepts.
  const focusSkills = student
    ? Object.entries(student.masteryMap).filter(([, v]) => v === 'struggling' || v === 'not_started').map(([k]) => k)
    : [];

  // Loading steps based on language
  const loadingSteps = language === 'HI' ? LOADING_STEPS_HI : LOADING_STEPS_EN;

  // ── Start generation: advance to Step 2 and fire Gemini call ───────────
  const startGeneration = async () => {
    setCurrentStep(2);
    setLoadedSteps([]);
    setApiUsed(null);

    // Stagger the progress indicator steps (1000ms each)
    loadingSteps.forEach((_, i) => {
      setTimeout(() => {
        setLoadedSteps(prev => [...prev, i]);
      }, (i + 1) * 1000);
    });

    // Minimum display time so all steps are always visible
    const minDisplayTime = loadingSteps.length * 1000 + 600;
    const minWaitPromise = new Promise(resolve => setTimeout(resolve, minDisplayTime));

    // Fire Gemini call
    const geminiResult = await generateIEP(student);

    // Mark whether we got a real response or fell back
    setApiUsed(geminiResult !== null);
    const text = geminiResult || getFallbackIEP(student);

    // Wait for BOTH: Gemini done AND minimum display time elapsed
    await minWaitPromise;

    const sections = parseIEPSections(text);
    setIepText(text);
    setIepSections(sections);
    setSectionTexts(sections.map(s => s.body.trim()));
    setCurrentStep(3);
  };

  // ── Approve IEP - single action from Step 3 → Step 4 ───────────────────
  const handleApprove = () => {
    setCurrentStep(4);
  };

  // ── Guard: student not found ────────────────────────────────────────────
  if (!student) {
    return (
      <Layout
        title="IEP Generator"
        showNav showBack
        showCompanion={false}
        isTeacherPage
        lang={language}
        setLanguage={(lang) => updateState({ language: lang })}
      >
        <div className="text-center py-16 animate-fadeIn">
          <Search size={48} className="text-muted mx-auto mb-4 opacity-50" />
          <p className="text-primary font-semibold text-lg">
            {language === 'HI' ? 'छात्र नहीं मिला' : 'Student not found'}
          </p>
          <button
            onClick={() => navigate('/teacher')}
            aria-label="Back to dashboard"
            className="btn-calm mt-4"
          >
            <ArrowLeft size={16} />
            {language === 'HI' ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}
          </button>
        </div>
      </Layout>
    );
  }

  // ── Step labels ─────────────────────────────────────────────────────────
  const stepLabels = STEP_LABELS[language] || STEP_LABELS.EN;

  return (
    <Layout
      title={`${S.generateIEP} - ${student.name}`}
      showNav
      showBack
      showCompanion={false}
      isTeacherPage
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
    >
      {/* ── Subtle API status dot (bottom-left, only visible after generation) ── */}
      {apiUsed !== null && (
        <div
          className="fixed bottom-4 left-4 z-50 flex items-center gap-1.5"
          title={apiUsed ? 'Gemini API: live response' : 'Gemini API: fallback used'}
        >
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${apiUsed ? 'bg-green-500' : 'bg-orange-400'}`} />
        </div>
      )}

      {/* ── Step Progress Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-6">
        {[1, 2, 3, 4].map(step => (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                  currentStep > step
                    ? 'bg-success text-white'
                    : currentStep === step
                    ? 'bg-calm text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step ? <Check size={14} /> : step}
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                currentStep >= step ? 'text-primary' : 'text-muted'
              }`}>
                {stepLabels[step - 1]}
              </span>
            </div>
            {step < 4 && (
              <div className={`flex-1 h-1 rounded-full transition-all duration-500 mb-4 ${currentStep > step ? 'bg-success' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 1 - DATA SUMMARY
          ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="animate-fadeIn">
          {(() => {
            const dataWeeks = Array.isArray(student.progressHistory) ? student.progressHistory.length : 0;
            const windowLabelEN = dataWeeks > 0 ? `the last ${dataWeeks} week${dataWeeks === 1 ? '' : 's'}` : 'limited app activity so far';
            const windowLabelHI = dataWeeks > 0 ? `पिछले ${dataWeeks} हफ्तों` : 'अभी सीमित ऐप गतिविधि';
            return (
              <>
                <h1 className="text-xl font-bold text-primary mb-1">
                  {language === 'HI'
                    ? `${student.name} के ${windowLabelHI} के डेटा के आधार पर:`
                    : `Based on ${student.name}'s data from ${windowLabelEN}:`}
                </h1>
                <p className="text-sm text-muted mb-5">
                  {language === 'HI'
                    ? `${windowLabelHI} का ऐप डेटा एकत्र किया गया, साथ ही शिक्षक टिप्पणियाँ`
                    : `${dataWeeks > 0 ? `${dataWeeks} week${dataWeeks === 1 ? '' : 's'}` : 'Limited'} of app data collected, plus teacher observations`}
                </p>
              </>
            );
          })()}

          {/* Data summary card */}
          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
            {/* Student header */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={24} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-primary text-lg leading-tight">{student.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={supportAreaBadgeClass[student.primarySupportArea] || 'badge bg-gray-100 text-gray-600'}>
                    {supportAreaLabel(student.primarySupportArea, language)}
                  </span>
                  <span className={tierBadgeClass[student.tier] || 'badge bg-gray-100 text-gray-600'}>
                    {tierShortLabel(student.tier, language)}
                  </span>
                  <span className="text-xs text-muted">
                    {language === 'HI' ? `कक्षा ${student.class}` : `Class ${student.class}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Strengths */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                <span>{language === 'HI' ? 'ताकत (सीखा गया)' : 'Strengths (Mastered)'}</span>
              </p>
              {mastered.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mastered.map(c => (
                    <span key={c} className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1.5 rounded-xl border border-green-200">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">
                  {language === 'HI' ? 'अभी कोई नहीं' : 'None yet'}
                </p>
              )}
            </div>

            {/* Support areas — derived from the support profile so this can never
                contradict the tier, the primary support area, or the error patterns below. */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-warm mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>{language === 'HI' ? 'सहायता क्षेत्र' : 'Support Areas'}</span>
              </p>
              {supportAreas.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {supportAreas.map(a => (
                      <span key={a.id} className="bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1.5 rounded-xl border border-orange-200">
                        {supportAreaLabel(a.id, language)}
                        <span className="text-orange-500 ml-1">
                          {a.level === 'high'
                            ? (language === 'HI' ? '· अधिक' : '· higher')
                            : (language === 'HI' ? '· कुछ' : '· some')}
                        </span>
                      </span>
                    ))}
                  </div>
                  {focusSkills.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted mr-1">
                        {language === 'HI' ? 'विशेष कौशल:' : 'Specific skills:'}
                      </span>
                      {focusSkills.map(c => (
                        <span key={c} className="bg-surface text-muted text-xs px-2 py-1 rounded-lg border border-gray-200">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted">
                  {language === 'HI'
                    ? 'कक्षा-स्तरीय सहायता — ताकत बनाए रखें और निगरानी करें (स्तर 1)'
                    : 'Classroom-level support — monitor and reinforce strengths (Tier 1)'}
                </p>
              )}
            </div>

            {/* Error patterns */}
            <div>
              <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                <Search size={14} className="text-muted" />
                <span>{language === 'HI' ? 'त्रुटि पैटर्न' : 'Key Error Patterns'}</span>
              </p>
              <ul className="space-y-1.5">
                {student.errorPatterns.map((ep, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-primary">
                    <span className="text-muted flex-shrink-0 mt-0.5">•</span>
                    <span>{ep.pattern} <span className="text-muted">({ep.frequency})</span></span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Teacher observations */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                <User size={14} className="text-calm" />
                <span>{language === 'HI' ? 'शिक्षक टिप्पणियाँ' : 'Teacher Observations'}</span>
              </p>
              {(student.teacherObservations && student.teacherObservations.length > 0) ? (
                <ul className="space-y-1.5">
                  {student.teacherObservations.map((obs, i) => (
                    <li key={i} className="text-xs text-primary">
                      <span>{obs.note}</span>
                      <span className="text-muted"> — {obs.author}, {obs.date}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted italic">
                  {language === 'HI' ? 'अभी कोई टिप्पणी दर्ज नहीं' : 'No observations recorded yet'}
                </p>
              )}
            </div>

            {/* Specialist notes - only shown if present */}
            {student.specialistNotes && student.specialistNotes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-calm" />
                  <span>{language === 'HI' ? 'विशेषज्ञ टिप्पणियाँ' : 'Specialist Notes'}</span>
                </p>
                <ul className="space-y-1.5">
                  {student.specialistNotes.map((note, i) => (
                    <li key={i} className="text-xs text-primary">
                      <span>{note.note}</span>
                      <span className="text-muted"> — {note.author}, {note.date}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirmation question */}
          <p className="text-base font-semibold text-primary mb-4 text-center">
            {language === 'HI' ? 'क्या यह सही दिखता है?' : 'Does this look right?'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={startGeneration}
              aria-label="Yes, generate IEP"
              className="flex-1 btn-calm"
            >
              <Check size={16} />
              {language === 'HI' ? 'हाँ, IEP बनाएं' : 'Yes, generate IEP'}
            </button>
            <button
              onClick={() => navigate('/teacher')}
              aria-label="Go back to edit"
              className="flex-1 btn-ghost"
            >
              <Edit3 size={16} />
              {language === 'HI' ? 'पहले संपादित करें' : 'Edit first'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 2 - GENERATING (Gemini loading)
          ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="text-center py-6 animate-fadeIn">
          {/* Companion in encouraging state */}
          <div className="companion-container encouraging mx-auto mb-4">
            {student.companion?.emoji || '🦉'}
          </div>

          <h2 className="text-xl font-semibold text-primary mb-2">
            {language === 'HI'
              ? 'NIEPID-अनुरेखित IEP बनाई जा रही है...'
              : 'Generating NIEPID-aligned IEP...'}
          </h2>
          <p className="text-muted text-sm mb-8">
            {language === 'HI'
              ? 'यह शिक्षकों को 3–4 घंटे लेता है। Saath-i इसे 2 मिनट में करता है।'
              : 'This usually takes teachers 3–4 hours. Saath-i does it in under 2 minutes.'}
          </p>

          {/* Staggered progress steps */}
          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 p-5 text-left max-w-md mx-auto">
            {loadingSteps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 py-2.5 transition-all duration-500 ${
                  loadedSteps.includes(i) ? 'opacity-100' : 'opacity-20'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-colors duration-300 ${
                  loadedSteps.includes(i) ? 'bg-success text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {loadedSteps.includes(i) ? <Check size={12} /> : (i + 1)}
                </span>
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  loadedSteps.includes(i) ? 'text-primary' : 'text-muted'
                }`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 3 - PREVIEW & APPROVE (combined - no separate Step 4 approve)
          ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <FileText size={18} className="text-calm" />
              {language === 'HI' ? 'IEP पूर्वावलोकन' : 'IEP Preview'}
            </h2>
            <span className="text-xs bg-success/10 text-success font-semibold px-3 py-1 rounded-full border border-success/20">
              {language === 'HI' ? 'AI-जनित' : 'AI-generated'}
            </span>
          </div>

          {/* Document-style card */}
          <div className="bg-card rounded-2xl shadow-md border border-gray-100 overflow-hidden mb-5">
            {/* Letterhead */}
            <div className="bg-gradient-to-r from-primary to-accent px-6 py-4">
              <p className="text-white font-bold text-base tracking-wide">
                SAATHI - Individualised Education Plan
              </p>
              <p className="text-blue-200 text-xs mt-0.5">{student.school}</p>
              <p className="text-blue-100 text-xs mt-0.5">
                Prepared for: <span className="font-semibold">{student.name}</span> &nbsp;|&nbsp; Date: {todayFormatted()}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {iepSections.length > 0 ? (
                iepSections.map((section, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* Section heading */}
                    <div className="bg-surface px-4 py-2 flex items-center justify-between">
                      <p className="text-sm font-bold text-primary">{section.heading}</p>
                      <button
                        onClick={() => setEditingSection(editingSection === i ? null : i)}
                        aria-label={editingSection === i ? `Save ${section.heading}` : `Edit ${section.heading}`}
                        className="flex items-center gap-1 text-xs text-calm font-semibold border border-calm/30 px-2 py-0.5 rounded-lg hover:bg-teal-50 transition-colors min-h-[28px]"
                      >
                        {editingSection === i ? (
                          <><Check size={12} /> {language === 'HI' ? 'सहेजें' : 'Save'}</>
                        ) : (
                          <><Edit3 size={12} /> {language === 'HI' ? 'संपादित करें' : 'Edit'}</>
                        )}
                      </button>
                    </div>
                    {/* Section body */}
                    <div className="px-4 py-3">
                      {editingSection === i ? (
                        <textarea
                          value={sectionTexts[i] || ''}
                          onChange={e => {
                            const updated = [...sectionTexts];
                            updated[i] = e.target.value;
                            setSectionTexts(updated);
                          }}
                          rows={Math.max(3, (sectionTexts[i] || '').split('\n').length + 1)}
                          className="w-full text-sm text-primary border border-calm/30 rounded-lg p-2 bg-white focus:outline-none focus:border-calm resize-y"
                          aria-label={`Edit ${section.heading}`}
                        />
                      ) : (
                        <p className="text-sm text-primary whitespace-pre-line leading-relaxed">
                          {sectionTexts[i] || section.body.trim()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                // Fallback if Gemini returned unparseable text
                <div className="border border-gray-100 rounded-xl p-4">
                  <p className="text-sm text-primary whitespace-pre-line leading-relaxed">{iepText}</p>
                </div>
              )}

              {/* Signature area */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <p className="text-xs text-muted mb-1 font-semibold">
                    {language === 'HI' ? 'शिक्षक हस्ताक्षर:' : 'Teacher Signature:'}
                  </p>
                  <input
                    type="text"
                    value={signature}
                    onChange={e => setSignature(e.target.value)}
                    placeholder="Ms. Lata"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-primary focus:border-calm focus:outline-none min-h-[40px]"
                    aria-label="Teacher signature"
                  />
                </div>
                <p className="text-xs text-muted">
                  {language === 'HI'
                    ? `अनुमोदित: ${teacherName || 'Ms. Lata'} | तारीख: ${todayFormatted()}`
                    : `Approved by: ${teacherName || 'Ms. Lata'} | Date: ${todayFormatted()}`}
                </p>
              </div>
            </div>
          </div>

          {/* Approve IEP - single button that approves AND advances to success */}
          <button
            onClick={handleApprove}
            aria-label="Approve and save IEP"
            className="w-full btn-calm mb-3"
          >
            <Check size={16} />
            {language === 'HI' ? 'IEP अनुमोदित करें' : 'Approve IEP'}
          </button>
          <button
            onClick={() => setCurrentStep(1)}
            aria-label="Back to data summary"
            className="w-full btn-ghost"
          >
            <ArrowLeft size={16} />
            {language === 'HI' ? 'पुनः उत्पन्न करें' : 'Regenerate'}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          STEP 4 - SUCCESS (post-approve confirmation)
          ═══════════════════════════════════════════════════════════════════ */}
      {currentStep === 4 && (
        <div className="text-center py-8 animate-fadeIn">
          {/* Success illustration */}
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 size={40} className="text-success" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">
            {language === 'HI' ? 'IEP तैयार है!' : 'IEP Ready!'}
          </h2>
          <p className="text-muted text-sm mb-2">
            {language === 'HI'
              ? `${student.name} की प्रोफाइल में IEP सहेजी गई`
              : `IEP saved to ${student.name}'s profile`}
          </p>
          <p className="text-xs text-muted mb-8">
            {language === 'HI'
              ? 'PDF डाउनलोड पूर्ण ऐप में उपलब्ध होगी'
              : 'PDF download will be available in the full app'}
          </p>

          {/* Summary of what was approved */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-left mb-6 max-w-sm mx-auto">
            <p className="text-sm font-semibold text-primary mb-2">
              {language === 'HI' ? 'IEP सारांश' : 'IEP Summary'}
            </p>
            <div className="space-y-1.5 text-xs text-muted">
              <p className="flex items-center gap-2">
                <User size={12} className="flex-shrink-0" />
                {language === 'HI' ? 'छात्र:' : 'Student:'} <span className="text-primary font-semibold">{student.name}</span>
              </p>
              <p className="flex items-center gap-2">
                <FileText size={12} className="flex-shrink-0" />
                {language === 'HI' ? 'सहायता क्षेत्र:' : 'Support Area:'} <span className="text-primary font-semibold">{supportAreaLabel(student.primarySupportArea, language)} ({tierShortLabel(student.tier, language)})</span>
              </p>
              <p className="flex items-center gap-2">
                <FileText size={12} className="flex-shrink-0" />
                {language === 'HI' ? 'तारीख:' : 'Date:'} <span className="text-primary font-semibold">{todayFormatted()}</span>
              </p>
              <p className="flex items-center gap-2">
                <Edit3 size={12} className="flex-shrink-0" />
                {language === 'HI' ? 'हस्ताक्षर:' : 'Signed by:'} <span className="text-primary font-semibold">{signature}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3 max-w-sm mx-auto">
            <button
              onClick={() => navigate('/teacher')}
              aria-label="Back to teacher dashboard"
              className="flex-1 btn-calm"
            >
              <ArrowLeft size={16} />
              {language === 'HI' ? 'डैशबोर्ड' : 'Dashboard'}
            </button>
            <button
              onClick={() => {
                // Simulate PDF download
              }}
              aria-label="Download IEP as PDF"
              className="flex-1 btn-ghost"
            >
              <Download size={16} />
              {language === 'HI' ? 'PDF डाउनलोड' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-8" />
    </Layout>
  );
}

// ─── FALLBACK IEP (if Gemini API is unavailable / key not set) ────────────────
function getFallbackIEP(student) {
  const today = new Date();
  const reviewDate = new Date(today);
  reviewDate.setMonth(reviewDate.getMonth() + 3);
  const reviewStr = reviewDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const areaNames = { reading: 'reading', writing: 'writing', numeracy: 'numeracy', attention: 'attention', memory: 'memory', organisation: 'organisation' };
  const primaryArea = areaNames[student.primarySupportArea] || 'reading';
  const tierPhrase = student.tier === 3
    ? 'specialist referral support'
    : student.tier === 2
    ? 'targeted intervention support'
    : 'classroom support';

  const observationLine = (student.teacherObservations && student.teacherObservations.length > 0)
    ? ` Teacher observations note: "${student.teacherObservations[student.teacherObservations.length - 1].note}"`
    : '';

  return `## Student Performance Summary
${student.name} is a Class ${student.class} student at ${student.school} who may benefit from ${tierPhrase}, primarily in ${primaryArea}. They demonstrate enthusiasm and effort during learning activities, and show particular strength in oral comprehension when audio support is provided.${observationLine}

## Learning Objectives
1. ${student.name} will correctly identify and read 40 out of 50 sight words with 80% accuracy within 3 months, using audio-assisted learning tools.
2. ${student.name} will demonstrate syllable-segmentation skills for two-syllable words with 75% accuracy in structured reading sessions by the end of term.
3. ${student.name} will complete at least 3 reading comprehension activities per week using the Saath-i app, showing sustained engagement for a minimum of 15 minutes per session.

## Recommended Accommodations
1. Offer oral examination as an alternative to all written tests; record responses using Saath-i's voice mode.
2. Provide printed notes and worksheets using OpenDyslexic or Arial 14pt+ font.
3. Allow extended time (1.5x) on all reading and writing tasks.
4. Use a line guide or screen reader to support tracking during reading aloud activities.
5. Acknowledge effort verbally at the start and end of each session; avoid comparative grading.

## Review Date
This IEP will be reviewed on ${reviewStr}.

## Teacher Notes
To be completed by ${student.school.split(',')[0] || '[teacher name]'}.`;
}
