// src/pages/Onboarding.jsx
// Route: /onboarding
// Two-step flow: profile setup (Step 1) + companion selection (Step 2).
// Module 1 will build this page fully.
// Placeholder: unblocks routing.

// src/pages/Onboarding.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, ChevronRight, Link2 } from 'lucide-react';
import { useApp } from '../App';
import { COMPANIONS, STRINGS } from '../data';
import Layout from '../components/Layout';

// ─── Language options (not in data.js — these are meta-UI choices) ───────────
const LANGUAGE_OPTIONS = [
  { code: 'HI', label: 'Hindi',   script: 'हिंदी'   },
  { code: 'EN', label: 'English', script: 'English'  },
  { code: 'BN', label: 'Bengali', script: 'বাংলা'    },
  { code: 'TA', label: 'Tamil',   script: 'தமிழ்'    },
  { code: 'TE', label: 'Telugu',  script: 'తెలుగు'   },
  { code: 'MR', label: 'Marathi', script: 'मराठी'    },
  { code: 'KN', label: 'Kannada', script: 'ಕನ್ನಡ'    },
  { code: 'OR', label: 'Odia',    script: 'ଓଡ଼ିଆ'    },
];

// ─── Voice input helper ───────────────────────────────────────────────────────
function startVoiceInput({ lang, onResult, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onError?.('not-supported'); return; }
  const recognition = new SR();
  recognition.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e) => onResult(e.results[0][0].transcript);
  recognition.onerror = (e) => onError?.(e.error);
  recognition.start();
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReturning = searchParams.get('mode') === 'returning';

  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  // ── Outer step: 1 = Profile, 2 = Companion ─────────────────────────────────
  const [step, setStep] = useState(1);
  // ── Step 1 sub-steps: 0=Name 1=Class 2=Language 3=ClassCode ────────────────
  const [subStep, setSubStep] = useState(0);

  // ── Step 1 form state ───────────────────────────────────────────────────────
  const [name, setName]                 = useState(isReturning ? (appState.studentName || '') : '');
  const [selectedClass, setSelectedClass] = useState(isReturning ? (appState.studentClass || null) : null);
  const [selectedLanguage, setSelectedLanguage] = useState(appState.language || 'EN');
  const [classCode, setClassCode]       = useState('');
  const [linkingCode, setLinkingCode]   = useState(false);

  // ── Step 2 companion state ──────────────────────────────────────────────────
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [companionNickname, setCompanionNickname] = useState('');
  const [showProfileReveal, setShowProfileReveal] = useState(false);

  // ── Mic loading state ───────────────────────────────────────────────────────
  const [micListening, setMicListening] = useState(false);

  // ─── Mic handler ─────────────────────────────────────────────────────────────
  const handleMic = (onResult) => {
    setMicListening(true);
    startVoiceInput({
      lang,
      onResult: (text) => { onResult(text); setMicListening(false); },
      onError: ()      => { setMicListening(false); },
    });
  };

  // ─── Step 1 validation ───────────────────────────────────────────────────────
  const canContinue = [
    name.trim().length > 0,
    selectedClass !== null,
    selectedLanguage !== null,
    true, // class code is optional
  ][subStep];

  const handleSubStepContinue = () => {
    if (subStep === 2) {
      // Persist language choice immediately so Layout updates
      updateState({ language: selectedLanguage });
    }
    if (subStep < 3) {
      setSubStep(s => s + 1);
    } else {
      setStep(2);
    }
  };

  const handleLinkCode = () => {
    setLinkingCode(true);
    setTimeout(() => { setLinkingCode(false); setStep(2); }, 800);
  };

  // ─── Companion selection ─────────────────────────────────────────────────────
  const handleSelectCompanion = (companion) => {
    setSelectedCompanion(companion);
    setCompanionNickname(companion.name); // default nickname = companion's name
    setTimeout(() => setShowProfileReveal(true), 300);
  };

  // ─── Final save + navigate ────────────────────────────────────────────────────
  const handleLetsGo = () => {
    if (!selectedCompanion) return;
    updateState({
      studentName: name.trim() || 'Arjun',
      studentClass: selectedClass || 4,
      language: selectedLanguage,
      companion: {
        id: selectedCompanion.id,
        emoji: selectedCompanion.emoji,
        nickname: companionNickname.trim() || selectedCompanion.name,
      },
    });
    navigate('/screening');
  };

  // ─── Live companion preview for Layout widget ─────────────────────────────────
  const liveCompanion = selectedCompanion
    ? { ...selectedCompanion, nickname: companionNickname || selectedCompanion.name }
    : appState.companion;

  // ─── Title text by sub-step ───────────────────────────────────────────────────
  const step1Titles = [
    lang === 'HI' ? 'आपका नाम क्या है?' : "What's your name?",
    lang === 'HI' ? 'आप किस कक्षा में हैं?' : 'Which class are you in?',
    lang === 'HI' ? 'आपको कौन सी भाषा पसंद है?' : 'What language do you like best?',
    lang === 'HI' ? 'क्लास कोड है?' : 'Got a class code?',
  ];

  return (
    <Layout
      title={step === 1 ? step1Titles[subStep] : (S.chooseCompanion || 'Choose your buddy')}
      showBack={step === 2}
      showCompanion
      companionState={selectedCompanion ? 'happy' : 'idle'}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={liveCompanion}
      streak={appState.streakDays}
    >
      <div className="max-w-md mx-auto px-4 py-6 pb-10 bg-surface min-h-screen">

        {/* ── Step indicator ── */}
        <div className="flex justify-center gap-2 mb-6" aria-label="Step progress">
          {[1, 2].map(n => (
            <div
              key={n}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                step === n ? 'bg-accent' : step > n ? 'bg-success' : 'bg-gray-200'
              }`}
              aria-label={`Step ${n} ${step === n ? '(current)' : step > n ? '(done)' : ''}`}
            />
          ))}
        </div>

        {/* ══════════════════════════════════════════════════
            STEP 1 — Profile Setup
        ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Sub-step heading */}
            <h2 className="text-2xl font-bold text-primary text-center leading-snug">
              {step1Titles[subStep]}
            </h2>

            {/* ─ Sub-step A: Name ─ */}
            {subStep === 0 && (
              <div>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={lang === 'HI' ? 'अपना नाम लिखें या बोलें' : 'Type or speak your name'}
                    className="w-full text-xl p-4 rounded-xl border-2 border-accent bg-card focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 text-primary font-medium placeholder:text-muted pr-16 min-h-[56px]"
                    autoFocus
                    aria-label="Enter your name"
                  />
                  <button
                    onClick={() => handleMic(text => setName(text))}
                    disabled={micListening}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                      micListening ? 'bg-warm text-white animate-pulse' : 'bg-surface text-accent hover:bg-blue-50'
                    }`}
                    aria-label="Speak your name"
                  >
                    <Mic size={20} />
                  </button>
                </div>
                {micListening && (
                  <p className="text-sm text-warm font-medium text-center mt-2 animate-pulse">
                    {lang === 'HI' ? '🎤 सुन रहा हूँ...' : '🎤 Listening...'}
                  </p>
                )}
              </div>
            )}

            {/* ─ Sub-step B: Class ─ */}
            {subStep === 1 && (
              <div className="grid grid-cols-5 gap-3" role="group" aria-label="Select your class">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    onClick={() => setSelectedClass(num)}
                    className={`min-h-[60px] rounded-xl border-2 text-2xl font-bold flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
                      selectedClass === num
                        ? 'border-accent bg-blue-50 text-accent scale-105 shadow-sm'
                        : 'border-gray-200 bg-card text-primary hover:border-accent hover:bg-blue-50'
                    }`}
                    aria-label={`Class ${num}`}
                    aria-pressed={selectedClass === num}
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}

            {/* ─ Sub-step C: Language ─ */}
            {subStep === 2 && (
              <div className="grid grid-cols-2 gap-3" role="group" aria-label="Select your language">
                {LANGUAGE_OPTIONS.map(({ code, label, script }) => (
                  <button
                    key={code}
                    onClick={() => setSelectedLanguage(code)}
                    className={`min-h-[72px] rounded-xl border-2 p-3 flex flex-col items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
                      selectedLanguage === code
                        ? 'border-accent bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-card hover:border-accent hover:bg-blue-50'
                    }`}
                    aria-label={label}
                    aria-pressed={selectedLanguage === code}
                  >
                    <span className={`text-xl font-bold ${selectedLanguage === code ? 'text-accent' : 'text-primary'}`}>
                      {script}
                    </span>
                    <span className="text-xs text-muted mt-0.5">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ─ Sub-step D: Class Code ─ */}
            {subStep === 3 && (
              <div className="space-y-4">
                <p className="text-muted text-center text-base">
                  {lang === 'HI'
                    ? 'अपने शिक्षक से क्लास कोड मिला? यहाँ डालें।'
                    : 'Got a class code from your teacher? Enter it here.'}
                </p>
                <input
                  type="text"
                  value={classCode}
                  onChange={e => setClassCode(e.target.value.toUpperCase())}
                  placeholder={lang === 'HI' ? 'जैसे: SCH001' : 'e.g. SCH001'}
                  maxLength={10}
                  className="w-full text-xl p-4 rounded-xl border-2 border-accent bg-card focus:outline-none focus:ring-2 focus:ring-accent text-primary font-mono text-center tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-muted min-h-[56px]"
                  aria-label="Class code"
                />
                <button
                  onClick={handleLinkCode}
                  disabled={classCode.trim().length === 0 || linkingCode}
                  className={`w-full bg-accent text-white font-semibold py-3 px-6 rounded-xl min-h-[52px] transition-all focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center gap-2 ${
                    classCode.trim().length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 shadow-sm'
                  }`}
                  aria-label="Link my class"
                >
                  {linkingCode ? (
                    <span className="animate-pulse">{lang === 'HI' ? 'जोड़ रहे हैं...' : 'Linking...'}</span>
                  ) : (
                    <><Link2 size={18} />{lang === 'HI' ? 'क्लास जोड़ें' : 'Link my class'}</>
                  )}
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="w-full border-2 border-gray-200 text-muted font-semibold py-3 px-6 rounded-xl min-h-[52px] hover:border-accent hover:text-accent transition-all focus:outline-none focus:ring-2 focus:ring-accent"
                  aria-label={S.skip}
                >
                  {S.skip}
                </button>
              </div>
            )}

            {/* ─ Continue button (sub-steps 0–2) ─ */}
            {subStep < 3 && (
              <button
                onClick={handleSubStepContinue}
                disabled={!canContinue}
                className={`w-full bg-warm text-white font-semibold py-3.5 px-6 rounded-xl min-h-[52px] transition-all focus:outline-none focus:ring-2 focus:ring-warm flex items-center justify-center gap-2 mt-4 ${
                  !canContinue ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600 shadow-sm active:bg-orange-700'
                }`}
                aria-label={S.continue}
              >
                {S.continue} <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            STEP 2 — Companion Selection
        ══════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Heading */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-primary">{S.chooseCompanion}</h2>
              <p className="text-muted text-base mt-1 leading-relaxed">{S.companionTagline}</p>
            </div>

            {/* Companion grid — 2×3 */}
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose your learning companion">
              {COMPANIONS.map(companion => {
                const isSelected = selectedCompanion?.id === companion.id;
                return (
                  <button
                    key={companion.id}
                    onClick={() => handleSelectCompanion(companion)}
                    className={`rounded-2xl p-4 border-2 flex flex-col items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-warm min-h-[110px] ${
                      isSelected
                        ? 'border-warm bg-orange-50 shadow-md scale-[1.03]'
                        : 'border-gray-200 bg-card hover:border-warm hover:bg-orange-50'
                    }`}
                    aria-label={`${companion.name} — ${companion.description}`}
                    aria-pressed={isSelected}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-colors ${
                      isSelected ? 'bg-warm' : 'bg-orange-100'
                    }`}>
                      {companion.emoji}
                    </div>
                    <span className={`text-sm font-bold leading-tight ${isSelected ? 'text-warm' : 'text-primary'}`}>
                      {companion.name}
                    </span>
                    <span className="text-xs text-muted text-center leading-tight">
                      {companion.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Nickname input — shown after companion is selected */}
            {selectedCompanion && (
              <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 transition-all duration-300">
                <label className="block text-sm font-semibold text-primary">
                  {lang === 'HI'
                    ? `${selectedCompanion.emoji} इनका नाम क्या रखोगे?`
                    : `${selectedCompanion.emoji} Give them a nickname!`}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={companionNickname}
                    onChange={e => setCompanionNickname(e.target.value)}
                    placeholder={selectedCompanion.name}
                    maxLength={20}
                    className="w-full text-lg p-3.5 rounded-xl border-2 border-accent bg-surface focus:outline-none focus:ring-2 focus:ring-accent text-primary font-medium placeholder:text-muted pr-14 min-h-[52px]"
                    aria-label="Companion nickname"
                  />
                  <button
                    onClick={() => handleMic(text => setCompanionNickname(text))}
                    disabled={micListening}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                      micListening ? 'bg-warm text-white animate-pulse' : 'bg-card text-accent hover:bg-blue-50'
                    }`}
                    aria-label="Speak nickname"
                  >
                    <Mic size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Learner profile reveal — shown after companion selection */}
            {showProfileReveal && (
              <div
                className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-1 transition-opacity duration-500"
                role="status"
                aria-live="polite"
              >
                <p className="text-base text-primary font-semibold">
                  {lang === 'HI' ? 'आपके लिए खास रास्ता तैयार है! 🌟' : 'Your personalised path is ready! 🌟'}
                </p>
                <p className="text-sm text-muted leading-relaxed">
                  {S.learnerProfileReveal}
                </p>
              </div>
            )}

            {/* Let's go CTA */}
            <button
              onClick={handleLetsGo}
              disabled={!selectedCompanion}
              className={`w-full bg-warm text-white font-bold py-4 px-6 rounded-xl min-h-[56px] text-lg transition-all focus:outline-none focus:ring-2 focus:ring-warm flex items-center justify-center gap-2 ${
                !selectedCompanion
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-orange-600 shadow-md active:bg-orange-700'
              }`}
              aria-label={S.letsDo}
            >
              {selectedCompanion?.emoji || '🌟'} {S.letsDo}
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}