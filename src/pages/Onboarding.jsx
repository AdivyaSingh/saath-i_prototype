// src/pages/Onboarding.jsx
// Route: /onboarding
// New student registration flow — 5 sub-steps + companion selection.
// Step 0: Class Code (mandatory, verified against Firestore)
// Step 1: Name (checks for duplicates in that class)
// Step 2: Grade selection
// Step 3: Language
// Step 4: Set 4-digit PIN
// Step 5: Companion selection → navigate to /screening

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, ChevronRight, Sparkles, CheckCircle2, ArrowRight,
  AlertTriangle, Loader2, Lock, Eye, EyeOff, Delete,
} from 'lucide-react';
import { useApp } from '../App';
import { COMPANIONS, STRINGS } from '../data';
import Layout from '../components/Layout';
import {
  getClassByCode,
  findStudentsByName,
  generateUniqueStudentId,
} from '../firebase';

// ─── Language options ─────────────────────────────────────────────────────────
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

const TOTAL_SUB_STEPS = 5; // 0–4, then companion is step 2

// ─── Voice input helper ───────────────────────────────────────────────────────
const startVoiceInput = ({ lang, onResult, onError }) => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { onError?.('not-supported'); return; }
  const recognition = new SR();
  recognition.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (e) => onResult(e.results[0][0].transcript);
  recognition.onerror  = (e) => onError?.(e.error);
  recognition.start();
};

