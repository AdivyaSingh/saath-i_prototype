// src/pages/ExpressionStudio.jsx
// Route: /expression-studio
// Dysgraphia activity — voice recording, canvas drawing, and word tile modes.
// Supports multiple prompts, AI prompt generation, Hindi mode.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, PenTool, Type, Volume2, Eraser, Check, Heart,
  ChevronLeft, ChevronRight, Loader2, Sparkles, Send, Home, RefreshCw
} from 'lucide-react';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { EXPRESSION_PROMPTS, STRINGS } from '../data';
import { transcribeVoice, generateExpressionPrompt } from '../gemini';
import { updateStudentProgress } from '../firebase';

// ── Color palette for drawing ────────────────────────────────────────────────
const COLORS = [
  { name: 'orange', value: '#E87722' },
  { name: 'blue',   value: '#2E75B6' },
  { name: 'green',  value: '#2E8B57' },
  { name: 'red',    value: '#DC2626' },
  { name: 'purple', value: '#7C3AED' },
  { name: 'black',  value: '#1B3A6B' },
];

// ── Blank tile count ─────────────────────────────────────────────────────────
const BLANK_TILES = 5;

export default function ExpressionStudio() {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;

  // ── Prompt cycling state ──────────────────────────────────────────────────
  const [promptIdx, setPromptIdx] = useState(0);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // Current prompt data
  const currentPrompt = generatedPrompt || EXPRESSION_PROMPTS[promptIdx] || EXPRESSION_PROMPTS[0];
  const promptText = generatedPrompt
    ? generatedPrompt.prompt
    : (lang === 'HI' && currentPrompt.promptHI ? currentPrompt.promptHI : currentPrompt.prompt);
  const sceneText = currentPrompt.scene || '';

  // ── Mode and story state ──────────────────────────────────────────────────
  const [activeMode, setActiveMode] = useState(null); // null | 'voice' | 'draw' | 'tiles'
  const [companionState, setCompanionState] = useState('idle');
  const [story, setStory] = useState(null);
  const [toast, setToast] = useState(false);

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 3500);
  };

  const handleStoryReady = async (storyText) => {
    setStory(storyText);
    setCompanionState('happy');
    setTimeout(() => setCompanionState('idle'), 2500);

    // Track completion in app state and Firebase
    if (!appState.activitiesCompleted?.expression) {
      const newCompleted = {
        ...appState.activitiesCompleted,
        expression: (appState.activitiesCompleted?.expression || 0) + 1
      };
      updateState({ activitiesCompleted: newCompleted });
      
      if (appState.firebaseStudentId) {
        await updateStudentProgress(appState.firebaseStudentId, {
          lastActivity: 'Expression Studio',
          activitiesCompleted: newCompleted
        });
      }
    }
  };

  // ── Prompt navigation ─────────────────────────────────────────────────────
  const handleNextPrompt = () => {
    setGeneratedPrompt(null);
    setPromptIdx((prev) => (prev + 1) % EXPRESSION_PROMPTS.length);
    setActiveMode(null);
    setStory(null);
  };

  const handlePrevPrompt = () => {
    setGeneratedPrompt(null);
    setPromptIdx((prev) => (prev - 1 + EXPRESSION_PROMPTS.length) % EXPRESSION_PROMPTS.length);
    setActiveMode(null);
    setStory(null);
  };

  // ── AI prompt generation ──────────────────────────────────────────────────
  const handleGeneratePrompt = async () => {
    setGeneratingPrompt(true);
    const classLevel = appState.studentClass || 4;
    const result = await generateExpressionPrompt(classLevel, lang);
    setGeneratingPrompt(false);
    if (result) {
      setGeneratedPrompt({
        ...result,
        id: 'generated',
        wordTiles: result.wordTiles || [],
        wordTilesHI: result.wordTilesHI || result.wordTiles || [],
      });
      setActiveMode(null);
      setStory(null);
    }
  };

  // Get word tiles based on language
  const getWordTiles = () => {
    if (generatedPrompt) {
      return lang === 'HI' && generatedPrompt.wordTilesHI
        ? generatedPrompt.wordTilesHI
        : generatedPrompt.wordTiles || [];
    }
    if (lang === 'HI' && currentPrompt.wordTilesHI) {
      return currentPrompt.wordTilesHI;
    }
    return currentPrompt.wordTiles || [];
  };

  // ── Mode buttons config ───────────────────────────────────────────────────
  const modes = [
    { id: 'voice', icon: Mic,     label: lang === 'HI' ? 'बोलो' : 'Tell it' },
    { id: 'draw',  icon: PenTool, label: lang === 'HI' ? 'बनाओ' : 'Draw it' },
    { id: 'tiles', icon: Type,    label: lang === 'HI' ? 'लिखो' : 'Build it' },
  ];

  return (
    <Layout
      title={S.expressionStudio}
      showBack
      showCompanion
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      <div className="max-w-md mx-auto px-4 py-4 pb-24">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-warm/10 flex items-center justify-center flex-shrink-0">
            <PenTool className="w-6 h-6 text-warm" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">{S.expressionStudio}</h1>
            <p className="text-muted text-sm">
              {lang === 'HI' ? 'अपनी कहानी बताओ — अपने तरीके से!' : 'Tell your story — your way!'}
            </p>
          </div>
        </div>

        {/* ── Prompt card (when no story yet) ──────────────────── */}
        {!story && (
          <>
            <div className="relative bg-card rounded-2xl border-2 border-transparent shadow-sm overflow-hidden mb-4"
              style={{
                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #E87722, #2E75B6, #2E8B57)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              {/* Subtle gradient background pattern instead of emoji */}
              <div className="absolute inset-0 bg-gradient-to-br from-warm/5 via-transparent to-accent/5 pointer-events-none" />

              <div className="relative p-5">
                {/* Scene description */}
                {sceneText && (
                  <p className="text-muted text-xs uppercase tracking-wider mb-2 font-medium">
                    {sceneText}
                  </p>
                )}
                <p className="text-primary font-semibold text-lg leading-snug">
                  {promptText}
                </p>

                {/* Prompt navigation */}
                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={handlePrevPrompt}
                    className="w-10 h-10 rounded-xl bg-surface text-muted flex items-center justify-center hover:bg-accent/10 hover:text-accent transition-colors min-h-[48px]"
                    aria-label="Previous prompt"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-xs text-muted font-medium">
                    {generatedPrompt
                      ? (lang === 'HI' ? 'AI द्वारा' : 'AI Generated')
                      : `${promptIdx + 1} / ${EXPRESSION_PROMPTS.length}`}
                  </span>
                  <button
                    onClick={handleNextPrompt}
                    className="w-10 h-10 rounded-xl bg-surface text-muted flex items-center justify-center hover:bg-accent/10 hover:text-accent transition-colors min-h-[48px]"
                    aria-label="Next prompt"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Generate new prompt button */}
            <button
              onClick={handleGeneratePrompt}
              disabled={generatingPrompt}
              className="w-full bg-gradient-to-r from-accent to-primary text-white py-2.5 rounded-xl font-semibold text-sm min-h-[48px] flex items-center justify-center gap-2 mb-5 hover:opacity-90 transition-opacity disabled:opacity-60"
              aria-label="Generate new prompt with AI"
            >
              {generatingPrompt ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {lang === 'HI' ? 'नया विषय बन रहा है...' : 'Creating new prompt...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {lang === 'HI' ? 'AI से नया विषय बनाएं' : 'Generate New Prompt'}
                </>
              )}
            </button>

            {/* ── Mode selector ────────────────────────────────── */}
            <p className="text-muted text-sm text-center mb-3">
              {lang === 'HI' ? 'अपना तरीका चुनो:' : 'Choose how to share your story:'}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {modes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(activeMode === mode.id ? null : mode.id)}
                    className={`min-h-[72px] rounded-2xl border-2 flex flex-col items-center justify-center gap-2 p-3 transition-all font-semibold text-sm ${
                      activeMode === mode.id
                        ? 'bg-warm text-white border-warm shadow-md scale-105'
                        : 'bg-card text-primary border-gray-200 hover:border-warm/40 hover:bg-warm/5'
                    }`}
                    aria-label={`${mode.label} mode`}
                  >
                    <Icon className="w-6 h-6" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Active mode panel ────────────────────────────── */}
            {activeMode === 'voice' && (
              <VoiceMode lang={lang} onStoryReady={handleStoryReady} />
            )}
            {activeMode === 'draw' && (
              <DrawMode lang={lang} onStoryReady={handleStoryReady} prompt={promptText} />
            )}
            {activeMode === 'tiles' && (
              <TileMode lang={lang} onStoryReady={handleStoryReady} wordTiles={getWordTiles()} />
            )}
          </>
        )}

        {/* ── Your Story output card ───────────────────────────── */}
        {story && (
          <div className="animate-slideUp">
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden"
              style={{
                backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #E87722, #2E75B6)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                border: '2px solid transparent',
              }}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-warm to-accent px-5 py-4 text-white text-center">
                <p className="text-xl font-bold flex items-center justify-center gap-2">
                  <PenTool className="w-5 h-5" />
                  {lang === 'HI' ? 'तुम्हारी कहानी' : 'Your Story'}
                </p>
              </div>

              <div className="p-5">
                {/* Story content */}
                {typeof story === 'string' ? (
                  <p className="text-primary text-lg leading-relaxed">{story}</p>
                ) : (
                  <img
                    src={story}
                    alt={lang === 'HI' ? 'तुम्हारा चित्र' : 'Your drawing'}
                    className="w-full rounded-xl border border-gray-100"
                  />
                )}

                {/* Author */}
                <p className="text-muted text-sm text-right mt-3 font-medium">
                  — {appState.studentName || 'Arjun'}
                </p>

                {/* Companion celebration message */}
                <div className="bg-warm/5 border border-warm/15 rounded-xl p-3 mt-4 flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{appState.companion?.emoji || '🦉'}</span>
                  <p className="text-primary text-base font-medium">
                    {lang === 'HI'
                      ? `"${appState.companion?.nickname || 'Gyaan'} कहता है — तुमने पूरी कहानी सुनाई! आज तुम लेखक हो!"`
                      : `"${appState.companion?.nickname || 'Gyaan'} says — You wrote a whole story! You're an author today!"`}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={showToast}
                    className="flex-1 bg-success text-white py-3 rounded-xl font-semibold min-h-[48px] text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    aria-label="Share story with teacher"
                  >
                    <Send className="w-4 h-4" />
                    {lang === 'HI' ? 'शिक्षक को भेजें' : 'Share with teacher'}
                  </button>
                  <button
                    onClick={() => navigate('/home')}
                    className="flex-1 border-2 border-accent text-accent py-3 rounded-xl font-semibold min-h-[48px] text-sm hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
                    aria-label="Back to home"
                  >
                    <Home className="w-4 h-4" />
                    {lang === 'HI' ? 'घर जाएं' : 'Back to Home'}
                  </button>
                </div>

                {/* Try another prompt */}
                <button
                  onClick={() => { setStory(null); setActiveMode(null); handleNextPrompt(); }}
                  className="w-full mt-3 text-accent text-sm font-medium underline underline-offset-2 hover:text-primary transition-colors flex items-center justify-center gap-1.5 min-h-[48px]"
                  aria-label="Try another prompt"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {lang === 'HI' ? 'और कहानी लिखें' : 'Try another prompt'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── "I need help" button ──────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-4 z-30 pointer-events-none">
          <button
            onClick={() => navigate('/home')}
            className="pointer-events-auto bg-warm/90 backdrop-blur-sm text-white rounded-xl px-5 py-2 min-h-[48px] text-sm font-semibold shadow-lg hover:bg-warm transition-colors flex items-center gap-2"
            aria-label="I need help"
          >
            <Heart className="w-4 h-4" />
            {S.iAmStruggling}
          </button>
        </div>
      </div>

      {/* ── Toast notification ──────────────────────────────── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2 max-w-xs text-center animate-slideUp">
          <Check className="w-4 h-4 flex-shrink-0" />
          {lang === 'HI'
            ? 'कहानी पोर्टफोलियो में सेव हुई! Ms. Lata इसे देख सकती हैं।'
            : 'Story saved to your portfolio! Ms. Lata can see it on her dashboard.'}
        </div>
      )}
    </Layout>
  );
}

// ─── Voice Mode ───────────────────────────────────────────────────────────────
const VoiceMode = ({ lang, onStoryReady }) => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const startRecording = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      setError(
        lang === 'HI'
          ? 'आपके ब्राउज़र में वॉइस सपोर्ट नहीं है।'
          : 'Voice not supported in this browser.'
      );
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setTranscript(t);
    };
    recognition.onerror = () =>
      setError(
        lang === 'HI'
          ? 'माइक्रोफोन एक्सेस नहीं मिला।'
          : 'Could not access microphone.'
      );
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setTranscript('');
    setError('');
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const handleDone = async () => {
    if (!transcript.trim()) return;
    setPolishing(true);
    const polished = await transcribeVoice(transcript);
    setPolishing(false);
    onStoryReady(polished || transcript);
  };

  return (
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 animate-fadeIn">
      {/* Record button — large, professional circle */}
      <div className="flex flex-col items-center gap-4 mb-4">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-white transition-all shadow-lg min-h-[96px] ${
            recording
              ? 'bg-red-500 animate-pulse scale-110'
              : 'bg-warm hover:opacity-90 hover:scale-105'
          }`}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          {recording ? (
            <MicOff className="w-10 h-10" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </button>

        {/* Waveform bars — CSS animated */}
        {recording && (
          <div className="flex items-end gap-1 h-8" aria-hidden="true">
            {[0.4, 0.9, 0.6, 1, 0.7, 0.5, 0.85].map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-warm"
                style={{
                  height: `${h * 28}px`,
                  animation: `waveBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                }}
              />
            ))}
          </div>
        )}

        <p className="text-primary font-medium text-base text-center">
          {recording
            ? (lang === 'HI' ? 'सुन रहा हूँ... बोलते रहो!' : 'Listening... keep talking!')
            : (lang === 'HI' ? 'माइक टैप करो और बोलो' : 'Tap the mic and speak')}
        </p>
      </div>

      {/* Live transcript */}
      {transcript && (
        <div className="bg-surface rounded-xl p-3 mb-4 border border-gray-100">
          <p className="text-muted text-xs mb-1">
            {lang === 'HI' ? 'तुम कह रहे हो:' : 'You said:'}
          </p>
          <p className="text-primary text-base">{transcript}</p>
        </div>
      )}

      {error && (
        <p className="text-warm text-sm text-center mb-3">{error}</p>
      )}

      {/* Done button */}
      {transcript && !recording && (
        <button
          onClick={handleDone}
          disabled={polishing}
          className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          aria-label="Complete story"
        >
          {polishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {lang === 'HI' ? 'कहानी तैयार हो रही है...' : 'Finishing your story...'}
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              {lang === 'HI' ? 'कहानी पूरी हुई!' : 'Story complete!'}
            </>
          )}
        </button>
      )}

      {/* Inline CSS for waveform animation */}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
};

