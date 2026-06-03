// src/pages/Screening.jsx
// Route: /screening
// 3 screening activities that identify SLD type through real behavioral tracking.
// Always framed as games, never as tests. No scores/timers visible to the student.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Volume2,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  Play,
  Target,
  Hand,
} from 'lucide-react';
import { useApp } from '../App';
import {
  STRINGS,
  COMPANIONS,
  SCREENING_WORD_SETS,
  SCREENING_PILE_ROUNDS,
  SCREENING_TRACE_PATHS,
  TYPICAL_THRESHOLD,
} from '../data';
import Layout from '../components/Layout';
import { saveStudentToFirebase, saveScreeningResults } from '../firebase';
import confetti from 'canvas-confetti';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TOTAL_ACTIVITIES = 3;

// Scoring weights
const DYSLEXIA_WEIGHTS = { errorRate: 0.4, audioReliance: 0.3, responseSlowness: 0.3 };
const DYSCALCULIA_WEIGHTS = { errorRate: 0.5, closeNumberError: 0.3, responseTime: 0.2 };
const DYSGRAPHIA_WEIGHTS = { deviation: 0.4, jitter: 0.35, incompletion: 0.25 };

// Tracing tolerance thresholds (in pixels, on a 400×250 canvas)
const TRACE_GREEN = 15;
const TRACE_YELLOW = 25;

// Baseline response time thresholds (ms) - used to normalize slowness
const RHYME_EXPECTED_MS = 5000;
const PILE_EXPECTED_MS = 4000;

// ─── SpeechSynthesis helper ───────────────────────────────────────────────────
const speakWord = (word, lang) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
  utt.rate = 0.85;
  window.speechSynthesis.speak(utt);
};

// ─── Canvas path utilities ────────────────────────────────────────────────────
// Convert normalized (0-1) path points to pixel coordinates on the canvas
const toCanvasCoords = (points, width, height) =>
  points.map((p) => ({ x: p.x * width, y: p.y * height }));

// Sample evenly-spaced points along a polyline path for distance calculations
const samplePolyline = (points, numSamples = 300) => {
  if (points.length < 2) return points;
  const sampled = [];
  // Calculate total length
  let totalLen = 0;
  for (let i = 1; i < points.length; i++) {
    totalLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const stepLen = totalLen / numSamples;
  let segIdx = 0;
  let segProgress = 0;

  for (let s = 0; s <= numSamples; s++) {
    const targetDist = s * stepLen;
    let accumulated = 0;
    let placed = false;

    for (let i = 1; i < points.length; i++) {
      const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (accumulated + segLen >= targetDist) {
        const t = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
        sampled.push({
          x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
          y: points[i - 1].y + t * (points[i].y - points[i - 1].y),
        });
        placed = true;
        break;
      }
      accumulated += segLen;
    }
    if (!placed) sampled.push(points[points.length - 1]);
  }
  return sampled;
};

// Minimum distance from a point to any point on the sampled path
const minDistToPath = (pt, pathPts) =>
  pathPts.reduce((min, pp) => {
    const d = Math.hypot(pt.x - pp.x, pt.y - pp.y);
    return d < min ? d : min;
  }, Infinity);

// Compute detailed trace metrics
const computeTraceMetrics = (drawnPoints, pathPoints) => {
  if (drawnPoints.length < 5) {
    return { avgDeviation: 999, jitterScore: 1, completionPct: 0 };
  }

  const sampledPath = samplePolyline(pathPoints, 300);

  // Average deviation from center line
  let totalDeviation = 0;
  for (const p of drawnPoints) {
    totalDeviation += minDistToPath(p, sampledPath);
  }
  const avgDeviation = totalDeviation / drawnPoints.length;

  // Jitter: average absolute angle change between consecutive segments
  let totalAngleChange = 0;
  let angleCount = 0;
  for (let i = 2; i < drawnPoints.length; i++) {
    const dx1 = drawnPoints[i - 1].x - drawnPoints[i - 2].x;
    const dy1 = drawnPoints[i - 1].y - drawnPoints[i - 2].y;
    const dx2 = drawnPoints[i].x - drawnPoints[i - 1].x;
    const dy2 = drawnPoints[i].y - drawnPoints[i - 1].y;
    const angle1 = Math.atan2(dy1, dx1);
    const angle2 = Math.atan2(dy2, dx2);
    let diff = Math.abs(angle2 - angle1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    totalAngleChange += diff;
    angleCount++;
  }
  const avgAngleChange = angleCount > 0 ? totalAngleChange / angleCount : 0;
  // Normalize jitter to 0-1 (pi/2 or above = max jitter)
  const jitterScore = Math.min(avgAngleChange / (Math.PI / 2), 1);

  // Completion: how far along the path did the drawn line reach?
  // Find the closest path point index for the last drawn point
  const lastDrawn = drawnPoints[drawnPoints.length - 1];
  let maxPathIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < sampledPath.length; i++) {
    const d = Math.hypot(lastDrawn.x - sampledPath[i].x, lastDrawn.y - sampledPath[i].y);
    if (d < minDist) {
      minDist = d;
      maxPathIdx = i;
    }
  }
  const completionPct = Math.min(maxPathIdx / (sampledPath.length - 1), 1);

  return { avgDeviation, jitterScore, completionPct };
};

// Get canvas position from pointer/touch event
const getCanvasPos = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top) * scaleY,
  };
};

