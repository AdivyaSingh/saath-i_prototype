// src/pages/Onboarding.jsx
// Route: /onboarding
// Two-step onboarding: Step 1 (Profile Setup with 4 sub-steps) → Step 2 (Companion Selection).
// Professional, clean design with minimal emoji usage (only companion emojis by design).

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mic,
  ChevronRight,
  Link2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../App';
import { COMPANIONS, STRINGS } from '../data';
import Layout from '../components/Layout';

// ─── Language options (UI-level meta choices - not from data.js) ──────────────
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

// Total number of sub-steps in Step 1
const TOTAL_SUB_STEPS = 4;

// ─── Voice input helper (Web Speech API) ──────────────────────────────────────
const startVoiceInput = ({ lang, onResult, onError }) => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    onError?.('not-supported');
    return;
  }
  const recognition = new SR();
  recognition.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e) => onResult(e.results[0][0].transcript);
  recognition.onerror = (e) => onError?.(e.error);
  recognition.start();
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReturning = searchParams.get('mode') === 'returning';

  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  // ── Outer step: 1 = Profile, 2 = Companion ─────────────────────────────────
  const [step, setStep] = useState(1);
  // ── Step 1 sub-steps: 0=Name, 1=Class, 2=Language, 3=ClassCode ──────────────
  const [subStep, setSubStep] = useState(0);

  // ── Step 1 form state ───────────────────────────────────────────────────────
  const [name, setName] = useState(isReturning ? (appState.studentName || '') : '');
  const [selectedClass, setSelectedClass] = useState(isReturning ? (appState.studentClass || null) : null);
  const [selectedLanguage, setSelectedLanguage] = useState(appState.language || 'EN');
  const [classCode, setClassCode] = useState('');
  const [linkingCode, setLinkingCode] = useState(false);

  // ── Step 2 companion state ──────────────────────────────────────────────────
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [companionNickname, setCompanionNickname] = useState('');
  const [showProfileReveal, setShowProfileReveal] = useState(false);

  // ── Mic state ───────────────────────────────────────────────────────────────
  const [micListening, setMicListening] = useState(false);

  // ─── Mic handler ────────────────────────────────────────────────────────────
  const handleMic = (onResult) => {
    setMicListening(true);
    startVoiceInput({
      lang,
      onResult: (text) => { onResult(text); setMicListening(false); },
      onError: () => { setMicListening(false); },
    });
  };

  // ─── Step 1 validation per sub-step ─────────────────────────────────────────
  const canContinue = [
    name.trim().length > 0,       // Sub-step 0: Name
    selectedClass !== null,        // Sub-step 1: Class
    selectedLanguage !== null,     // Sub-step 2: Language
    true,                          // Sub-step 3: Class code is optional
  ][subStep];

  // ─── Handle moving through sub-steps ────────────────────────────────────────
  const handleSubStepContinue = () => {
    // Persist language choice immediately so Layout updates
    if (subStep === 2) {
      updateState({ language: selectedLanguage });
    }
    if (subStep < 3) {
      setSubStep((s) => s + 1);
    } else {
      setStep(2);
    }
  };

  // ─── Link class code handler ────────────────────────────────────────────────
  const handleLinkCode = () => {
    setLinkingCode(true);
    setTimeout(() => { setLinkingCode(false); setStep(2); }, 800);
  };

  // ─── Companion selection ────────────────────────────────────────────────────
  const handleSelectCompanion = (companion) => {
    setSelectedCompanion(companion);
    setCompanionNickname(companion.name);
    setTimeout(() => setShowProfileReveal(true), 300);
  };

  // ─── Final save and navigate ────────────────────────────────────────────────
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

  // ─── Live companion preview for Layout ──────────────────────────────────────
  const liveCompanion = selectedCompanion
    ? { ...selectedCompanion, nickname: companionNickname || selectedCompanion.name }
    : appState.companion;

  // ─── Sub-step headings ──────────────────────────────────────────────────────
  const step1Titles = [
    lang === 'HI' ? 'आपका नाम क्या है?' : "What's your name?",
    lang === 'HI' ? 'आप किस कक्षा में हैं?' : 'Which class are you in?',
    lang === 'HI' ? 'आपको कौन सी भाषा पसंद है?' : 'What language do you like best?',
    lang === 'HI' ? 'क्लास कोड है?' : 'Got a class code?',
  ];

  // ─── Progress dots component ────────────────────────────────────────────────
  const ProgressDots = () => {
    // Show combined progress: Step 1 has 4 sub-steps, Step 2 is the 5th dot
    const totalDots = TOTAL_SUB_STEPS + 1;
    const activeIndex = step === 1 ? subStep : TOTAL_SUB_STEPS;

    return (
      <div className="flex justify-center gap-2 mb-8" aria-label="Onboarding progress">
        {Array.from({ length: totalDots }, (_, i) => {
          const isActive = i === activeIndex;
          const isDone = i < activeIndex;
          return (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                isActive
                  ? 'w-6 bg-primary'
                  : isDone
                    ? 'w-2 bg-success'
                    : 'w-2 bg-gray-300'
              }`}
              aria-label={`Step ${i + 1}${isActive ? ' (current)' : isDone ? ' (done)' : ''}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <Layout
      title={step === 1 ? step1Titles[subStep] : (S.chooseCompanion || 'Choose your learning buddy')}
      showBack={step === 2 || subStep > 0}
      showCompanion
      companionState={selectedCompanion ? 'happy' : 'idle'}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={liveCompanion}
      streak={appState.streakDays}
    >
      <div className="max-w-md mx-auto px-4 py-6 pb-12 bg-surface min-h-screen">
        {/* Progress dots */}
        <ProgressDots />

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1 - Profile Setup
        ══════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="animate-fadeIn space-y-6">
            {/* Sub-step heading */}
            <h2 className="text-2xl font-bold text-primary text-center leading-snug">
              {step1Titles[subStep]}
            </h2>

            {/* ─────── Sub-step A: Name Input ─────── */}
            {subStep === 0 && (
              <div className="space-y-3 animate-fadeIn">
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={lang === 'HI' ? 'अपना नाम लिखें या बोलें' : 'Type or speak your name'}
                    className="w-full text-xl p-4 rounded-xl border-2 border-gray-200 bg-card
                               focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                               text-primary font-medium placeholder:text-muted pr-16 min-h-[56px]
                               transition-colors duration-200"
                    autoFocus
                    aria-label="Enter your name"
                  />
                  <button
                    onClick={() => handleMic((text) => setName(text))}
                    disabled={micListening}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl
                                min-h-[44px] min-w-[44px] flex items-center justify-center
                                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent ${
                      micListening
                        ? 'bg-warm text-white shadow-md animate-pulse'
                        : 'bg-surface text-accent hover:bg-accent/10 border border-gray-200'
                    }`}
                    aria-label="Speak your name"
                  >
                    <Mic size={20} />
                  </button>
                </div>
                {micListening && (
                  <div className="flex items-center justify-center gap-2 text-sm text-warm font-medium animate-pulse">
                    <Mic size={14} />
                    <span>{lang === 'HI' ? 'सुन रहा हूँ...' : 'Listening...'}</span>
                  </div>
                )}
              </div>
            )}

            {/* ─────── Sub-step B: Class Selection ─────── */}
            {subStep === 1 && (
              <div
                className="grid grid-cols-5 gap-3 animate-fadeIn"
                role="group"
                aria-label="Select your class"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    onClick={() => setSelectedClass(num)}
                    className={`min-h-[60px] rounded-xl border-2 text-2xl font-bold
                                flex items-center justify-center transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-accent ${
                      selectedClass === num
                        ? 'border-accent bg-accent/10 text-accent scale-105 shadow-sm'
                        : 'border-gray-200 bg-card text-primary hover:border-accent/50 hover:bg-accent/5'
                    }`}
                    aria-label={`Class ${num}`}
                    aria-pressed={selectedClass === num}
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}

            {/* ─────── Sub-step C: Language Selection ─────── */}
            {subStep === 2 && (
              <div
                className="grid grid-cols-2 gap-3 animate-fadeIn"
                role="group"
                aria-label="Select your preferred language"
              >
                {LANGUAGE_OPTIONS.map(({ code, label, script }) => (
                  <button
                    key={code}
                    onClick={() => setSelectedLanguage(code)}
                    className={`min-h-[72px] rounded-xl border-2 p-3
                                flex flex-col items-center justify-center gap-0.5
                                transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-accent ${
                      selectedLanguage === code
                        ? 'border-accent bg-accent/10 shadow-sm'
                        : 'border-gray-200 bg-card hover:border-accent/50 hover:bg-accent/5'
                    }`}
                    aria-label={label}
                    aria-pressed={selectedLanguage === code}
                  >
                    <span className={`text-xl font-bold ${
                      selectedLanguage === code ? 'text-accent' : 'text-primary'
                    }`}>
                      {script}
                    </span>
                    <span className="text-xs text-muted">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ─────── Sub-step D: Class Code (Optional) ─────── */}
            {subStep === 3 && (
              <div className="space-y-4 animate-fadeIn">
                <p className="text-muted text-center text-base leading-relaxed">
                  {lang === 'HI'
                    ? 'अपने शिक्षक से क्लास कोड मिला? यहाँ डालें।'
                    : 'Got a class code from your teacher? Enter it here.'}
                </p>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder={lang === 'HI' ? 'जैसे: SCH001' : 'e.g. SCH001'}
                  maxLength={10}
                  className="w-full text-xl p-4 rounded-xl border-2 border-gray-200 bg-card
                             focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                             text-primary font-mono text-center tracking-widest
                             placeholder:tracking-normal placeholder:font-sans placeholder:text-muted
                             min-h-[56px] transition-colors duration-200"
                  aria-label="Class code"
                />
                <button
                  onClick={handleLinkCode}
                  disabled={classCode.trim().length === 0 || linkingCode}
                  className={`w-full btn-secondary text-lg ${
                    classCode.trim().length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  aria-label="Link my class"
                >
                  {linkingCode ? (
                    <span className="animate-pulse">
                      {lang === 'HI' ? 'जोड़ रहे हैं...' : 'Linking...'}
                    </span>
                  ) : (
                    <>
                      <Link2 size={18} />
                      {lang === 'HI' ? 'क्लास जोड़ें' : 'Link my class'}
                    </>
                  )}
                </button>

                {/* Skip link - subtle, not a full button */}
                <button
                  onClick={() => setStep(2)}
                  className="w-full text-center text-sm font-medium text-muted hover:text-accent
                             py-2 transition-colors duration-200 min-h-[48px]
                             focus:outline-none focus:ring-2 focus:ring-accent rounded-lg"
                  aria-label={S.skip}
                >
                  {S.skip}
                </button>
              </div>
            )}

            {/* ─────── Continue Button (sub-steps 0–2) ─────── */}
            {subStep < 3 && (
              <button
                onClick={handleSubStepContinue}
                disabled={!canContinue}
                className={`w-full btn-primary text-lg mt-4 ${
                  !canContinue ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                aria-label={S.continue}
              >
                {S.continue}
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2 - Companion Selection
        ══════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="animate-fadeIn space-y-6">
            {/* Heading */}
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-primary">{S.chooseCompanion}</h2>
              <p className="text-muted text-base leading-relaxed">{S.companionTagline}</p>
            </div>

            {/* Companion grid - 2×3 */}
            <div
              className="grid grid-cols-2 gap-3"
              role="group"
              aria-label="Choose your learning companion"
            >
              {COMPANIONS.map((companion) => {
                const isSelected = selectedCompanion?.id === companion.id;
                return (
                  <button
                    key={companion.id}
                    onClick={() => handleSelectCompanion(companion)}
                    className={`rounded-2xl p-4 border-2 flex flex-col items-center gap-2.5
                                transition-all duration-200 focus:outline-none focus:ring-2
                                focus:ring-warm min-h-[120px] ${
                      isSelected
                        ? 'border-warm bg-warm/5 shadow-md scale-[1.02]'
                        : 'border-gray-200 bg-card hover:border-warm/50 hover:bg-warm/5'
                    }`}
                    aria-label={`${companion.name} - ${companion.description}`}
                    aria-pressed={isSelected}
                  >
                    {/* Companion emoji in companion-container */}
                    <div className={`companion-container ${isSelected ? 'happy' : ''}`}>
                      {companion.emoji}
                    </div>
                    <div className="text-center">
                      <span className={`text-sm font-bold block leading-tight ${
                        isSelected ? 'text-warm' : 'text-primary'
                      }`}>
                        {companion.name}
                      </span>
                      <span className="text-xs text-muted leading-tight block mt-0.5">
                        {companion.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Nickname input - appears after companion selection */}
            {selectedCompanion && (
              <div className="card-elevated p-5 space-y-3 animate-slideUp">
                <label className="block text-sm font-semibold text-primary">
                  {lang === 'HI'
                    ? 'इनका नाम क्या रखोगे?'
                    : 'Give them a nickname'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={companionNickname}
                    onChange={(e) => setCompanionNickname(e.target.value)}
                    placeholder={selectedCompanion.name}
                    maxLength={20}
                    className="w-full text-lg p-3.5 rounded-xl border-2 border-gray-200 bg-surface
                               focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                               text-primary font-medium placeholder:text-muted pr-14 min-h-[52px]
                               transition-colors duration-200"
                    aria-label="Companion nickname"
                  />
                  <button
                    onClick={() => handleMic((text) => setCompanionNickname(text))}
                    disabled={micListening}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-lg
                                min-h-[40px] min-w-[40px] flex items-center justify-center
                                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent ${
                      micListening
                        ? 'bg-warm text-white animate-pulse'
                        : 'bg-card text-accent hover:bg-accent/10 border border-gray-200'
                    }`}
                    aria-label="Speak nickname"
                  >
                    <Mic size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Learner profile reveal card */}
            {showProfileReveal && (
              <div
                className="glass-card rounded-2xl p-5 space-y-2 animate-slideUp"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                  <p className="text-base text-primary font-semibold">
                    {lang === 'HI' ? 'आप तैयार हैं!' : "You're all set!"}
                  </p>
                </div>
                <p className="text-sm text-muted leading-relaxed pl-[26px]">
                  {S.learnerProfileReveal}
                </p>
              </div>
            )}

            {/* "Let's go!" CTA */}
            <button
              onClick={handleLetsGo}
              disabled={!selectedCompanion}
              className={`w-full btn-primary text-lg py-4 ${
                !selectedCompanion ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              aria-label={S.letsDo}
            >
              <Sparkles size={18} />
              {S.letsDo}
              <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Onboarding;