// ─── Draw Mode ────────────────────────────────────────────────────────────────
const DrawMode = ({ lang, onStoryReady, prompt }) => {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0].value);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
  };

  const draw = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [drawing, color]);

  const endDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    onStoryReady(dataURL);
  };

  return (
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 animate-fadeIn">
      {/* Color palette circles */}
      <div className="flex gap-2 mb-3 items-center">
        {COLORS.map((c) => (
          <button
            key={c.name}
            onClick={() => setColor(c.value)}
            className={`w-9 h-9 rounded-full border-2 transition-transform min-h-[36px] ${
              color === c.value
                ? 'scale-125 border-primary shadow-sm'
                : 'border-gray-200 hover:scale-110'
            }`}
            style={{ backgroundColor: c.value }}
            aria-label={`Color: ${c.name}`}
          />
        ))}
        {/* Clear button with Eraser icon */}
        <button
          onClick={clearCanvas}
          className="ml-auto flex items-center gap-1.5 text-muted text-sm border border-gray-200 px-3 rounded-xl min-h-[36px] hover:bg-surface transition-colors"
          aria-label="Clear canvas"
        >
          <Eraser className="w-4 h-4" />
          {lang === 'HI' ? 'साफ' : 'Clear'}
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={380}
        height={250}
        className="w-full rounded-xl bg-surface border border-gray-100 touch-none cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        aria-label="Drawing canvas"
      />

      <p className="text-muted text-xs text-center mt-2 mb-3 italic">
        &quot;{prompt}&quot;
      </p>

      {/* Done button with Check icon */}
      <button
        onClick={handleDone}
        className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        aria-label="Finish drawing"
      >
        <Check className="w-5 h-5" />
        {lang === 'HI' ? 'चित्र पूरा हुआ!' : 'Done drawing!'}
      </button>
    </div>
  );
};

