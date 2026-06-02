// src/pages/Screening.jsx
// Route: /screening
// 3 mini-games that identify SLD type. Always framed as games, never as tests.
// Module 2 will build this page fully.
// Placeholder: unblocks routing.

// src/pages/Screening.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2 } from 'lucide-react';
import { useApp } from '../App';
import { STRINGS } from '../data';
import Layout from '../components/Layout';

// ─── Rhyming game data ────────────────────────────────────────────────────────
const RHYME_ROUNDS = [
  [
    { word: 'CAT',  emoji: '🐱', audio: 'cat' },
    { word: 'BAT',  emoji: '🦇', audio: 'bat' },
    { word: 'DOG',  emoji: '🐶', audio: 'dog' },
  ],
  [
    { word: 'HAT',  emoji: '🎩', audio: 'hat' },
    { word: 'MAT',  emoji: '🧺', audio: 'mat' },
    { word: 'BUS',  emoji: '🚌', audio: 'bus' },
  ],
  [
    { word: 'PIN',  emoji: '📌', audio: 'pin' },
    { word: 'WIN',  emoji: '🏆', audio: 'win' },
    { word: 'SUN',  emoji: '☀️', audio: 'sun' },
  ],
];
// Correct rhyming pairs (indices into each round's card array)
const RHYME_CORRECT = [[0, 1], [0, 1], [0, 1]];

// ─── Pile comparison data ─────────────────────────────────────────────────────
const PILE_ROUNDS = [
  { left: 3,  right: 7, answer: 'right' },
  { left: 6,  right: 8, answer: 'right' },
  { left: 5,  right: 6, answer: 'right' },
];

// ─── Bezier path for canvas trace (cubic, 320×180 canvas) ────────────────────
const BEZIER = {
  p0: { x: 44,  y: 142 }, // owl start
  p1: { x: 118, y: 28  }, // control 1
  p2: { x: 202, y: 162 }, // control 2
  p3: { x: 278, y: 42  }, // star end
};

function sampleBezier(n = 200) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push({
      x: mt*mt*mt*BEZIER.p0.x + 3*mt*mt*t*BEZIER.p1.x + 3*mt*t*t*BEZIER.p2.x + t*t*t*BEZIER.p3.x,
      y: mt*mt*mt*BEZIER.p0.y + 3*mt*mt*t*BEZIER.p1.y + 3*mt*t*t*BEZIER.p2.y + t*t*t*BEZIER.p3.y,
    });
  }
  return pts;
}

function minDistToPath(pt, pathPts) {
  return pathPts.reduce((min, pp) => {
    const d = Math.hypot(pt.x - pp.x, pt.y - pp.y);
    return d < min ? d : min;
  }, Infinity);
}

function computeTraceScore(drawn) {
  if (drawn.length < 3) return 0;
  const path = sampleBezier(200);
  let onPath = 0;
  for (const p of drawn) {
    if (minDistToPath(p, path) <= 22) onPath++;
  }
  return Math.round((onPath / drawn.length) * 100);
}

// ─── Canvas drawing helpers ───────────────────────────────────────────────────
function drawGuidePath(ctx, userPoints, done) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#EFF6FF'; // blue-50
  ctx.fillRect(0, 0, width, height);

  // Dotted guide path
  ctx.save();
  ctx.setLineDash([10, 7]);
  ctx.strokeStyle = '#93C5FD'; // blue-300
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(BEZIER.p0.x, BEZIER.p0.y);
  ctx.bezierCurveTo(BEZIER.p1.x, BEZIER.p1.y, BEZIER.p2.x, BEZIER.p2.y, BEZIER.p3.x, BEZIER.p3.y);
  ctx.stroke();
  ctx.restore();

  // Start glow circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(BEZIER.p0.x, BEZIER.p0.y, 16, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#2E8B57' : '#E87722';
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // End glow circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(BEZIER.p3.x, BEZIER.p3.y, 16, 0, Math.PI * 2);
  ctx.fillStyle = done ? '#2E8B57' : '#FBBF24';
  ctx.globalAlpha = 0.25;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Emojis — use text since canvas doesn't reliably draw SVG emoji everywhere
  ctx.font = '26px serif';
  ctx.fillText('🦉', BEZIER.p0.x - 20, BEZIER.p0.y + 8);
  ctx.fillText('⭐', BEZIER.p3.x - 14, BEZIER.p3.y + 8);

  // User trace
  if (userPoints.length > 1) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = done ? '#2E8B57' : '#E87722';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(userPoints[0].x, userPoints[0].y);
    for (let i = 1; i < userPoints.length; i++) {
      ctx.lineTo(userPoints[i].x, userPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function getCanvasPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
  };
}