// ─── PIN Pad component ────────────────────────────────────────────────────────
// Shows 4 dot indicators + a numeric keypad. `value` is a string of 0-4 digits.
function PinPad({ value, onChange, label, lang }) {
  const [showPin, setShowPin] = useState(false);
  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const handleKey = (key) => {
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (key === '')   return;
    if (value.length < 4) onChange(value + key);
  };

  return (
    <div className="space-y-5">
      {label && <p className="text-sm text-muted text-center">{label}</p>}
      {/* PIN dots */}
      <div className="flex justify-center gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-200 ${
              i < value.length
                ? 'bg-primary border-primary text-white'
                : 'bg-card border-gray-200 text-transparent'
            }`}
          >
            {showPin && i < value.length ? value[i] : i < value.length ? '•' : '–'}
          </div>
        ))}
      </div>
      {/* Show/hide toggle */}
      <button
        onClick={() => setShowPin(s => !s)}
        className="flex items-center gap-1.5 text-xs text-muted mx-auto hover:text-accent transition-colors"
        type="button"
      >
        {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
        {showPin
          ? (lang === 'HI' ? 'PIN छुपाएं' : 'Hide PIN')
          : (lang === 'HI' ? 'PIN दिखाएं' : 'Show PIN')}
      </button>
      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
        {digits.map((key, i) => (
          <button
            key={i}
            onClick={() => handleKey(key)}
            disabled={key === '' || (key !== '⌫' && value.length >= 4)}
            className={`h-14 rounded-xl text-xl font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent ${
              key === '⌫'
                ? 'bg-red-50 text-red-500 border-2 border-red-100 hover:bg-red-100 active:scale-95'
                : key === ''
                ? 'invisible'
                : 'bg-card border-2 border-gray-200 text-primary hover:bg-accent/10 hover:border-accent active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            type="button"
            aria-label={key === '⌫' ? 'Backspace' : key === '' ? '' : `Digit ${key}`}
          >
            {key === '⌫' ? <Delete size={18} className="mx-auto" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const Onboarding = () => {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  // Outer step: 1 = Profile sub-steps, 2 = Companion
  const [step, setStep] = useState(1);
  // Profile sub-steps: 0=ClassCode, 1=Name, 2=Grade, 3=Language, 4=PIN
  const [subStep, setSubStep] = useState(0);

  // ── Sub-step 0: Class Code ──────────────────────────────────────────────────
  const [classCode,         setClassCode]         = useState('');
  const [classInfo,         setClassInfo]         = useState(null);  // {id, teacherName, schoolName}
  const [isValidatingCode,  setIsValidatingCode]  = useState(false);
  const [codeError,         setCodeError]         = useState('');

  // ── Sub-step 1: Name ────────────────────────────────────────────────────────
  const [name,                setName]                = useState('');
  const [isCheckingDuplicates,setIsCheckingDuplicates]= useState(false);
  const [duplicateStudents,   setDuplicateStudents]   = useState([]);  // existing students with same name
  const [showDuplicateWarning,setShowDuplicateWarning]= useState(false);

  // ── Sub-step 2: Grade ───────────────────────────────────────────────────────
  const [selectedClass,    setSelectedClass]    = useState(null);

  // ── Sub-step 3: Language ────────────────────────────────────────────────────
  const [selectedLanguage, setSelectedLanguage] = useState(appState.language || 'EN');

  // ── Sub-step 4: PIN ─────────────────────────────────────────────────────────
  const [pin,        setPin]        = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStage,   setPinStage]   = useState('set');  // 'set' | 'confirm'
  const [pinError,   setPinError]   = useState('');

  // ── Companion ───────────────────────────────────────────────────────────────
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [companionNickname, setCompanionNickname] = useState('');
  const [showProfileReveal, setShowProfileReveal] = useState(false);
  const [isSaving,          setIsSaving]          = useState(false);

  // ── Mic ─────────────────────────────────────────────────────────────────────
  const [micListening, setMicListening] = useState(false);

  const handleMic = (onResult) => {
    setMicListening(true);
    startVoiceInput({
      lang,
      onResult: (text) => { onResult(text); setMicListening(false); },
      onError: () => setMicListening(false),
    });
  };

  // ─── Step 0: Validate class code against Firestore ──────────────────────────
  const handleValidateCode = async () => {
    const code = classCode.trim().toUpperCase();
    if (!code) return;
    setIsValidatingCode(true);
    setCodeError('');
    setClassInfo(null);
    const info = await getClassByCode(code);
    setIsValidatingCode(false);
    if (info) {
      setClassInfo(info);
      setClassCode(code); // normalize to uppercase
    } else {
      setCodeError(
        lang === 'HI'
          ? `'${code}' कोड मिला नहीं। कृपया जाँचें। डेमो के लिए SCH001 उपयोग करें।`
          : `Class code '${code}' not found. Please check with your teacher. For demo, use SCH001.`
      );
    }
  };

  // ─── Step 1: Check for duplicate names in this class ────────────────────────
  const handleNameContinue = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsCheckingDuplicates(true);
    const dupes = await findStudentsByName(trimmedName, classCode);
    setIsCheckingDuplicates(false);
    if (dupes.length > 0) {
      setDuplicateStudents(dupes);
      setShowDuplicateWarning(true);
    } else {
      setSubStep(2);
    }
  };

  // ─── Sub-step Continue ───────────────────────────────────────────────────────
  const handleSubStepContinue = async () => {
    if (subStep === 0) {
      if (!classInfo) { handleValidateCode(); return; }
      setSubStep(1);
    } else if (subStep === 1) {
      await handleNameContinue();
    } else if (subStep === 2) {
      setSubStep(3);
    } else if (subStep === 3) {
      updateState({ language: selectedLanguage });
      setSubStep(4);
    } else if (subStep === 4) {
      // PIN stage machine
      if (pinStage === 'set') {
        if (pin.length < 4) return;
        setPinStage('confirm');
        setConfirmPin('');
        setPinError('');
        return;
      }
      // Confirm stage
      if (pin !== confirmPin) {
        setPinError(lang === 'HI' ? 'PIN मेल नहीं खाता। फिर से कोशिश करें।' : 'PINs do not match. Please try again.');
        setConfirmPin('');
        return;
      }
      // Save PIN to appState, advance to companion
      updateState({
        studentName:   name.trim(),
        studentClass:  selectedClass,
        language:      selectedLanguage,
        classCode:     classCode,
        studentPin:    pin,
        streakDays:    0,
      });
      setStep(2);
    }
  };

  // ─── Duplicate warning actions ───────────────────────────────────────────────
  const handleGoToLogin = () => navigate('/return');
  const handleContinueAsNew = () => {
    setShowDuplicateWarning(false);
    setDuplicateStudents([]);
    setSubStep(2);
  };

  // ─── Companion selection ─────────────────────────────────────────────────────
  const handleSelectCompanion = (companion) => {
    setSelectedCompanion(companion);
    setCompanionNickname(companion.name);
    setTimeout(() => setShowProfileReveal(true), 300);
  };

  // ─── Final save and navigate to screening ────────────────────────────────────
  const handleLetsGo = async () => {
    if (!selectedCompanion) return;
    setIsSaving(true);
    // Generate a unique, deterministic Firestore document ID
    const studentId = await generateUniqueStudentId(name.trim(), classCode);
    updateState({
      studentId,
      firebaseStudentId: studentId,
      companion: {
        id: selectedCompanion.id,
        emoji: selectedCompanion.emoji,
        nickname: companionNickname.trim() || selectedCompanion.name,
      },
    });
    navigate('/screening');
  };

  // ─── canContinue per sub-step ────────────────────────────────────────────────
  const canContinue = [
    classInfo !== null,                     // 0: code validated
    name.trim().length > 0,                 // 1: name entered
    selectedClass !== null,                 // 2: grade selected
    selectedLanguage !== null,              // 3: language selected
    pinStage === 'set'
      ? pin.length === 4
      : confirmPin.length === 4,            // 4: pin entered
  ][subStep] ?? false;

  // ─── Progress dots ───────────────────────────────────────────────────────────
  const ProgressDots = () => {
    const totalDots = TOTAL_SUB_STEPS + 1; // 5 profile + 1 companion
    const activeIndex = step === 1 ? subStep : TOTAL_SUB_STEPS;
    return (
      <div className="flex justify-center gap-2 mb-8" aria-label="Onboarding progress">
        {Array.from({ length: totalDots }, (_, i) => {
          const isActive = i === activeIndex;
          const isDone   = i < activeIndex;
          return (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                isActive ? 'w-6 bg-primary' : isDone ? 'w-2 bg-success' : 'w-2 bg-gray-300'
              }`}
              aria-label={`Step ${i + 1}${isActive ? ' (current)' : isDone ? ' (done)' : ''}`}
            />
          );
        })}
      </div>
    );
  };

  // ─── Sub-step titles ─────────────────────────────────────────────────────────
  const step1Titles = [
    lang === 'HI' ? 'आपका क्लास कोड क्या है?' : "What's your class code?",
    lang === 'HI' ? 'आपका नाम क्या है?'        : "What's your name?",
    lang === 'HI' ? 'आप किस कक्षा में हैं?'     : 'Which class are you in?',
    lang === 'HI' ? 'आपको कौन सी भाषा पसंद है?' : 'What language do you like best?',
    lang === 'HI' ? 'अपना गुप्त PIN बनाएं'      : 'Create your secret PIN',
  ];

  const liveCompanion = selectedCompanion
    ? { ...selectedCompanion, nickname: companionNickname || selectedCompanion.name }
    : appState.companion;

  return (
    <Layout
      title={step === 1 ? step1Titles[subStep] : (S.chooseCompanion || 'Choose your learning buddy')}
      showBack={step === 2 || subStep > 0}
      showCompanion
      pageContext="Setting up their profile and choosing a companion"
      companionState={selectedCompanion ? 'happy' : 'idle'}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={liveCompanion}
      streak={appState.streakDays}
    >
      <div className="max-w-md mx-auto px-4 py-6 pb-12 bg-surface min-h-screen">
        <ProgressDots />

        {/* ════════════════════════════════════════════════════════════
            STEP 1 — Profile sub-steps
        ════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="animate-fadeIn space-y-6">
            <h2 className="text-2xl font-bold text-primary text-center leading-snug">
              {step1Titles[subStep]}
            </h2>

            {/* ── Sub-step 0: Class Code ──────────────────────────── */}
            {subStep === 0 && (
              <div className="space-y-4 animate-fadeIn">
                <p className="text-muted text-center text-sm leading-relaxed">
                  {lang === 'HI'
                    ? 'यह कोड आपके शिक्षक देंगे। डेमो के लिए SCH001 उपयोग करें।'
                    : 'Your teacher will give you this code. For demo, use SCH001.'}
                </p>

                {/* Code input + verify button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => {
                      setClassCode(e.target.value.toUpperCase());
                      setClassInfo(null);
                      setCodeError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && !isValidatingCode && handleValidateCode()}
                    placeholder="e.g. SCH001"
                    maxLength={10}
                    className="flex-1 text-xl p-4 rounded-xl border-2 border-gray-200 bg-card
                               focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                               text-primary font-mono text-center tracking-widest
                               placeholder:tracking-normal placeholder:font-sans placeholder:text-muted
                               min-h-[56px] transition-colors duration-200"
                    aria-label="Class code"
                  />
                  <button
                    onClick={handleValidateCode}
                    disabled={isValidatingCode || classCode.trim().length < 3}
                    className="px-4 rounded-xl border-2 border-accent bg-accent text-white font-semibold
                               min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700
                               transition-colors flex items-center gap-1.5"
                    aria-label="Verify class code"
                  >
                    {isValidatingCode
                      ? <Loader2 size={18} className="animate-spin" />
                      : (lang === 'HI' ? 'जाँचें' : 'Verify')}
                  </button>
                </div>

                {/* Error */}
                {codeError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 animate-fadeIn">
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{codeError}</p>
                  </div>
                )}

                {/* Success confirmation */}
                {classInfo && (
                  <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-xl p-3 animate-fadeIn">
                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">
                        {lang === 'HI' ? 'कक्षा मिली!' : 'Class found!'}
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        {classInfo.teacherName} · {classInfo.schoolName}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Sub-step 1: Name ─────────────────────────────────── */}
            {subStep === 1 && (
              <div className="space-y-3 animate-fadeIn">
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setShowDuplicateWarning(false);
                    }}
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

                {/* Duplicate warning */}
                {showDuplicateWarning && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-fadeIn">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-semibold text-amber-800">
                        {lang === 'HI'
                          ? `'${name.trim()}' नाम का ${duplicateStudents.length > 1 ? `${duplicateStudents.length} छात्र` : 'एक छात्र'} इस कक्षा में पहले से है।`
                          : `A student named '${name.trim()}' already exists in this class.`}
                      </p>
                    </div>
                    <p className="text-xs text-amber-700 pl-6">
                      {lang === 'HI'
                        ? 'क्या यह आप हैं? अगर हाँ, लॉगिन करें। नहीं तो नए छात्र के रूप में जारी रखें।'
                        : 'Is that you? If yes, go to login. If you are a different person, continue to register.'}
                    </p>
                    <div className="flex gap-2 pl-6">
                      <button
                        onClick={handleGoToLogin}
                        className="flex-1 bg-primary text-white text-xs font-semibold py-2 px-3 rounded-xl min-h-[44px] hover:bg-blue-800 transition-colors"
                      >
                        {lang === 'HI' ? '← लॉगिन करें' : '← Go to Login'}
                      </button>
                      <button
                        onClick={handleContinueAsNew}
                        className="flex-1 bg-card text-primary text-xs font-semibold py-2 px-3 rounded-xl min-h-[44px] border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {lang === 'HI' ? 'नया खाता बनाएं →' : 'Register as new →'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Sub-step 2: Grade ─────────────────────────────────── */}
            {subStep === 2 && (
              <div className="grid grid-cols-4 gap-3 animate-fadeIn" role="group" aria-label="Select your class">
                {[5, 6, 7, 8].map((num) => (
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

            {/* ── Sub-step 3: Language ──────────────────────────────── */}
            {subStep === 3 && (
              <div className="grid grid-cols-2 gap-3 animate-fadeIn" role="group" aria-label="Select your preferred language">
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
                    <span className={`text-xl font-bold ${selectedLanguage === code ? 'text-accent' : 'text-primary'}`}>
                      {script}
                    </span>
                    <span className="text-xs text-muted">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Sub-step 4: PIN ──────────────────────────────────── */}
            {subStep === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-center gap-2 text-sm text-muted">
                  <Lock size={15} className="text-accent" />
                  <span>
                    {pinStage === 'set'
                      ? (lang === 'HI' ? 'अपना 4 अंकों का PIN बनाएं' : 'Create a 4-digit PIN to protect your account')
                      : (lang === 'HI' ? 'PIN की पुष्टि करें' : 'Re-enter your PIN to confirm')}
                  </span>
                </div>

                <PinPad
                  value={pinStage === 'set' ? pin : confirmPin}
                  onChange={pinStage === 'set' ? setPin : setConfirmPin}
                  lang={lang}
                />

                {pinError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 animate-fadeIn">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">{pinError}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Continue button (all sub-steps) ──────────────────── */}
            <button
              onClick={handleSubStepContinue}
              disabled={!canContinue || isCheckingDuplicates}
              className={`w-full btn-primary text-lg mt-4 ${!canContinue || isCheckingDuplicates ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label="Continue"
            >
              {isCheckingDuplicates
                ? <><Loader2 size={18} className="animate-spin" /> {lang === 'HI' ? 'जाँच रहे हैं...' : 'Checking...'}</>
                : subStep === 4 && pinStage === 'confirm' && pin === confirmPin && confirmPin.length === 4
                ? <><CheckCircle2 size={18} /> {lang === 'HI' ? 'PIN सेट हो गया!' : 'PIN set!'}</>
                : <>{S.continue} <ChevronRight size={20} /></>}
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            STEP 2 — Companion Selection
        ════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="animate-fadeIn space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold text-primary">{S.chooseCompanion}</h2>
              <p className="text-muted text-base leading-relaxed">{S.companionTagline}</p>
            </div>

            {/* Companion grid */}
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose your learning companion">
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
                    <div className={`companion-container ${isSelected ? 'happy' : ''}`}>
                      {companion.emoji}
                    </div>
                    <div className="text-center">
                      <span className={`text-sm font-bold block leading-tight ${isSelected ? 'text-warm' : 'text-primary'}`}>
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

            {/* Nickname input */}
            {selectedCompanion && (
              <div className="card-elevated p-5 space-y-3 animate-slideUp">
                <label className="block text-sm font-semibold text-primary">
                  {lang === 'HI' ? 'इनका नाम क्या रखोगे?' : 'Give them a nickname'}
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
                      micListening ? 'bg-warm text-white animate-pulse' : 'bg-card text-accent hover:bg-accent/10 border border-gray-200'
                    }`}
                    aria-label="Speak nickname"
                  >
                    <Mic size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Profile reveal */}
            {showProfileReveal && (
              <div className="glass-card rounded-2xl p-5 space-y-2 animate-slideUp" role="status" aria-live="polite">
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

            {/* Let's go */}
            <button
              onClick={handleLetsGo}
              disabled={!selectedCompanion || isSaving}
              className={`w-full btn-primary text-lg py-4 ${!selectedCompanion || isSaving ? 'opacity-40 cursor-not-allowed' : ''}`}
              aria-label={S.letsDo}
            >
              {isSaving
                ? <><Loader2 size={18} className="animate-spin" /> {lang === 'HI' ? 'बना रहे हैं...' : 'Setting up...'}</>
                : <><Sparkles size={18} /> {S.letsDo} <ArrowRight size={20} /></>}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Onboarding;