// ─── Word Tile Mode ───────────────────────────────────────────────────────────
const TileMode = ({ lang, onStoryReady, wordTiles }) => {
  const [placed, setPlaced] = useState([]);
  const [customInputs, setCustomInputs] = useState(Array(BLANK_TILES).fill(''));
  const [showInputIdx, setShowInputIdx] = useState(null);

  const addTile = (word) => {
    if (!word.trim()) return;
    setPlaced((prev) => [...prev, word.trim()]);
  };

  const removePlaced = (idx) => {
    setPlaced((prev) => prev.filter((_, i) => i !== idx));
  };

  const readStory = () => {
    const sentence = placed.join(' ');
    if (!sentence || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(sentence);
    utter.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const handleDone = () => {
    if (!placed.length) return;
    onStoryReady(placed.join(' '));
  };

  return (
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 animate-fadeIn">
      {/* Story area at top */}
      <div className="bg-surface rounded-xl p-3 min-h-[72px] mb-4 border border-gray-100">
        <p className="text-muted text-xs mb-1.5 font-medium">
          {lang === 'HI' ? 'तुम्हारी कहानी:' : 'Your story:'}
        </p>
        {placed.length === 0 ? (
          <p className="text-muted text-sm italic">
            {lang === 'HI' ? 'नीचे से शब्द चुनो...' : 'Pick tiles from below...'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {placed.map((w, i) => (
              <button
                key={i}
                onClick={() => removePlaced(i)}
                className="bg-warm text-white px-2.5 py-1 rounded-lg text-sm font-medium min-h-[32px] flex items-center gap-1 hover:opacity-80 transition-opacity"
                aria-label={`Remove word: ${w}`}
              >
                {w} ×
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions row */}
      <div className="flex gap-2 mb-4">
        {placed.length > 0 && (
          <>
            <button
              onClick={readStory}
              className="flex items-center gap-1.5 border-2 border-accent text-accent px-3 py-2 rounded-xl text-sm font-semibold min-h-[48px] hover:bg-accent hover:text-white transition-all"
              aria-label="Read story aloud"
            >
              <Volume2 className="w-4 h-4" />
              {lang === 'HI' ? 'सुनो' : 'Read'}
            </button>
            <button
              onClick={handleDone}
              className="flex-1 bg-warm text-white px-3 py-2 rounded-xl text-sm font-semibold min-h-[48px] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
              aria-label="Complete story"
            >
              <Check className="w-4 h-4" />
              {lang === 'HI' ? 'कहानी पूरी!' : 'Story done!'}
            </button>
          </>
        )}
      </div>

      {/* Word tiles pool */}
      <p className="text-muted text-xs mb-2 font-medium">
        {lang === 'HI' ? 'शब्द चुनो:' : 'Pick words:'}
      </p>
      <div className="flex flex-wrap gap-2">
        {wordTiles.map((word) => (
          <button
            key={word}
            onClick={() => addTile(word)}
            className="bg-accent/10 text-accent border border-accent/20 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer min-h-[48px] hover:bg-accent hover:text-white transition-colors"
            aria-label={`Add word: ${word}`}
          >
            {word}
          </button>
        ))}

        {/* Custom blank tiles */}
        {Array.from({ length: BLANK_TILES }).map((_, i) => (
          <div key={`blank_${i}`} className="relative">
            {showInputIdx === i ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addTile(customInputs[i]);
                  const updated = [...customInputs];
                  updated[i] = '';
                  setCustomInputs(updated);
                  setShowInputIdx(null);
                }}
                className="flex"
              >
                <input
                  autoFocus
                  value={customInputs[i]}
                  onChange={(e) => {
                    const updated = [...customInputs];
                    updated[i] = e.target.value;
                    setCustomInputs(updated);
                  }}
                  placeholder={lang === 'HI' ? 'शब्द...' : 'word...'}
                  className="border-2 border-accent rounded-lg px-2 py-1 text-sm w-24 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent/40"
                  onBlur={() => setShowInputIdx(null)}
                  aria-label="Type a custom word"
                />
              </form>
            ) : (
              <button
                onClick={() => setShowInputIdx(i)}
                className="bg-surface border-2 border-dashed border-gray-300 text-muted rounded-lg px-3 py-2 text-sm min-h-[48px] hover:border-accent hover:text-accent transition-colors flex items-center gap-1"
                aria-label="Add custom word"
              >
                <Plus className="w-3.5 h-3.5" />
                {lang === 'HI' ? 'शब्द' : 'Add'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
