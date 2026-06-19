// src/pages/ReturnStudent.jsx
// Route: /return
// Returning student login flow — 3 steps:
//   Step 1: Enter & verify class code
//   Step 2: Enter name → query Firestore → select from matches
//   Step 3: Enter PIN → verify → restore session → navigate to /home or /screening

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound, Loader2, AlertTriangle, CheckCircle2,
  User, ArrowRight, ArrowLeft, Lock, Delete, Eye, EyeOff,
} from 'lucide-react';
import { useApp } from '../App';
import { STRINGS } from '../data';
import Layout from '../components/Layout';
import { getClassByCode, findStudentsByName, verifyStudentPin, getStudentById } from '../firebase';

// ─── PIN Pad (same as Onboarding, self-contained here) ───────────────────────
function PinPad({ value, onChange, lang }) {
  const [showPin, setShowPin] = useState(false);
  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const handleKey = (key) => {
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (key === '')   return;
    if (value.length < 4) onChange(value + key);
  };

  return (
    <div className="space-y-5">
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
      <button
        onClick={() => setShowPin(s => !s)}
        className="flex items-center gap-1.5 text-xs text-muted mx-auto hover:text-accent transition-colors"
        type="button"
      >
        {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
        {showPin ? (lang === 'HI' ? 'PIN छुपाएं' : 'Hide PIN') : (lang === 'HI' ? 'PIN दिखाएं' : 'Show PIN')}
      </button>
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
export default function ReturnStudent() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  // Step 1 — Class code
  const [step,              setStep]              = useState(1);
  const [classCode,         setClassCode]         = useState('');
  const [classInfo,         setClassInfo]         = useState(null);
  const [isValidatingCode,  setIsValidatingCode]  = useState(false);
  const [codeError,         setCodError]          = useState('');

  // Step 2 — Name search
  const [name,             setName]             = useState('');
  const [isSearching,      setIsSearching]      = useState(false);
  const [matchedStudents,  setMatchedStudents]  = useState([]);
  const [nameError,        setNameError]        = useState('');
  const [selectedStudent,  setSelectedStudent]  = useState(null);

  // Step 3 — PIN verification
  const [pin,         setPin]         = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinError,    setPinError]    = useState('');

  // ─── Step 1: Validate class code ──────────────────────────────────────────
  const handleValidateCode = async () => {
    const code = classCode.trim().toUpperCase();
    if (!code) return;
    setIsValidatingCode(true);
    setCodError('');
    setClassInfo(null);
    const info = await getClassByCode(code);
    setIsValidatingCode(false);
    if (info) {
      setClassInfo(info);
      setClassCode(code);
    } else {
      setCodError(
        lang === 'HI'
          ? `'${code}' कोड नहीं मिला। कृपया जाँचें। डेमो के लिए SCH001 उपयोग करें।`
          : `Class code '${code}' not found. Please check with your teacher. For demo, use SCH001.`
      );
    }
  };

  // ─── Step 2: Search for student by name ────────────────────────────────────
  const handleSearchName = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsSearching(true);
    setNameError('');
    setMatchedStudents([]);
    setSelectedStudent(null);
    const results = await findStudentsByName(trimmedName, classCode);
    setIsSearching(false);
    if (results.length === 0) {
      setNameError(
        lang === 'HI'
          ? `'${trimmedName}' नाम का कोई छात्र इस कक्षा में नहीं मिला।`
          : `No student named '${trimmedName}' found in this class.`
      );
    } else {
      setMatchedStudents(results);
      if (results.length === 1) setSelectedStudent(results[0]);
    }
  };

  // ─── Step 3: Verify PIN and restore session ────────────────────────────────
  const handleVerifyPin = async () => {
    if (!selectedStudent || pin.length < 4) return;
    setIsVerifying(true);
    setPinError('');
    const valid = await verifyStudentPin(selectedStudent.id, pin);
    if (!valid) {
      setIsVerifying(false);
      setPinError(
        lang === 'HI'
          ? 'PIN गलत है। फिर से कोशिश करें।'
          : 'Incorrect PIN. Please try again.'
      );
      setPin('');
      return;
    }
    // Fetch fresh student data (to get latest progress etc.)
    const freshStudent = await getStudentById(selectedStudent.id) || selectedStudent;
    // Restore session into appState
    updateState({
      studentName:       freshStudent.name,
      studentClass:      freshStudent.class,
      sldType:           freshStudent.sldType || null,
      language:          freshStudent.language || appState.language,
      companion:         freshStudent.companion || null,
      streakDays:        freshStudent.streakDays || 0,
      classCode:         freshStudent.classCode,
      studentId:         freshStudent.id,
      firebaseStudentId: freshStudent.id,
      studentPin:        pin,
      screeningResults:  freshStudent.screeningResults || null,
      activitiesCompleted: freshStudent.activitiesCompleted || { reading: 0, maths: 0, expression: 0 },
    });
    setIsVerifying(false);
    // If screening is done, go to home; otherwise, go to screening
    if (freshStudent.sldType) {
      navigate('/home');
    } else {
      navigate('/screening');
    }
  };

  // ─── Helper: display name for a matched student ────────────────────────────
  // Shows "Arjun · Class 4" to help distinguish duplicates
  const getStudentDisplayLabel = (student) => {
    const classSuffix = student.class ? `· Class ${student.class}` : '';
    // If ID ends in -2, -3 etc, show that serial
    const idParts = student.id.split('-');
    const serial = parseInt(idParts[idParts.length - 1]);
    const serialSuffix = !isNaN(serial) && serial > 1 ? ` (${serial})` : '';
    return `${student.name}${serialSuffix} ${classSuffix}`;
  };

  return (
    <Layout
      title={lang === 'HI' ? 'वापस आएं' : 'Welcome Back'}
      showBack
      showCompanion={false}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
    >
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <KeyRound size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary">
            {lang === 'HI' ? 'वापस आपका स्वागत है!' : 'Welcome Back!'}
          </h1>
          <p className="text-muted text-sm mt-1">
            {lang === 'HI'
              ? 'अपना क्लास कोड और नाम डालें'
              : 'Enter your class code and name to log back in'}
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                step > s ? 'bg-success text-white' : step === s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? <CheckCircle2 size={14} /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${step > s ? 'bg-success' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Class Code ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn">
            <h2 className="text-lg font-bold text-primary">
              {lang === 'HI' ? 'अपना क्लास कोड डालें' : 'Enter your class code'}
            </h2>
            <p className="text-sm text-muted">
              {lang === 'HI'
                ? 'यह कोड आपके शिक्षक ने दिया होगा।'
                : 'This is the code your teacher gave you. Demo: SCH001'}
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={classCode}
                onChange={(e) => { setClassCode(e.target.value.toUpperCase()); setClassInfo(null); setCodError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && !isValidatingCode && handleValidateCode()}
                placeholder="SCH001"
                maxLength={10}
                className="flex-1 text-xl p-4 rounded-xl border-2 border-gray-200 bg-card
                           focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                           text-primary font-mono text-center tracking-widest min-h-[56px]"
                aria-label="Class code"
              />
              <button
                onClick={handleValidateCode}
                disabled={isValidatingCode || classCode.trim().length < 3}
                className="px-4 rounded-xl border-2 border-accent bg-accent text-white font-semibold
                           min-h-[56px] disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                {isValidatingCode ? <Loader2 size={18} className="animate-spin" /> : (lang === 'HI' ? 'जाँचें' : 'Verify')}
              </button>
            </div>

            {codeError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 animate-fadeIn">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{codeError}</p>
              </div>
            )}

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

            <button
              onClick={() => setStep(2)}
              disabled={!classInfo}
              className="w-full btn-primary text-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {S.continue} <ArrowRight size={20} />
            </button>

            <div className="text-center">
              <button
                onClick={() => navigate('/onboarding')}
                className="text-sm text-muted hover:text-accent transition-colors"
              >
                {lang === 'HI' ? 'नए छात्र? यहाँ पंजीकरण करें →' : "New student? Register here →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Name Search ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors mb-2">
              <ArrowLeft size={14} /> {lang === 'HI' ? 'वापस' : 'Back'}
            </button>
            <h2 className="text-lg font-bold text-primary">
              {lang === 'HI' ? 'आपका नाम क्या है?' : "What's your name?"}
            </h2>
            <p className="text-sm text-muted">
              {lang === 'HI'
                ? `कक्षा ${classInfo?.teacherName} में अपना नाम खोजें`
                : `Search for your name in ${classInfo?.teacherName}'s class`}
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(''); setMatchedStudents([]); setSelectedStudent(null); }}
                onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearchName()}
                placeholder={lang === 'HI' ? 'अपना नाम लिखें' : 'Type your name'}
                className="flex-1 text-xl p-4 rounded-xl border-2 border-gray-200 bg-card
                           focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                           text-primary font-medium min-h-[56px]"
                aria-label="Your name"
                autoFocus
              />
              <button
                onClick={handleSearchName}
                disabled={isSearching || name.trim().length < 2}
                className="px-4 rounded-xl border-2 border-accent bg-accent text-white font-semibold
                           min-h-[56px] disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                {isSearching ? <Loader2 size={18} className="animate-spin" /> : (lang === 'HI' ? 'खोजें' : 'Search')}
              </button>
            </div>

            {nameError && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 animate-fadeIn">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{nameError}</p>
                </div>
                <button
                  onClick={() => navigate('/onboarding')}
                  className="w-full btn-ghost"
                >
                  {lang === 'HI' ? 'नया खाता बनाएं →' : 'Register as new student →'}
                </button>
              </div>
            )}

            {/* Matched students */}
            {matchedStudents.length > 0 && (
              <div className="space-y-2 animate-fadeIn">
                <p className="text-sm font-semibold text-primary">
                  {matchedStudents.length === 1
                    ? (lang === 'HI' ? '1 छात्र मिला:' : '1 student found:')
                    : (lang === 'HI' ? `${matchedStudents.length} छात्र मिले — आप कौन हैं?` : `${matchedStudents.length} students found — which one are you?`)}
                </p>
                {matchedStudents.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedStudent?.id === student.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedStudent?.id === student.id ? 'bg-primary' : 'bg-gray-100'
                    }`}>
                      <User size={16} className={selectedStudent?.id === student.id ? 'text-white' : 'text-muted'} />
                    </div>
                    <div>
                      <p className="font-semibold text-primary text-sm">{getStudentDisplayLabel(student)}</p>
                      <p className="text-xs text-muted">{student.sldType ? student.sldType : (lang === 'HI' ? 'स्क्रीनिंग बाकी' : 'Screening pending')}</p>
                    </div>
                    {selectedStudent?.id === student.id && (
                      <CheckCircle2 size={18} className="text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedStudent && (
              <button onClick={() => setStep(3)} className="w-full btn-primary text-lg">
                {S.continue} <ArrowRight size={20} />
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3: PIN Verification ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <button onClick={() => { setStep(2); setPin(''); setPinError(''); }} className="flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors mb-2">
              <ArrowLeft size={14} /> {lang === 'HI' ? 'वापस' : 'Back'}
            </button>

            <div className="text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock size={24} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold text-primary">
                {lang === 'HI' ? `नमस्ते, ${selectedStudent?.name}!` : `Hi, ${selectedStudent?.name}!`}
              </h2>
              <p className="text-sm text-muted mt-1">
                {lang === 'HI' ? 'अपना PIN डालें' : 'Enter your PIN to continue'}
              </p>
            </div>

            <PinPad value={pin} onChange={setPin} lang={lang} />

            {pinError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 animate-fadeIn">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700">{pinError}</p>
              </div>
            )}

            <button
              onClick={handleVerifyPin}
              disabled={pin.length < 4 || isVerifying}
              className="w-full btn-primary text-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isVerifying
                ? <><Loader2 size={18} className="animate-spin" /> {lang === 'HI' ? 'जाँच रहे हैं...' : 'Verifying...'}</>
                : <>{lang === 'HI' ? 'लॉगिन करें' : 'Log In'} <ArrowRight size={20} /></>}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