// ─── SpeechSynthesis helper ───────────────────────────────────────────────────
function speakWord(word, lang) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
  utt.rate = 0.85;
  window.speechSynthesis.speak(utt);
}

// ─── deriveProfile (always dyslexia for demo) ─────────────────────────────────
function deriveProfile() {
  // For demo: always returns 'dyslexia' to showcase Arjun's full journey.
  // Production would use real Bayesian Knowledge Tracing across activity signals.
  return 'dyslexia';
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Screening() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  // ── Activity progression ───────────────────────────────────────────────────
  const [activityIndex, setActivityIndex] = useState(0); // 0,1,2,3(done)
  const [transitioning, setTransitioning] = useState(false);
  const [companionState, setCompanionState] = useState('idle');

  const advanceActivity = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setActivityIndex(i => i + 1);
      setCompanionState('idle');
      setTransitioning(false);
    }, 600);
  }, []);

  // ── Activity 1: Rhyming ────────────────────────────────────────────────────
  const [rhymeRound,    setRhymeRound]    = useState(0);
  const [rhymeSelected, setRhymeSelected] = useState([]); // array of indices
  const [rhymeFeedback, setRhymeFeedback] = useState(null); // null | 'correct'
  const rhymeLocked = useRef(false);

  const handleRhymeTap = (idx) => {
    if (rhymeLocked.current || rhymeFeedback) return;

    const next = rhymeSelected.includes(idx)
      ? rhymeSelected.filter(i => i !== idx)
      : [...rhymeSelected, idx].slice(-2); // max 2 selected

    setRhymeSelected(next);

    if (next.length === 2) {
      rhymeLocked.current = true;
      const [a, b] = RHYME_CORRECT[rhymeRound];
      const isCorrect = next.includes(a) && next.includes(b);

      if (isCorrect) {
        setRhymeFeedback('correct');
        setCompanionState('happy');
        setTimeout(() => {
          const nextRound = rhymeRound + 1;
          rhymeLocked.current = false;
          setRhymeSelected([]);
          setRhymeFeedback(null);
          if (nextRound < RHYME_ROUNDS.length) {
            setRhymeRound(nextRound);
            setCompanionState('idle');
          } else {
            advanceActivity();
          }
        }, 1600);
      } else {
        // No "wrong" — companion becomes encouraging, brief pause, then reset round
        setCompanionState('encouraging');
        setTimeout(() => {
          rhymeLocked.current = false;
          setRhymeSelected([]);
          setCompanionState('idle');
        }, 1200);
      }
    }
  };

  // ── Activity 2: Pile comparison ────────────────────────────────────────────
  const [pileRound,      setPileRound]      = useState(0);
  const [pileChosen,     setPileChosen]     = useState(null); // 'left' | 'right' | null
  const [pileHighlight,  setPileHighlight]  = useState(false);
  const pileLocked = useRef(false);

  const handlePileTap = (side) => {
    if (pileLocked.current || pileChosen) return;
    pileLocked.current = true;
    setPileChosen(side);

    const { answer } = PILE_ROUNDS[pileRound];
    const correct = side === answer;

    if (correct) {
      setCompanionState('happy');
      setTimeout(() => {
        const nextRound = pileRound + 1;
        pileLocked.current = false;
        setPileChosen(null);
        setPileHighlight(false);
        if (nextRound < PILE_ROUNDS.length) {
          setPileRound(nextRound);
          setCompanionState('idle');
        } else {
          advanceActivity();
        }
      }, 1400);
    } else {
      // Highlight the correct pile — no red, no "wrong"
      setCompanionState('encouraging');
      setPileHighlight(true);
      setTimeout(() => {
        pileLocked.current = false;
        setPileChosen(null);
        setPileHighlight(false);
        setCompanionState('idle');
      }, 1500);
    }
  };

  // ── Activity 3: Canvas trace ───────────────────────────────────────────────
  const canvasRef     = useRef(null);
  const isDrawingRef  = useRef(false);
  const drawnRef      = useRef([]); // {x,y}[]
  const [traceDone,   setTraceDone]   = useState(false);
  const [traceScore,  setTraceScore]  = useState(0);

  useEffect(() => {
    if (activityIndex === 2) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      drawGuidePath(ctx, [], false);
    }
  }, [activityIndex]);

  const redrawCanvas = useCallback((done = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawGuidePath(ctx, drawnRef.current, done);
  }, []);

  const handlePointerDown = (e) => {
    if (traceDone) return;
    e.preventDefault();
    isDrawingRef.current = true;
    drawnRef.current = [];
    const pos = getCanvasPos(e, canvasRef.current);
    drawnRef.current.push(pos);
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || traceDone) return;
    e.preventDefault();
    const pos = getCanvasPos(e, canvasRef.current);
    drawnRef.current.push(pos);
    redrawCanvas(false);
  };

  const handlePointerUp = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    if (drawnRef.current.length < 5) return; // too short — not a real trace

    const score = computeTraceScore(drawnRef.current);
    setTraceScore(score);
    setTraceDone(true);
    setCompanionState('happy');
    redrawCanvas(true);
  };

  // ── Completion ─────────────────────────────────────────────────────────────
  const handleComplete = () => {
    updateState({ sldType: deriveProfile() });
    navigate('/home');
  };

  // ── Remaining games text ───────────────────────────────────────────────────
  const remainingText = [
    lang === 'HI' ? '2 और मिनी-गेम बाकी हैं 🎮' : '2 more mini-games to go 🎮',
    lang === 'HI' ? '1 और मिनी-गेम बाकी है 🎮'  : '1 more mini-game to go 🎮',
    lang === 'HI' ? 'आखिरी गेम है! 🎮'           : 'Last game! 🎮',
  ];

  return (
    <Layout
      title={lang === 'HI' ? 'खेलते-खेलते सीखो' : 'Play & Discover'}
      showBack={false}
      showCompanion
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      <div className={`max-w-md mx-auto px-4 py-5 pb-24 bg-surface min-h-screen transition-opacity duration-500 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>

        {/* ══════════════════════════════════════════════════
            ACTIVITIES 0 / 1 / 2 — Games
        ══════════════════════════════════════════════════ */}
        {activityIndex < 3 && (
          <>
            {/* Header */}
            <div className="mb-5 text-center">
              <h2 className="text-2xl font-bold text-primary">{S.screeningTitle}</h2>
              {activityIndex < 3 && (
                <p className="text-sm text-muted mt-1 font-medium">{remainingText[activityIndex]}</p>
              )}
            </div>

            {/* ═══ ACTIVITY 0 — Rhyming Words ═══ */}
            {activityIndex === 0 && (
              <div className="space-y-5">
                <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-lg font-semibold text-primary">
                    {lang === 'HI' ? 'दो ताल मिलाने वाले शब्द चुनो! 🎵' : 'Tap the two words that rhyme! 🎵'}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {lang === 'HI'
                      ? `दौर ${rhymeRound + 1} / ${RHYME_ROUNDS.length}`
                      : `Round ${rhymeRound + 1} of ${RHYME_ROUNDS.length}`}
                  </p>
                </div>

                {/* Word cards */}
                <div className="grid grid-cols-3 gap-3">
                  {RHYME_ROUNDS[rhymeRound].map((card, idx) => {
                    const isSelected = rhymeSelected.includes(idx);
                    const [a, b] = RHYME_CORRECT[rhymeRound];
                    const isCorrectCard = rhymeFeedback === 'correct' && (idx === a || idx === b);

                    return (
                      <button
                        key={card.word}
                        onClick={() => handleRhymeTap(idx)}
                        className={`rounded-2xl border-2 p-3 flex flex-col items-center gap-2 min-h-[90px] transition-all focus:outline-none focus:ring-2 focus:ring-accent font-bold text-primary ${
                          isCorrectCard
                            ? 'border-success bg-green-50 scale-105 shadow-md'
                            : isSelected
                            ? 'border-accent bg-blue-50 shadow-sm scale-[1.03]'
                            : 'border-gray-200 bg-card hover:border-accent hover:bg-blue-50 active:scale-95'
                        }`}
                        aria-label={`${card.word} — tap to select`}
                        aria-pressed={isSelected}
                      >
                        <span className="text-3xl">{card.emoji}</span>
                        <span className="text-base font-bold tracking-wide">{card.word}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); speakWord(card.word, lang); }}
                          className="p-1.5 rounded-full bg-surface hover:bg-blue-50 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                          aria-label={`Hear ${card.word}`}
                          tabIndex={-1}
                        >
                          <Volume2 size={14} className="text-accent" />
                        </button>
                      </button>
                    );
                  })}
                </div>

                {/* Feedback message — correct only, no "wrong" ever */}
                {rhymeFeedback === 'correct' && (
                  <div className="bg-green-50 border border-success rounded-2xl p-3 text-center" role="status" aria-live="polite">
                    <p className="text-success font-bold text-lg">
                      {lang === 'HI' ? 'बहुत अच्छा! 🌟' : 'Great listening! 🌟'}
                    </p>
                  </div>
                )}

                {/* Encouraging companion prompt when incorrect (no text about being wrong) */}
                {!rhymeFeedback && companionState === 'encouraging' && (
                  <div className="bg-orange-50 border border-warm rounded-2xl p-3 text-center" role="status" aria-live="polite">
                    <p className="text-warm font-semibold text-base">
                      {lang === 'HI' ? `${appState.companion?.emoji || '🦉'} फिर कोशिश करो, तुम कर सकते हो!` : `${appState.companion?.emoji || '🦉'} Give it another try — you've got this!`}
                    </p>
                  </div>
                )}

                <p className="text-xs text-muted text-center">
                  {lang === 'HI' ? 'ध्वनि सुनने के लिए 🔊 दबाएं' : 'Tap 🔊 on any word to hear it'}
                </p>
              </div>
            )}

            {/* ═══ ACTIVITY 1 — Pile Comparison ═══ */}
            {activityIndex === 1 && (
              <div className="space-y-5">
                <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-lg font-semibold text-primary">
                    {lang === 'HI' ? 'ज़्यादा ढेर को दबाओ! 👆' : 'Tap the bigger pile! 👆'}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {lang === 'HI'
                      ? `दौर ${pileRound + 1} / ${PILE_ROUNDS.length}`
                      : `Round ${pileRound + 1} of ${PILE_ROUNDS.length}`}
                  </p>
                </div>

                {/* Two piles side by side — NO numbers shown */}
                <div className="grid grid-cols-2 gap-4">
                  {(['left', 'right']).map((side) => {
                    const count = PILE_ROUNDS[pileRound][side];
                    const { answer } = PILE_ROUNDS[pileRound];
                    const isCorrectSide = side === answer;
                    const isChosen = pileChosen === side;
                    const shouldHighlight = pileHighlight && isCorrectSide;

                    return (
                      <button
                        key={side}
                        onClick={() => handlePileTap(side)}
                        className={`rounded-2xl border-2 p-4 flex flex-col items-center gap-3 min-h-[160px] transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
                          shouldHighlight
                            ? 'border-accent bg-blue-50 shadow-md scale-[1.04]'
                            : isChosen && !pileHighlight
                            ? 'border-success bg-green-50 shadow-md scale-[1.04]'
                            : 'border-gray-200 bg-card hover:border-warm hover:bg-orange-50 active:scale-95'
                        }`}
                        aria-label={`${side} pile — tap to choose`}
                        disabled={!!pileChosen}
                      >
                        {/* Emoji grid — NO numbers */}
                        <div
                          className="flex flex-wrap justify-center gap-1"
                          style={{ maxWidth: '100%' }}
                          aria-hidden="true"
                        >
                          {Array.from({ length: count }).map((_, i) => (
                            <span key={i} className="text-xl leading-none">🍎</span>
                          ))}
                        </div>
                        {/* Accessible count for screen readers only */}
                        <span className="sr-only">{count} apples</span>
                      </button>
                    );
                  })}
                </div>

                {/* Encouraging feedback — no "wrong" text */}
                {pileHighlight && (
                  <div className="bg-orange-50 border border-warm rounded-2xl p-3 text-center" role="status" aria-live="polite">
                    <p className="text-warm font-semibold text-base">
                      {lang === 'HI' ? `${appState.companion?.emoji || '🦉'} देखो कौन सा ढेर बड़ा है!` : `${appState.companion?.emoji || '🦉'} Look closely — which pile has more!`}
                    </p>
                  </div>
                )}

                {pileChosen && !pileHighlight && (
                  <div className="bg-green-50 border border-success rounded-2xl p-3 text-center" role="status" aria-live="polite">
                    <p className="text-success font-bold text-lg">
                      {lang === 'HI' ? 'शाबाश! 🌟' : 'Well spotted! 🌟'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ ACTIVITY 2 — Canvas Trace ═══ */}
            {activityIndex === 2 && (
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
                  <p className="text-lg font-semibold text-primary">
                    {lang === 'HI' ? 'उल्लू को तारे तक पहुँचाओ! ✏️' : 'Help the owl find the star! Trace the dotted path 🦉⭐'}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {lang === 'HI' ? 'उँगली से रास्ता बनाओ' : 'Draw with your finger or mouse'}
                  </p>
                </div>

                {/* Canvas */}
                <div className="rounded-2xl overflow-hidden border-2 border-gray-200 shadow-sm">
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={180}
                    className="w-full block touch-none"
                    style={{ cursor: traceDone ? 'default' : 'crosshair' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    aria-label="Trace the dotted path from the owl to the star"
                    role="img"
                  />
                </div>

                {/* Trace feedback */}
                {traceDone && (
                  <div className="bg-green-50 border border-success rounded-2xl p-4 text-center" role="status" aria-live="polite">
                    <p className="text-2xl mb-1">{appState.companion?.emoji || '🦉'}</p>
                    <p className="text-success font-bold text-lg">
                      {lang === 'HI' ? 'शानदार! उल्लू तारे तक पहुँच गया! 🌟' : 'Wonderful! The owl reached the star! 🌟'}
                    </p>
                    {traceScore > 0 && (
                      <p className="text-sm text-muted mt-1">
                        {lang === 'HI'
                          ? `${traceScore}% रास्ते पर! बहुत अच्छा।`
                          : `${traceScore}% on the path — great tracing!`}
                      </p>
                    )}
                  </div>
                )}

                {/* Continue button for canvas activity */}
                {traceDone && (
                  <button
                    onClick={advanceActivity}
                    className="w-full bg-warm text-white font-semibold py-3.5 px-6 rounded-xl min-h-[52px] hover:bg-orange-600 transition-colors shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-warm"
                    aria-label={S.continue}
                  >
                    {S.continue} →
                  </button>
                )}

                {!traceDone && (
                  <p className="text-xs text-muted text-center">
                    {lang === 'HI' ? 'उँगली उठाने पर रुकता है' : 'Lift your finger when done'}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════
            ACTIVITY 3 — Completion Screen
        ══════════════════════════════════════════════════ */}
        {activityIndex === 3 && (
          <div className="flex flex-col items-center text-center py-6 space-y-5">

            {/* Companion celebration */}
            <div className="w-28 h-28 bg-warm rounded-full flex items-center justify-center text-6xl shadow-lg">
              {appState.companion?.emoji || '🦉'}
            </div>

            <div>
              <h2 className="text-3xl font-bold text-primary">
                {lang === 'HI' ? 'शानदार! 🌟' : 'Amazing! 🌟'}
              </h2>
              <p className="text-muted mt-1 text-base font-medium">
                {appState.companion?.nickname || appState.companion?.name || 'Gyaan'}{lang === 'HI' ? ' बहुत खुश है!' : ' is so proud of you!'}
              </p>
            </div>

            {/* Profile reveal card */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 w-full max-w-sm text-left space-y-2">
              <p className="text-base font-semibold text-primary">
                {lang === 'HI' ? 'आपके लिए खास रास्ता तैयार है 🌟' : 'Your personalised learning path is ready 🌟'}
              </p>
              <p className="text-sm text-muted leading-relaxed">
                {(STRINGS[lang] || STRINGS.EN).learnerProfileReveal}
              </p>
            </div>

            {/* What's coming next — builds excitement */}
            <div className="bg-card border border-gray-100 rounded-2xl p-4 w-full max-w-sm space-y-2 shadow-sm">
              <p className="text-sm font-semibold text-primary text-center">
                {lang === 'HI' ? '🚀 आज का सफर' : '🚀 Your journey starts with'}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="text-xl">📖</span>
                <span>{lang === 'HI' ? 'पठन कक्ष — "चतुर कौआ"' : 'Reading Room — "The Clever Crow"'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="text-xl">🔢</span>
                <span>{lang === 'HI' ? 'संख्या जगत — सेब जोड़ो' : 'Number World — Adding Apples'}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleComplete}
              className="w-full bg-warm text-white font-bold py-4 px-6 rounded-xl min-h-[56px] text-xl hover:bg-orange-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-warm active:bg-orange-700"
              aria-label={lang === 'HI' ? 'सीखना शुरू करें' : "Let's Start Learning!"}
            >
              {lang === 'HI' ? 'सीखना शुरू करें! →' : "Let's Start Learning! →"}
            </button>

            <p className="text-xs text-muted">
              {lang === 'HI' ? '📶 ऑफलाइन भी काम करेगा' : '📶 Works offline too — no internet needed'}
            </p>
          </div>
        )}

      </div>
    </Layout>
  );
}