// ─── Canvas drawing function ──────────────────────────────────────────────────
const drawCanvas = (ctx, pathPixels, userPoints, sampledPath, isDone) => {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, width, height);

  // Draw subtle grid for depth
  ctx.save();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // Draw dotted guide path
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pathPixels[0].x, pathPixels[0].y);
  for (let i = 1; i < pathPixels.length; i++) {
    ctx.lineTo(pathPixels[i].x, pathPixels[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // Start marker
  const startPt = pathPixels[0];
  const endPt = pathPixels[pathPixels.length - 1];

  ctx.save();
  ctx.beginPath();
  ctx.arc(startPt.x, startPt.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#22C55E';
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(startPt.x, startPt.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#22C55E';
  ctx.fill();
  ctx.restore();

  // "START" label
  ctx.save();
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#22C55E';
  ctx.textAlign = 'center';
  ctx.fillText('START', startPt.x, startPt.y - 18);
  ctx.restore();

  // End marker
  ctx.save();
  ctx.beginPath();
  ctx.arc(endPt.x, endPt.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#E87722';
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(endPt.x, endPt.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#E87722';
  ctx.fill();
  ctx.restore();

  // "END" label
  ctx.save();
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#E87722';
  ctx.textAlign = 'center';
  ctx.fillText('END', endPt.x, endPt.y - 18);
  ctx.restore();

  // User trace - color-coded by accuracy
  if (userPoints.length > 1 && sampledPath.length > 0) {
    for (let i = 1; i < userPoints.length; i++) {
      const dist = minDistToPath(userPoints[i], sampledPath);
      let color;
      if (dist <= TRACE_GREEN) {
        color = '#22C55E'; // green - accurate
      } else if (dist <= TRACE_YELLOW) {
        color = '#EAB308'; // yellow - slightly off
      } else {
        color = '#E87722'; // orange - off path
      }

      ctx.save();
      ctx.setLineDash([]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(userPoints[i - 1].x, userPoints[i - 1].y);
      ctx.lineTo(userPoints[i].x, userPoints[i].y);
      ctx.stroke();
      ctx.restore();
    }
  }
};

// ─── Profile derivation ───────────────────────────────────────────────────────
const deriveProfile = (rhymeData, pileData, traceData, isDemoMode) => {
  // --- Dyslexia score ---
  const rhymeErrorRate = rhymeData.totalRounds > 0
    ? rhymeData.incorrectRounds / rhymeData.totalRounds
    : 0;
  const audioReliance = rhymeData.totalRounds > 0
    ? Math.min(rhymeData.audioUseCount / (rhymeData.totalRounds * 2), 1)
    : 0;
  const avgRhymeTime = rhymeData.responseTimes.length > 0
    ? rhymeData.responseTimes.reduce((a, b) => a + b, 0) / rhymeData.responseTimes.length
    : 0;
  const responseSlowness = Math.min(avgRhymeTime / RHYME_EXPECTED_MS, 1);

  const dyslexiaScore =
    rhymeErrorRate * DYSLEXIA_WEIGHTS.errorRate +
    audioReliance * DYSLEXIA_WEIGHTS.audioReliance +
    responseSlowness * DYSLEXIA_WEIGHTS.responseSlowness;

  // --- Dyscalculia score ---
  const pileErrorRate = pileData.totalRounds > 0
    ? pileData.incorrectRounds / pileData.totalRounds
    : 0;
  const closeNumberErrorRate = pileData.hardRounds > 0
    ? pileData.hardRoundErrors / pileData.hardRounds
    : 0;
  const avgPileTime = pileData.responseTimes.length > 0
    ? pileData.responseTimes.reduce((a, b) => a + b, 0) / pileData.responseTimes.length
    : 0;
  const pileTimeFactor = Math.min(avgPileTime / PILE_EXPECTED_MS, 1);

  const dyscalculiaScore =
    pileErrorRate * DYSCALCULIA_WEIGHTS.errorRate +
    closeNumberErrorRate * DYSCALCULIA_WEIGHTS.closeNumberError +
    pileTimeFactor * DYSCALCULIA_WEIGHTS.responseTime;

  // --- Dysgraphia score ---
  // Normalize deviation: 0px = 0 score, 40px+ = 1.0
  const deviationNorm = Math.min(traceData.avgDeviation / 40, 1);
  const jitterNorm = traceData.jitterScore; // already 0-1
  const incompletionPenalty = 1 - traceData.completionPct;

  const dysgraphiaScore =
    deviationNorm * DYSGRAPHIA_WEIGHTS.deviation +
    jitterNorm * DYSGRAPHIA_WEIGHTS.jitter +
    incompletionPenalty * DYSGRAPHIA_WEIGHTS.incompletion;

  // Clamp all scores to 0-1
  let scores = {
    dyslexiaScore: Math.min(Math.max(dyslexiaScore, 0), 1),
    dyscalculiaScore: Math.min(Math.max(dyscalculiaScore, 0), 1),
    dysgraphiaScore: Math.min(Math.max(dysgraphiaScore, 0), 1),
  };

  // Demo mode bias: nudge dyslexia score up to match Arjun's profile
  if (isDemoMode) {
    scores.dyslexiaScore = Math.min(scores.dyslexiaScore + 0.15, 1);
  }

  // Determine detected type
  let detectedType = 'typical';
  const maxScore = Math.max(scores.dyslexiaScore, scores.dyscalculiaScore, scores.dysgraphiaScore);
  
  if (maxScore > TYPICAL_THRESHOLD) {
    detectedType = 'dyslexia';
    if (maxScore === scores.dyscalculiaScore) detectedType = 'dyscalculia';
    if (maxScore === scores.dysgraphiaScore) detectedType = 'dysgraphia';
    // If dyslexia ties or wins, it stays as 'dyslexia'
    if (scores.dyslexiaScore >= maxScore) detectedType = 'dyslexia';
  }

  return { ...scores, detectedType };
};

// Child-friendly profile descriptions (no clinical labels)
const PROFILE_MESSAGES = {
  dyslexia: {
    EN: 'You learn best through listening and sounds',
    HI: 'आप सुनकर और ध्वनि से सबसे अच्छा सीखते हैं',
  },
  dyscalculia: {
    EN: 'You learn best with objects and visuals',
    HI: 'आप चीज़ों और चित्रों से सबसे अच्छा सीखते हैं',
  },
  dysgraphia: {
    EN: 'You express yourself best through speaking and drawing',
    HI: 'आप बोलकर और बनाकर सबसे अच्छा व्यक्त करते हैं',
  },
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function Screening() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const lang = appState.language;
  const S = STRINGS[lang] || STRINGS.EN;

  // ── Activity progression ──────────────────────────────────────────────────
  const [activityIndex, setActivityIndex] = useState(0); // 0, 1, 2, 3 (done)
  const [transitioning, setTransitioning] = useState(false);
  const [companionState, setCompanionState] = useState('idle');

  const advanceActivity = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setActivityIndex((i) => i + 1);
      setCompanionState('idle');
      setTransitioning(false);
    }, 500);
  }, []);

  // Brief companion state change helper
  const flashCompanion = useCallback((state, durationMs = 1500) => {
    setCompanionState(state);
    setTimeout(() => setCompanionState('idle'), durationMs);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // ACTIVITY 1: Word Sound Game (Dyslexia proxy)
  // ══════════════════════════════════════════════════════════════════════════════
  const [rhymeRound, setRhymeRound] = useState(0);
  const [rhymeSelected, setRhymeSelected] = useState([]); // indices of selected cards
  const [rhymeFeedback, setRhymeFeedback] = useState(null); // null | 'correct' | 'incorrect'
  const [rhymeCorrectPair, setRhymeCorrectPair] = useState([]); // revealed correct pair indices
  const rhymeLocked = useRef(false);
  const rhymeRoundStart = useRef(Date.now());
  const [shuffledRhymeIndices, setShuffledRhymeIndices] = useState([0, 1, 2, 3]);

  useEffect(() => {
    const indices = [0, 1, 2, 3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledRhymeIndices(indices);
  }, [rhymeRound]);

  // Tracking data for dyslexia scoring
  const rhymeDataRef = useRef({
    totalRounds: SCREENING_WORD_SETS.length,
    incorrectRounds: 0,
    audioUseCount: 0,
    responseTimes: [],
  });

  const handleAudioPlay = (word) => {
    rhymeDataRef.current.audioUseCount++;
    speakWord(word, lang);
  };

  const handleRhymeTap = (idx) => {
    if (rhymeLocked.current || rhymeFeedback) return;

    const next = rhymeSelected.includes(idx)
      ? rhymeSelected.filter((i) => i !== idx)
      : [...rhymeSelected, idx].slice(-2);

    setRhymeSelected(next);

    if (next.length === 2) {
      rhymeLocked.current = true;
      const responseTime = Date.now() - rhymeRoundStart.current;
      rhymeDataRef.current.responseTimes.push(responseTime);

      const round = SCREENING_WORD_SETS[rhymeRound];
      const [a, b] = round.rhymePair;
      const isCorrect = next.includes(a) && next.includes(b);

      if (isCorrect) {
        setRhymeFeedback('correct');
        flashCompanion('happy', 1400);
        setTimeout(() => {
          rhymeLocked.current = false;
          setRhymeSelected([]);
          setRhymeFeedback(null);
          setRhymeCorrectPair([]);
          const nextRound = rhymeRound + 1;
          if (nextRound < SCREENING_WORD_SETS.length) {
            setRhymeRound(nextRound);
            rhymeRoundStart.current = Date.now();
          } else {
            advanceActivity();
          }
        }, 1500);
      } else {
        // Incorrect - track it, show encouraging feedback, reveal correct pair
        rhymeDataRef.current.incorrectRounds++;
        setRhymeFeedback('incorrect');
        setRhymeCorrectPair([a, b]);
        flashCompanion('encouraging', 2000);
        setTimeout(() => {
          rhymeLocked.current = false;
          setRhymeSelected([]);
          setRhymeFeedback(null);
          setRhymeCorrectPair([]);
          const nextRound = rhymeRound + 1;
          if (nextRound < SCREENING_WORD_SETS.length) {
            setRhymeRound(nextRound);
            rhymeRoundStart.current = Date.now();
          } else {
            advanceActivity();
          }
        }, 2200);
      }
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ACTIVITY 2: Which Group Has More? (Dyscalculia proxy)
  // ══════════════════════════════════════════════════════════════════════════════
  const [pileRound, setPileRound] = useState(0);
  const [pileChosen, setPileChosen] = useState(null); // 'left' | 'right' | null
  const [pileFeedback, setPileFeedback] = useState(null); // null | 'correct' | 'incorrect'
  const [pileCorrectSide, setPileCorrectSide] = useState(null);
  const pileLocked = useRef(false);
  const pileRoundStart = useRef(Date.now());

  // Randomize which display-side each pile appears on
  const [pileSwaps] = useState(() =>
    SCREENING_PILE_ROUNDS.map(() => Math.random() > 0.5)
  );

  // Tracking data for dyscalculia scoring
  const pileDataRef = useRef({
    totalRounds: SCREENING_PILE_ROUNDS.length,
    incorrectRounds: 0,
    hardRounds: 0,
    hardRoundErrors: 0,
    responseTimes: [],
  });

  // Count hard rounds on mount
  useEffect(() => {
    pileDataRef.current.hardRounds = SCREENING_PILE_ROUNDS.filter(
      (r) => r.difficulty === 'hard'
    ).length;
  }, []);

  // Reset pile round start timer when activity 2 starts
  useEffect(() => {
    if (activityIndex === 1) {
      pileRoundStart.current = Date.now();
    }
  }, [activityIndex]);

  const getPileValues = (roundIdx) => {
    const round = SCREENING_PILE_ROUNDS[roundIdx];
    const swapped = pileSwaps[roundIdx];
    // displayLeft/displayRight are the counts shown on screen
    const displayLeft = swapped ? round.right : round.left;
    const displayRight = swapped ? round.left : round.right;
    // The correct display side
    const actualBigger = round.left > round.right ? 'left' : 'right';
    const correctDisplaySide = swapped
      ? (actualBigger === 'left' ? 'right' : 'left')
      : actualBigger;
    return { displayLeft, displayRight, correctDisplaySide, difficulty: round.difficulty };
  };

  const handlePileTap = (side) => {
    if (pileLocked.current || pileChosen) return;
    pileLocked.current = true;
    setPileChosen(side);

    const responseTime = Date.now() - pileRoundStart.current;
    pileDataRef.current.responseTimes.push(responseTime);

    const { correctDisplaySide, difficulty } = getPileValues(pileRound);
    const isCorrect = side === correctDisplaySide;

    if (isCorrect) {
      setPileFeedback('correct');
      setPileCorrectSide(correctDisplaySide);
      flashCompanion('happy', 1300);
      setTimeout(() => {
        pileLocked.current = false;
        setPileChosen(null);
        setPileFeedback(null);
        setPileCorrectSide(null);
        const nextRound = pileRound + 1;
        if (nextRound < SCREENING_PILE_ROUNDS.length) {
          setPileRound(nextRound);
          pileRoundStart.current = Date.now();
        } else {
          advanceActivity();
        }
      }, 1400);
    } else {
      pileDataRef.current.incorrectRounds++;
      if (difficulty === 'hard') {
        pileDataRef.current.hardRoundErrors++;
      }
      setPileFeedback('incorrect');
      setPileCorrectSide(correctDisplaySide);
      flashCompanion('encouraging', 1800);
      setTimeout(() => {
        pileLocked.current = false;
        setPileChosen(null);
        setPileFeedback(null);
        setPileCorrectSide(null);
        const nextRound = pileRound + 1;
        if (nextRound < SCREENING_PILE_ROUNDS.length) {
          setPileRound(nextRound);
          pileRoundStart.current = Date.now();
        } else {
          advanceActivity();
        }
      }, 2000);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ACTIVITY 3: Trace the Path (Dysgraphia proxy)
  // ══════════════════════════════════════════════════════════════════════════════
  const CANVAS_W = 400;
  const CANVAS_H = 250;

  const [tracePathIdx, setTracePathIdx] = useState(0);
  const [traceDone, setTraceDone] = useState(false);
  const [allTracesDone, setAllTracesDone] = useState(false);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const drawnRef = useRef([]);

  // Accumulated trace metrics across all paths
  const traceMetricsRef = useRef({
    avgDeviation: 0,
    jitterScore: 0,
    completionPct: 0,
    pathCount: 0,
  });

  // Current path data in pixel coordinates
  const currentPath = SCREENING_TRACE_PATHS[tracePathIdx];
  const pathPixels = currentPath
    ? toCanvasCoords(currentPath.points, CANVAS_W, CANVAS_H)
    : [];
  const sampledPath = pathPixels.length > 1 ? samplePolyline(pathPixels, 300) : [];

  // Draw the canvas whenever the activity is shown or path changes
  useEffect(() => {
    if (activityIndex === 2 && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      drawCanvas(ctx, pathPixels, [], sampledPath, false);
    }
  }, [activityIndex, tracePathIdx]);

  const redrawCanvas = useCallback(
    (done = false) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      drawCanvas(ctx, pathPixels, drawnRef.current, sampledPath, done);
    },
    [pathPixels, sampledPath]
  );

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
    if (drawnRef.current.length < 5) return; // too short, ignore

    // Compute metrics for this trace
    const metrics = computeTraceMetrics(drawnRef.current, pathPixels);

    // Accumulate
    const acc = traceMetricsRef.current;
    acc.avgDeviation =
      (acc.avgDeviation * acc.pathCount + metrics.avgDeviation) / (acc.pathCount + 1);
    acc.jitterScore =
      (acc.jitterScore * acc.pathCount + metrics.jitterScore) / (acc.pathCount + 1);
    acc.completionPct =
      (acc.completionPct * acc.pathCount + metrics.completionPct) / (acc.pathCount + 1);
    acc.pathCount++;

    setTraceDone(true);
    flashCompanion('happy', 1400);
    redrawCanvas(true);
  };

  const handleNextTrace = () => {
    const nextIdx = tracePathIdx + 1;
    if (nextIdx < SCREENING_TRACE_PATHS.length) {
      setTracePathIdx(nextIdx);
      setTraceDone(false);
      drawnRef.current = [];
    } else {
      setAllTracesDone(true);
      advanceActivity();
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPLETION - Derive profile and store results
  // ══════════════════════════════════════════════════════════════════════════════
  const [profileResult, setProfileResult] = useState(null);

  useEffect(() => {
    if (activityIndex === 3 && !profileResult) {
      const traceData = {
        avgDeviation: traceMetricsRef.current.avgDeviation,
        jitterScore: traceMetricsRef.current.jitterScore,
        completionPct: traceMetricsRef.current.completionPct,
      };
      const result = deriveProfile(
        rhymeDataRef.current,
        pileDataRef.current,
        traceData,
        appState.isDemoMode
      );
      setProfileResult(result);

      // Compute detailed telemetry for teacher dashboard
      const rhymeD = rhymeDataRef.current;
      const pileD = pileDataRef.current;
      const avgRhymeTime = rhymeD.responseTimes.length > 0
        ? rhymeD.responseTimes.reduce((a, b) => a + b, 0) / rhymeD.responseTimes.length
        : 0;
      const avgPileTime = pileD.responseTimes.length > 0
        ? pileD.responseTimes.reduce((a, b) => a + b, 0) / pileD.responseTimes.length
        : 0;
      const rhymeErrorRate = rhymeD.totalRounds > 0
        ? rhymeD.incorrectRounds / rhymeD.totalRounds
        : 0;
      const pileErrorRate = pileD.totalRounds > 0
        ? pileD.incorrectRounds / pileD.totalRounds
        : 0;
      const closeNumberErrorRate = pileD.hardRounds > 0
        ? pileD.hardRoundErrors / pileD.hardRounds
        : 0;

      const telemetryData = {
        // Reading & Sound Tracking
        rhymingSpeed: Math.round(avgRhymeTime / 1000 * 10) / 10,
        audioHelpUsed: rhymeD.audioUseCount,
        rhymingAccuracy: Math.round((1 - rhymeErrorRate) * 100),
        // Number Sense
        countingSpeed: Math.round(avgPileTime / 1000 * 10) / 10,
        countingAccuracy: Math.round((1 - pileErrorRate) * 100),
        closeNumberConfusion: closeNumberErrorRate > 0.5,
        // Motor Control
        lineSteadiness: traceData.jitterScore > 0.5 ? 'Very Shaky' : traceData.jitterScore > 0.25 ? 'Shaky' : 'Steady',
        pathAccuracy: Math.round(traceData.avgDeviation),
      };

      // Store in app state with telemetry
      updateState({
        sldType: result.detectedType,
        screeningResults: {
          dyslexiaScore: Math.round(result.dyslexiaScore * 100) / 100,
          dyscalculiaScore: Math.round(result.dyscalculiaScore * 100) / 100,
          dysgraphiaScore: Math.round(result.dysgraphiaScore * 100) / 100,
          detectedType: result.detectedType,
          telemetry: telemetryData,
        },
      });

      // Save to Firebase
      const saveToFirebase = async () => {
        try {
          const studentId = `student_${Date.now()}`;
          const maxScore = Math.max(result.dyslexiaScore, result.dyscalculiaScore, result.dysgraphiaScore);
          await saveStudentToFirebase({
            id: studentId,
            name: appState.studentName || 'Student',
            class: appState.studentClass || 4,
            school: 'Saath-i App User',
            sldType: result.detectedType,
            severity: maxScore > 0.6 ? 'moderate' : 'mild',
            language: appState.language,
            lastActive: 'Just now',
            streakDays: appState.streakDays || 1,
            status: 'green',
            companion: appState.companion,
            masteryMap: {
              'Sound Matching': result.dyslexiaScore < 0.3 ? 'mastered' : result.dyslexiaScore < 0.6 ? 'in_progress' : 'struggling',
              'Number Sense': result.dyscalculiaScore < 0.3 ? 'mastered' : result.dyscalculiaScore < 0.6 ? 'in_progress' : 'struggling',
              'Motor Control': result.dysgraphiaScore < 0.3 ? 'mastered' : result.dysgraphiaScore < 0.6 ? 'in_progress' : 'struggling',
            },
            errorPatterns: [],
            weeklyStats: { timeSpent: '0m', activitiesCompleted: 0, helpRequests: 0 },
            aiSuggestion: '',
            progressHistory: [0],
            screeningResults: {
              dyslexiaScore: Math.round(result.dyslexiaScore * 100) / 100,
              dyscalculiaScore: Math.round(result.dyscalculiaScore * 100) / 100,
              dysgraphiaScore: Math.round(result.dysgraphiaScore * 100) / 100,
              detectedType: result.detectedType,
            },
            telemetry: telemetryData,
          });
          updateState({ firebaseStudentId: studentId });
        } catch (err) {
          console.error('Firebase save failed:', err);
        }
      };
      saveToFirebase();

      // Fire confetti
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#2E75B6', '#E87722', '#2E8B57'],
        });
      }, 400);
    }
  }, [activityIndex]);

  const handleComplete = () => {
    navigate('/home');
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <Layout
      title={S.screeningTitle}
      showBack={false}
      showCompanion
      pageContext="Completing their initial screening games"
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      <div
        className={`max-w-md mx-auto pb-24 transition-opacity duration-500 ${
          transitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {/* ── Step indicator dots ─────────────────────────────────────────── */}
        {activityIndex < 3 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {Array.from({ length: TOTAL_ACTIVITIES }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === activityIndex
                    ? 'w-8 h-3 bg-accent'
                    : i < activityIndex
                    ? 'w-3 h-3 bg-accent/50'
                    : 'w-3 h-3 bg-gray-200'
                }`}
                aria-label={`Activity ${i + 1} ${
                  i < activityIndex ? 'completed' : i === activityIndex ? 'current' : 'upcoming'
                }`}
              />
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ACTIVITY 1 - Word Sound Game (Dyslexia proxy)
        ═══════════════════════════════════════════════════════════════════ */}
        {activityIndex === 0 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Instruction card */}
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Volume2 size={20} className="text-accent" />
                <p className="text-lg font-semibold text-primary">
                  {lang === 'HI'
                    ? 'दो ताल मिलाने वाले शब्द चुनें'
                    : 'Select the two words that rhyme'}
                </p>
              </div>
              <p className="text-sm text-muted">
                {lang === 'HI'
                  ? `दौर ${rhymeRound + 1} / ${SCREENING_WORD_SETS.length}`
                  : `Round ${rhymeRound + 1} of ${SCREENING_WORD_SETS.length}`}
              </p>
            </div>

            {/* Word cards - 2x2 grid */}
            <div className="grid grid-cols-2 gap-3">
              {shuffledRhymeIndices.map((idx) => {
                const word = SCREENING_WORD_SETS[rhymeRound].words[idx];
                const isSelected = rhymeSelected.includes(idx);
                const isCorrectReveal = rhymeCorrectPair.includes(idx);
                const isFeedbackCorrect =
                  rhymeFeedback === 'correct' &&
                  SCREENING_WORD_SETS[rhymeRound].rhymePair.includes(idx);

                let borderClass = 'border-gray-200 bg-card';
                if (isFeedbackCorrect || isCorrectReveal) {
                  borderClass = 'border-green-400 bg-green-50 scale-[1.02]';
                } else if (
                  rhymeFeedback === 'incorrect' &&
                  rhymeSelected.includes(idx) &&
                  !isCorrectReveal
                ) {
                  borderClass = 'border-warm/60 bg-orange-50/50';
                } else if (isSelected) {
                  borderClass = 'border-accent bg-blue-50 shadow-sm scale-[1.02]';
                }

                return (
                  <button
                    key={`${rhymeRound}-${word}`}
                    onClick={() => handleRhymeTap(idx)}
                    className={`rounded-xl border-2 p-4 flex flex-col items-center gap-3 min-h-[100px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent ${borderClass}`}
                    aria-label={`${word} - tap to select`}
                    aria-pressed={isSelected}
                    disabled={!!rhymeFeedback}
                  >
                    <span className="text-xl font-bold text-primary tracking-wide">
                      {word}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAudioPlay(word);
                      }}
                      className="p-2 rounded-full bg-surface hover:bg-accent/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                      aria-label={`Listen to ${word}`}
                      tabIndex={-1}
                    >
                      <Volume2 size={18} className="text-accent" />
                    </button>
                  </button>
                );
              })}
            </div>

            {/* Feedback - correct */}
            {rhymeFeedback === 'correct' && (
              <div
                className="bg-green-50 border border-green-200 rounded-xl p-3 text-center animate-fadeIn"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} className="text-green-600" />
                  <p className="text-green-700 font-semibold text-lg">
                    {lang === 'HI' ? 'बहुत अच्छा!' : 'Great listening!'}
                  </p>
                </div>
              </div>
            )}

            {/* Feedback - incorrect (encouraging, no "wrong") */}
            {rhymeFeedback === 'incorrect' && (
              <div
                className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center animate-fadeIn"
                role="status"
                aria-live="polite"
              >
                <p className="text-warm font-semibold text-base">
                  {lang === 'HI'
                    ? 'ये शब्द ताल मिलाते हैं - ध्यान से सुनो!'
                    : 'These words rhyme - listen closely!'}
                </p>
              </div>
            )}

            {/* Audio hint */}
            <p className="text-sm text-muted text-center flex items-center justify-center gap-1.5">
              <Volume2 size={14} className="text-muted" />
              {lang === 'HI'
                ? 'ध्वनि सुनने के लिए स्पीकर बटन दबाएं'
                : 'Tap the speaker icon on any word to hear it'}
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ACTIVITY 2 - Which Group Has More? (Dyscalculia proxy)
        ═══════════════════════════════════════════════════════════════════ */}
        {activityIndex === 1 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Instruction card */}
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Target size={20} className="text-accent" />
                <p className="text-lg font-semibold text-primary">
                  {lang === 'HI'
                    ? 'किस समूह में ज़्यादा हैं?'
                    : 'Which group has more?'}
                </p>
              </div>
              <p className="text-sm text-muted">
                {lang === 'HI'
                  ? `दौर ${pileRound + 1} / ${SCREENING_PILE_ROUNDS.length}`
                  : `Round ${pileRound + 1} of ${SCREENING_PILE_ROUNDS.length}`}
              </p>
            </div>

            {/* Two groups side by side */}
            <div className="grid grid-cols-2 gap-4">
              {['left', 'right'].map((side) => {
                const { displayLeft, displayRight, correctDisplaySide } =
                  getPileValues(pileRound);
                const count = side === 'left' ? displayLeft : displayRight;
                const isChosen = pileChosen === side;
                const isCorrectSide = side === correctDisplaySide;
                const showCorrectHighlight =
                  pileFeedback && isCorrectSide;
                const showIncorrectHighlight =
                  pileFeedback === 'incorrect' && isChosen && !isCorrectSide;

                let borderClass = 'border-gray-200 bg-card hover:border-accent/40';
                if (showCorrectHighlight) {
                  borderClass = 'border-green-400 bg-green-50 shadow-md scale-[1.03]';
                } else if (showIncorrectHighlight) {
                  borderClass = 'border-warm/50 bg-orange-50/40';
                } else if (isChosen && pileFeedback === 'correct') {
                  borderClass = 'border-green-400 bg-green-50 shadow-md scale-[1.03]';
                }

                return (
                  <button
                    key={`${pileRound}-${side}`}
                    onClick={() => handlePileTap(side)}
                    className={`rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 min-h-[160px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent ${borderClass}`}
                    aria-label={`${side} group - tap to choose`}
                    disabled={!!pileChosen}
                  >
                    {/* Dot grid - styled circles, NOT emojis */}
                    <div
                      className="flex flex-wrap justify-center gap-1.5 max-w-[120px]"
                      aria-hidden="true"
                    >
                      {Array.from({ length: count }).map((_, i) => (
                        <div
                          key={i}
                          className="bg-accent rounded-full w-6 h-6 flex-shrink-0"
                        />
                      ))}
                    </div>
                    {/* Accessible count for screen readers */}
                    <span className="sr-only">{count} circles</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {pileFeedback === 'correct' && (
              <div
                className="bg-green-50 border border-green-200 rounded-xl p-3 text-center animate-fadeIn"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={20} className="text-green-600" />
                  <p className="text-green-700 font-semibold text-lg">
                    {lang === 'HI' ? 'शाबाश!' : 'Well spotted!'}
                  </p>
                </div>
              </div>
            )}

            {pileFeedback === 'incorrect' && (
              <div
                className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center animate-fadeIn"
                role="status"
                aria-live="polite"
              >
                <p className="text-warm font-semibold text-base">
                  {lang === 'HI'
                    ? 'ध्यान से देखो - कौन सा समूह बड़ा है!'
                    : 'Look closely - which group has more!'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            ACTIVITY 3 - Trace the Path (Dysgraphia proxy)
        ═══════════════════════════════════════════════════════════════════ */}
        {activityIndex === 2 && (
          <div className="space-y-4 animate-fadeIn">
            {/* Instruction card */}
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Hand size={20} className="text-accent" />
                <p className="text-lg font-semibold text-primary">
                  {lang === 'HI'
                    ? 'बिन्दुओं के रास्ते पर उंगली चलाएं'
                    : 'Trace along the dotted path'}
                </p>
              </div>
              <p className="text-sm text-muted">
                {lang === 'HI'
                  ? `पथ ${tracePathIdx + 1} / ${SCREENING_TRACE_PATHS.length}`
                  : `Path ${tracePathIdx + 1} of ${SCREENING_TRACE_PATHS.length}`}
              </p>
            </div>

            {/* Canvas */}
            <div className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm bg-white">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full block touch-none"
                style={{ cursor: traceDone ? 'default' : 'crosshair' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                aria-label={
                  lang === 'HI'
                    ? 'शुरू से अंत तक बिन्दुओं के रास्ते पर उंगली चलाएं'
                    : 'Trace the dotted path from start to end'
                }
                role="img"
              />
            </div>

            {/* Trace feedback */}
            {traceDone && (
              <div
                className="bg-green-50 border border-green-200 rounded-xl p-4 text-center animate-fadeIn"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 size={20} className="text-green-600" />
                  <p className="text-green-700 font-semibold text-lg">
                    {lang === 'HI' ? 'बहुत अच्छा!' : 'Nice tracing!'}
                  </p>
                </div>
                <p className="text-sm text-muted">
                  {lang === 'HI'
                    ? 'हरा = सही रास्ते पर, पीला = थोड़ा बाहर, नारंगी = रास्ते से दूर'
                    : 'Green = on path, Yellow = slightly off, Orange = off path'}
                </p>
              </div>
            )}

            {/* Continue / next trace button */}
            {traceDone && (
              <button
                onClick={handleNextTrace}
                className="w-full bg-accent text-white font-semibold py-3.5 px-6 rounded-xl min-h-[52px] hover:bg-accent/90 transition-colors shadow-sm text-lg focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center gap-2"
                aria-label={
                  tracePathIdx + 1 < SCREENING_TRACE_PATHS.length
                    ? (lang === 'HI' ? 'अगला पथ' : 'Next path')
                    : S.continue
                }
              >
                {tracePathIdx + 1 < SCREENING_TRACE_PATHS.length
                  ? (lang === 'HI' ? 'अगला पथ' : 'Next Path')
                  : S.continue}
                <ArrowRight size={18} />
              </button>
            )}

            {!traceDone && (
              <p className="text-sm text-muted text-center flex items-center justify-center gap-1.5">
                <Hand size={14} className="text-muted" />
                {lang === 'HI'
                  ? 'शुरू से अंत तक उंगली या माउस से रेखा खींचें'
                  : 'Draw from START to END with your finger or mouse'}
              </p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            COMPLETION SCREEN
        ═══════════════════════════════════════════════════════════════════ */}
        {activityIndex === 3 && (
          <div className="flex flex-col items-center text-center py-6 space-y-5 animate-fadeIn">
            {/* Success icon */}
            <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center">
              <Sparkles size={36} className="text-accent" />
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-primary">
                {S.screeningComplete}
              </h2>
              <p className="text-muted mt-1 text-base font-medium">
                {appState.companion?.nickname || 'Gyaan'}
                {lang === 'HI' ? ' बहुत खुश है!' : ' is proud of you!'}
              </p>
            </div>

            {/* Profile reveal card - child-friendly, no clinical labels */}
            {profileResult && (
              <div className="bg-card border border-gray-100 rounded-xl p-5 w-full max-w-sm shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={22} className="text-accent" />
                  </div>
                  <p className="text-lg font-semibold text-primary text-left">
                    {PROFILE_MESSAGES[profileResult.detectedType]?.[lang] ||
                      PROFILE_MESSAGES.dyslexia[lang]}
                  </p>
                </div>

                {/* Visual strength indicator - subtle bars, no numbers */}
                <div className="space-y-2 pt-2">
                  <ProfileBar
                    label={lang === 'HI' ? 'सुनना और ध्वनि' : 'Listening & Sounds'}
                    value={profileResult.dyslexiaScore}
                    isDetected={profileResult.detectedType === 'dyslexia'}
                  />
                  <ProfileBar
                    label={lang === 'HI' ? 'वस्तुएं और चित्र' : 'Objects & Visuals'}
                    value={profileResult.dyscalculiaScore}
                    isDetected={profileResult.detectedType === 'dyscalculia'}
                  />
                  <ProfileBar
                    label={lang === 'HI' ? 'बोलना और बनाना' : 'Speaking & Drawing'}
                    value={profileResult.dysgraphiaScore}
                    isDetected={profileResult.detectedType === 'dysgraphia'}
                  />
                </div>
              </div>
            )}

            {/* What's next */}
            <div className="bg-surface border border-gray-100 rounded-xl p-4 w-full max-w-sm space-y-2">
              <p className="text-sm font-semibold text-primary text-center">
                {lang === 'HI' ? 'आपका सफ़र शुरू होता है' : 'Your journey begins with'}
              </p>
              <div className="space-y-1.5">
                {[
                  {
                    icon: <Play size={16} className="text-accent" />,
                    text: lang === 'HI' ? 'आपके लिए बने खास कार्यक्रम' : 'Activities designed for you',
                  },
                  {
                    icon: <Target size={16} className="text-accent" />,
                    text: lang === 'HI' ? 'हर दिन नई चुनौतियां' : 'New challenges every day',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-muted">
                    {item.icon}
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleComplete}
              className="w-full bg-accent text-white font-bold py-4 px-6 rounded-xl min-h-[56px] text-xl hover:bg-accent/90 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-accent active:scale-[0.98] flex items-center justify-center gap-2"
              aria-label={lang === 'HI' ? 'सीखना शुरू करें' : "Let's Start Learning!"}
            >
              {lang === 'HI' ? 'सीखना शुरू करें' : "Let's Start Learning!"}
              <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─── Profile bar sub-component ────────────────────────────────────────────────
// Shows a subtle bar for each learning dimension - no numbers, just relative fill
const ProfileBar = ({ label, value, isDetected }) => (
  <div className="flex items-center gap-3">
    <span className={`text-xs w-28 text-right flex-shrink-0 ${isDetected ? 'font-semibold text-primary' : 'text-muted'}`}>
      {label}
    </span>
    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${
          isDetected ? 'bg-accent' : 'bg-gray-300'
        }`}
        style={{ width: `${Math.max(value * 100, 8)}%` }}
      />
    </div>
  </div>
);