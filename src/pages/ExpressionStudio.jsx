// src/pages/ExpressionStudio.jsx
// Route: /expression-studio
// Dysgraphia activity — voice, canvas drawing, word tiles.
// Module 4 will build this page fully.
// Placeholder: unblocks routing.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Square, Palette, AlignLeft, Volume2, Trash2, Check } from 'lucide-react';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { STRINGS } from '../data';
import { transcribeVoice } from '../gemini';

// Word tile pool
const WORD_TILES = [
  'door', 'magical', 'forest', 'found', 'light', 'beautiful', 'dark',
  'stairs', 'Meera', 'she', 'the', 'a', 'and', 'then', 'was', 'went',
  'inside', 'wonderful', 'glowing', 'secret',
];
const BLANK_TILES = 5;

const COLORS = [
  { name: 'orange', value: '#E87722' },
  { name: 'blue',   value: '#2E75B6' },
  { name: 'green',  value: '#2E8B57' },
  { name: 'red',    value: '#DC2626' },
  { name: 'purple', value: '#7C3AED' },
  { name: 'black',  value: '#1B3A6B' },
];

export default function ExpressionStudio() {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;

  const [activeMode, setActiveMode] = useState(null); // null | 'voice' | 'draw' | 'tiles'
  const [companionState, setCompanionState] = useState('idle');
  const [story, setStory] = useState(null); // final story to show
  const [toast, setToast] = useState(false);

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 3500);
  };

  const handleStoryReady = (storyText) => {
    setStory(storyText);
    setCompanionState('happy');
    setTimeout(() => setCompanionState('idle'), 2500);
  };

  const PROMPT_TEXT = lang === 'HI'
    ? 'मीरा को जंगल में एक जादुई दरवाज़ा मिला। उसके पीछे क्या था?'
    : 'Meera found a magical door in the forest. What was behind it?';

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

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-warm/10 flex items-center justify-center text-2xl flex-shrink-0">🎨</div>
          <div>
            <h1 className="text-xl font-bold text-primary">{S.expressionStudio}</h1>
            <p className="text-muted text-sm">
              {lang === 'HI' ? 'अपनी कहानी बताओ — अपने तरीके से!' : 'Tell your story — your way!'}
            </p>
          </div>
        </div>

        {/* ── Writing prompt card ───────────────────────────────── */}
        {!story && (
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-100 rounded-2xl p-5 mb-5">
            <p className="text-4xl text-center mb-3">🌳🚪✨</p>
            <p className="text-primary font-semibold text-lg text-center leading-snug">
              {PROMPT_TEXT}
            </p>
          </div>
        )}

        {/* ── Mode selector (when no story yet) ─────────────────── */}
        {!story && (
          <>
            <p className="text-muted text-sm text-center mb-3">
              {lang === 'HI' ? 'अपना तरीका चुनो:' : 'Choose how to share your story:'}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { id: 'voice', emoji: '🎤', label: lang === 'HI' ? 'बोलो' : 'Tell it' },
                { id: 'draw',  emoji: '🎨', label: lang === 'HI' ? 'बनाओ' : 'Draw it' },
                { id: 'tiles', emoji: '🔤', label: lang === 'HI' ? 'बनाओ' : 'Build it' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setActiveMode(activeMode === mode.id ? null : mode.id)}
                  className={`min-h-[72px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 p-3 transition-all font-semibold text-sm ${
                    activeMode === mode.id
                      ? 'bg-warm text-white border-warm shadow-md scale-105'
                      : 'bg-card text-primary border-gray-200 hover:border-warm hover:bg-orange-50'
                  }`}
                  aria-label={`${mode.label} mode`}
                >
                  <span className="text-2xl">{mode.emoji}</span>
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Active mode panel */}
            {activeMode === 'voice' && (
              <VoiceMode lang={lang} companion={appState} onStoryReady={handleStoryReady} />
            )}
            {activeMode === 'draw' && (
              <DrawMode lang={lang} onStoryReady={handleStoryReady} prompt={PROMPT_TEXT} />
            )}
            {activeMode === 'tiles' && (
              <TileMode lang={lang} onStoryReady={handleStoryReady} />
            )}
          </>
        )}

        {/* ── Your Story output ─────────────────────────────────── */}
        {story && (
          <div className="bg-card rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-warm to-orange-400 px-5 py-4 text-white text-center">
              <p className="text-xl font-bold">📖 {lang === 'HI' ? 'तुम्हारी कहानी' : 'Your Story'}</p>
            </div>
            <div className="p-5">
              {typeof story === 'string' ? (
                <p className="text-primary text-lg leading-relaxed">{story}</p>
              ) : (
                /* drawing — render as image if canvas dataURL */
                <img src={story} alt="Your drawing" className="w-full rounded-xl border border-gray-100" />
              )}
              <p className="text-muted text-sm text-right mt-3 font-medium">
                — {appState.studentName || 'Arjun'}
              </p>

              {/* Companion message */}
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mt-4 flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{appState.companion?.emoji || '🦉'}</span>
                <p className="text-primary text-base font-medium">
                  {lang === 'HI'
                    ? `"तुमने पूरी कहानी सुनाई! आज तुम लेखक हो! 📝"`
                    : `"You wrote a whole story! You're an author today! 📝"`}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={showToast}
                  className="flex-1 bg-success text-white py-3 rounded-xl font-semibold min-h-[48px] text-sm hover:bg-green-700 transition-colors"
                >
                  {lang === 'HI' ? '📤 शिक्षक को भेजें' : '📤 Share with teacher'}
                </button>
                <button
                  onClick={() => { setStory(null); setActiveMode(null); }}
                  className="flex-1 border-2 border-accent text-accent py-3 rounded-xl font-semibold min-h-[48px] text-sm hover:bg-accent hover:text-white transition-all"
                >
                  {lang === 'HI' ? '← घर' : '← Home'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Struggling button ─────────────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-4 z-30 pointer-events-none">
          <button
            onClick={() => navigate('/home')}
            className="pointer-events-auto bg-warm text-white rounded-xl px-5 py-2 min-h-[48px] text-sm font-semibold shadow-lg hover:bg-orange-600 transition-colors"
          >
            😰 {S.iAmStruggling}
          </button>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2 max-w-xs text-center">
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
function VoiceMode({ lang, companion, onStoryReady }) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const startRecording = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      setError(lang === 'HI' ? 'आपके ब्राउज़र में वॉइस सपोर्ट नहीं है।' : 'Voice not supported in this browser.');
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
    recognition.onerror = () => setError(lang === 'HI' ? 'माइक्रोफोन एक्सेस नहीं मिला।' : 'Could not access microphone.');
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
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
      {/* Record button */}
      <div className="flex flex-col items-center gap-4 mb-4">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-white transition-all shadow-lg min-h-[96px] ${
            recording ? 'bg-red-500 animate-pulse scale-110' : 'bg-warm hover:bg-orange-600 hover:scale-105'
          }`}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          {recording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
        </button>

        {/* Waveform (3 animated bars) */}
        {recording && (
          <div className="flex items-end gap-1 h-8" aria-hidden>
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
          <p className="text-muted text-xs mb-1">{lang === 'HI' ? 'तुम कह रहे हो:' : 'You said:'}</p>
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
          className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
        >
          {polishing ? (
            <>
              <span className="animate-spin text-xl">⏳</span>
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
}

// ─── Draw Mode ────────────────────────────────────────────────────────────────
function DrawMode({ lang, onStoryReady, prompt }) {
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
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      {/* Color palette */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {COLORS.map((c) => (
          <button
            key={c.name}
            onClick={() => setColor(c.value)}
            className={`w-9 h-9 rounded-full border-2 transition-transform min-h-[36px] ${color === c.value ? 'scale-125 border-primary' : 'border-gray-200 hover:scale-110'}`}
            style={{ backgroundColor: c.value }}
            aria-label={`Color: ${c.name}`}
          />
        ))}
        <button
          onClick={clearCanvas}
          className="ml-auto flex items-center gap-1 text-muted text-sm border border-gray-200 px-3 rounded-xl min-h-[36px] hover:bg-surface transition-colors"
          aria-label="Clear canvas"
        >
          <Trash2 className="w-4 h-4" />
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

      <p className="text-muted text-xs text-center mt-2 mb-3">
        {lang === 'HI' ? `"${prompt}"` : `"${prompt}"`}
      </p>

      <button
        onClick={handleDone}
        className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
      >
        <Check className="w-5 h-5" />
        {lang === 'HI' ? 'चित्र पूरा हुआ!' : 'Done drawing!'}
      </button>
    </div>
  );
}

// ─── Word Tile Mode ───────────────────────────────────────────────────────────
function TileMode({ lang, onStoryReady }) {
  const [placed, setPlaced] = useState([]); // words in story area
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
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      {/* Story area */}
      <div className="bg-surface rounded-xl p-3 min-h-[64px] mb-3 border border-gray-100">
        <p className="text-muted text-xs mb-1.5">{lang === 'HI' ? 'तुम्हारी कहानी:' : 'Your story:'}</p>
        {placed.length === 0 ? (
          <p className="text-muted text-sm italic">{lang === 'HI' ? 'नीचे से शब्द चुनो...' : 'Pick tiles from below...'}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {placed.map((w, i) => (
              <button
                key={i}
                onClick={() => removePlaced(i)}
                className="bg-warm text-white px-2 py-1 rounded-lg text-sm font-medium min-h-[32px] flex items-center gap-1 hover:bg-orange-600 transition-colors"
                aria-label={`Remove word: ${w}`}
              >
                {w} ×
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        {placed.length > 0 && (
          <>
            <button
              onClick={readStory}
              className="flex items-center gap-1.5 border-2 border-accent text-accent px-3 py-2 rounded-xl text-sm font-semibold min-h-[48px] hover:bg-accent hover:text-white transition-all"
            >
              <Volume2 className="w-4 h-4" />
              {lang === 'HI' ? 'पढ़ो' : 'Read'}
            </button>
            <button
              onClick={handleDone}
              className="flex-1 bg-warm text-white px-3 py-2 rounded-xl text-sm font-semibold min-h-[48px] hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" />
              {lang === 'HI' ? 'कहानी पूरी!' : 'Story done!'}
            </button>
          </>
        )}
      </div>

      {/* Word tiles pool */}
      <p className="text-muted text-xs mb-2">{lang === 'HI' ? 'शब्द चुनो:' : 'Pick words:'}</p>
      <div className="flex flex-wrap gap-2">
        {WORD_TILES.map((word) => (
          <button
            key={word}
            onClick={() => addTile(word)}
            className="bg-accent/10 text-accent border border-accent/30 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer min-h-[48px] hover:bg-accent hover:text-white transition-colors"
          >
            {word}
          </button>
        ))}

        {/* Blank custom tiles */}
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
                  className="border-2 border-accent rounded-lg px-2 py-1 text-sm w-24 min-h-[48px] focus:outline-none focus:ring-2 focus:ring-accent"
                  onBlur={() => setShowInputIdx(null)}
                />
              </form>
            ) : (
              <button
                onClick={() => setShowInputIdx(i)}
                className="bg-gray-50 border-2 border-dashed border-gray-300 text-muted rounded-lg px-3 py-2 text-sm min-h-[48px] hover:border-accent hover:text-accent transition-colors"
              >
                + {lang === 'HI' ? 'शब्द जोड़ें' : 'Add word'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

