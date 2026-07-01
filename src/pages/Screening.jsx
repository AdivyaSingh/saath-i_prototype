// src/pages/Screening.jsx
// Route: /screening  (student portal)
//
// PRIORITY 1 — research-backed, audio-supported screening that builds a SUPPORT
// PROFILE (never a diagnosis). The student plays short games. They are NEVER shown
// a score, a level, a label, or any "tendency": the completion screen is purely
// encouraging. All results flow only to the teacher portal (TeacherObservation.jsx).
//
// Domains map to the app supportProfile keys: reading, numeracy, memory, attention,
// writing, organisation. High-value areas (reading, numeracy) use two tasks (two-stage).
// Audio: every prompt is spoken automatically (when audio is on) AND has a speaker
// button, so a child who is not yet reading can still play.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, ArrowRight, Sparkles, CheckCircle2, Star } from 'lucide-react';
import { useApp } from '../App';
import { STRINGS, TYPICAL_THRESHOLD, SCREENING_TRACE_PATHS } from '../data';
import Layout from '../components/Layout';
import { saveStudentToFirebase, saveScreeningResults, updateStudentProgress } from '../firebase';
import confetti from 'canvas-confetti';
import { generateInterventionPlan } from '../gemini';

// ─── AUDIO (robust speechSynthesis helper) ──────────────────────────────────
let voicesPrimed = false;
function primeVoices(){
  if (voicesPrimed || !('speechSynthesis' in window)) return;
  try { window.speechSynthesis.getVoices(); } catch (e) {}
  voicesPrimed = true;
}
function speak(text, lang){
  try {
    if (!('speechSynthesis' in window) || !text) return;
    primeVoices();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch (e) { /* no-op */ }
}
function stopSpeak(){ try { window.speechSynthesis.cancel(); } catch (e) {} }

// ─── SMALL UTILITIES ─────────────────────────────────────────────────────────
const shuffle = (a) => { a = a.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const randInt = (n) => Math.floor(Math.random()*n);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mean = (arr) => arr.length ? arr.reduce((s,x)=>s+x,0)/arr.length : 0;
const sd = (arr) => { if (arr.length<2) return 0; const m=mean(arr); return Math.sqrt(mean(arr.map(x=>(x-m)*(x-m)))); };

// ─── TRACE (dysgraphia / fine-motor) helpers — ported from the original screening.
// NOTE: screen-based tracing is only a ROUGH motor signal (trackpads/phones vary),
// so it is treated as a flag to confirm with hands-on classroom observation, never a
// conclusion. Dysgraphia cannot be remediated in the app; a flag becomes a teacher
// suggestion for hands-on, in-class support.
const TRACE_DEV_W = 0.40, TRACE_JIT_W = 0.35, TRACE_INC_W = 0.25;
const toCanvasCoords = (points, w, h) => points.map(p => ({ x: p.x*w, y: p.y*h }));
const samplePolyline = (points, n = 300) => {
  if (points.length < 2) return points;
  let total = 0; for (let i=1;i<points.length;i++) total += Math.hypot(points[i].x-points[i-1].x, points[i].y-points[i-1].y);
  const step = total/n; const out = [];
  for (let s=0;s<=n;s++){ const target=s*step; let acc=0, placed=false;
    for (let i=1;i<points.length;i++){ const seg=Math.hypot(points[i].x-points[i-1].x, points[i].y-points[i-1].y);
      if (acc+seg>=target){ const t=seg>0?(target-acc)/seg:0; out.push({ x:points[i-1].x+t*(points[i].x-points[i-1].x), y:points[i-1].y+t*(points[i].y-points[i-1].y) }); placed=true; break; } acc+=seg; }
    if (!placed) out.push(points[points.length-1]); }
  return out;
};
const minDistToPath = (pt, path) => path.reduce((min,pp)=>{ const d=Math.hypot(pt.x-pp.x, pt.y-pp.y); return d<min?d:min; }, Infinity);
const computeTraceMetrics = (drawn, pathPts) => {
  if (drawn.length < 5) return { avgDeviation:999, jitterScore:1, completionPct:0 };
  const sampled = samplePolyline(pathPts, 300);
  let totalDev = 0; for (const p of drawn) totalDev += minDistToPath(p, sampled);
  const avgDeviation = totalDev / drawn.length;
  let totalAngle = 0, count = 0;
  for (let i=2;i<drawn.length;i++){
    const a1=Math.atan2(drawn[i-1].y-drawn[i-2].y, drawn[i-1].x-drawn[i-2].x);
    const a2=Math.atan2(drawn[i].y-drawn[i-1].y, drawn[i].x-drawn[i-1].x);
    let diff=Math.abs(a2-a1); if (diff>Math.PI) diff=2*Math.PI-diff; totalAngle+=diff; count++;
  }
  const jitterScore = Math.min((count?totalAngle/count:0)/(Math.PI/2), 1);
  const last = drawn[drawn.length-1]; let maxIdx=0, minD=Infinity;
  for (let i=0;i<sampled.length;i++){ const d=Math.hypot(last.x-sampled[i].x, last.y-sampled[i].y); if (d<minD){ minD=d; maxIdx=i; } }
  const completionPct = Math.min(maxIdx/(sampled.length-1), 1);
  return { avgDeviation, jitterScore, completionPct };
};
const getCanvasPos = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x:(src.clientX-rect.left)*(canvas.width/rect.width), y:(src.clientY-rect.top)*(canvas.height/rect.height) };
};
const drawTrace = (ctx, guide, drawn, done) => {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#F8FAFC'; ctx.fillRect(0,0,width,height);
  ctx.save(); ctx.setLineDash([8,6]); ctx.strokeStyle = done ? '#86C7A8' : '#94A3B8'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.beginPath(); guide.forEach((p,i)=> i? ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.stroke(); ctx.restore();
  if (drawn.length>1){ ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = done ? '#2E8B57':'#2E75B6'; ctx.lineWidth=4; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); drawn.forEach((p,i)=> i? ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.stroke(); ctx.restore(); }
  if (guide[0]){ 
    // Start dot
    ctx.fillStyle='#E87722'; ctx.beginPath(); ctx.arc(guide[0].x, guide[0].y, 7, 0, Math.PI*2); ctx.fill(); 
  }
  if (guide.length>1) {
    // End dot
    ctx.fillStyle='#D64545'; ctx.beginPath(); ctx.arc(guide[guide.length-1].x, guide[guide.length-1].y, 7, 0, Math.PI*2); ctx.fill();
  }
};

// ─── TRACE PATH TASK (writing / fine-motor; the kept dysgraphia test) ────────
function TracePathTask({ lang, audioOn, onDone }){
  const W = 400, H = 250;
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const drawnRef = useRef([]);
  const accRef = useRef({ avgDeviation:0, jitterScore:0, completionPct:0, n:0 });

  const path = SCREENING_TRACE_PATHS[idx];
  const guide = path ? toCanvasCoords(path.points, W, H) : [];

  // Draw guide on start / path change
  useEffect(()=>{
    if (!started) return;
    const c = canvasRef.current; if (!c) return;
    drawTrace(c.getContext('2d'), guide, [], false);
    drawnRef.current = [];
    drawingRef.current = false;
    if (audioOn) speak(lang==='HI'?'बिंदु से शुरू करके लाइन पर उंगली फेरो':'Start at the dot and trace along the line', lang);
    // eslint-disable-next-line
  }, [started, idx]);

  // ── Non-passive touch listeners so preventDefault() actually works ──────────
  // React JSX onTouchStart/onTouchMove are passive by default in modern browsers,
  // meaning e.preventDefault() is silently ignored and the page scrolls during
  // drawing, causing coordinates to drift and only one point to be recorded.
  useEffect(()=>{
    if (!started) return;
    const c = canvasRef.current; if (!c) return;

    const getPos = (e) => getCanvasPos(e.touches[0] || e.changedTouches[0], c);

    const onTouchStart = (e) => {
      e.preventDefault();
      if (done) return;
      drawingRef.current = true;
      drawnRef.current = [getPos(e)];
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      drawnRef.current.push(getPos(e));
      drawTrace(c.getContext('2d'), guide, drawnRef.current, false);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (drawnRef.current.length < 5) return;
      const m = computeTraceMetrics(drawnRef.current, guide);
      const a = accRef.current;
      a.avgDeviation = (a.avgDeviation*a.n + m.avgDeviation)/(a.n+1);
      a.jitterScore  = (a.jitterScore*a.n  + m.jitterScore)/(a.n+1);
      a.completionPct= (a.completionPct*a.n + m.completionPct)/(a.n+1);
      a.n++;
      drawTrace(c.getContext('2d'), guide, drawnRef.current, true);
      // trigger re-render so "Next/Done" button becomes active
      // We use a tiny hack: set done via a custom event so we stay inside the effect
      c.dispatchEvent(new CustomEvent('tracedone'));
    };

    c.addEventListener('touchstart', onTouchStart, { passive: false });
    c.addEventListener('touchmove',  onTouchMove,  { passive: false });
    c.addEventListener('touchend',   onTouchEnd,   { passive: false });
    return () => {
      c.removeEventListener('touchstart', onTouchStart);
      c.removeEventListener('touchmove',  onTouchMove);
      c.removeEventListener('touchend',   onTouchEnd);
    };
  // eslint-disable-next-line
  }, [started, idx, guide, done]);

  // Listen for the custom 'tracedone' event to set React done state
  useEffect(()=>{
    if (!started) return;
    const c = canvasRef.current; if (!c) return;
    const handler = () => setDone(true);
    c.addEventListener('tracedone', handler);
    return () => c.removeEventListener('tracedone', handler);
  }, [started, idx]);

  if (!started) return <TaskIntro icon={Star} title={lang==='HI'?'लाइन पर चलो':'Trace the Line'} text={lang==='HI'?'बिंदु से शुरू करके बिंदीदार लाइन पर उंगली फेरो।':'Start at the dot and trace along the dotted line with your finger.'} lang={lang} audioOn={audioOn} onStart={()=>setStarted(true)} />;

  // Mouse handlers (desktop) — passive is fine for mouse events
  const pos = (e) => getCanvasPos(e, canvasRef.current);
  const mouseDown = (e) => { if (done) return; e.preventDefault(); drawingRef.current = true; drawnRef.current = [pos(e)]; };
  const mouseMove = (e) => {
    if (!drawingRef.current || done) return;
    e.preventDefault();
    drawnRef.current.push(pos(e));
    drawTrace(canvasRef.current.getContext('2d'), guide, drawnRef.current, false);
  };
  const mouseUp = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    if (drawnRef.current.length < 5) return;
    const m = computeTraceMetrics(drawnRef.current, guide);
    const a = accRef.current;
    a.avgDeviation = (a.avgDeviation*a.n + m.avgDeviation)/(a.n+1);
    a.jitterScore  = (a.jitterScore*a.n  + m.jitterScore)/(a.n+1);
    a.completionPct= (a.completionPct*a.n + m.completionPct)/(a.n+1);
    a.n++;
    setDone(true);
    drawTrace(canvasRef.current.getContext('2d'), guide, drawnRef.current, true);
  };

  const next = () => {
    if (idx+1 < SCREENING_TRACE_PATHS.length){ setIdx(idx+1); setDone(false); drawnRef.current = []; }
    else {
      const a = accRef.current;
      const deviationNorm = Math.min(a.avgDeviation/40, 1);
      const concern = clamp01(deviationNorm*TRACE_DEV_W + a.jitterScore*TRACE_JIT_W + (1-a.completionPct)*TRACE_INC_W);
      onDone({ concern, detail:{ kind:'motor', avgDeviation:Math.round(a.avgDeviation), jitter:Math.round(a.jitterScore*100)/100, completionPct:Math.round(a.completionPct*100) } });
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="card-elevated p-4 text-center mb-4">
        <p className="text-lg font-semibold text-primary flex items-center justify-center gap-2">
          {lang==='HI'?'लाइन पर उंगली फेरो':'Trace along the line'}<Speaker text={lang==='HI'?'बिंदु से शुरू करके लाइन पर उंगली फेरो':'Start at the dot and trace along the line'} lang={lang} />
        </p>
        <p className="text-xs text-muted mt-1">{idx+1} / {SCREENING_TRACE_PATHS.length}</p>
      </div>
      <div className="card-elevated p-3 flex flex-col items-center">
        <canvas ref={canvasRef} width={W} height={H}
          style={{ width:'100%', maxWidth:W, touchAction:'none', borderRadius:12, cursor:'crosshair', userSelect:'none' }}
          onMouseDown={mouseDown} onMouseMove={mouseMove} onMouseUp={mouseUp} onMouseLeave={mouseUp} />
        <button className={`btn-primary mt-4 inline-flex items-center gap-2 ${done?'':'opacity-50 pointer-events-none'}`} onClick={next}>
          {idx+1 < SCREENING_TRACE_PATHS.length ? (lang==='HI'?'अगला':'Next') : (lang==='HI'?'हो गया':'Done')} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}


// ─── CONTENT BANKS (local; literacy items run in English with bilingual
//     instructions — Hindi literacy banks are a planned addition) ────────────
const RHYME = [
  { audio:'cat', options:[{label:'hat',emoji:'🎩',correct:true},{label:'sun',emoji:'☀️'},{label:'cup',emoji:'🥤'}] },
  { audio:'star', options:[{label:'car',emoji:'🚗',correct:true},{label:'book',emoji:'📖'},{label:'fish',emoji:'🐟'}] },
  { audio:'bee', options:[{label:'tree',emoji:'🌳',correct:true},{label:'shoe',emoji:'👟'},{label:'hand',emoji:'✋'}] },
  { audio:'dog', options:[{label:'frog',emoji:'🐸',correct:true},{label:'ball',emoji:'⚽'},{label:'milk',emoji:'🥛'}] },
];
const FIRSTSOUND = [
  { audio:'sun', options:[{label:'sock',emoji:'🧦',correct:true},{label:'ball',emoji:'⚽'},{label:'leg',emoji:'🦵'}] },
  { audio:'ball', options:[{label:'bat',emoji:'🦇',correct:true},{label:'sun',emoji:'☀️'},{label:'fan',emoji:'🪭'}] },
  { audio:'moon', options:[{label:'map',emoji:'🗺️',correct:true},{label:'sun',emoji:'☀️'},{label:'dog',emoji:'🐶'}] },
  { audio:'fish', options:[{label:'fan',emoji:'🪭',correct:true},{label:'cup',emoji:'🥤'},{label:'leg',emoji:'🦵'}] },
];
const SPELL = [
  { word:'because', options:['because','becuase','becos'] },
  { word:'friend', options:['friend','freind','frend'] },
  { word:'said', options:['said','sed','sayd'] },
  { word:'school', options:['school','skool','schwl'] },
];
const MAG_PAIRS = [[3,8],[7,4],[9,2],[5,6],[8,7],[2,3]];

// ─── REUSABLE UI BITS ─────────────────────────────────────────────────────────
function Speaker({ text, lang, className }){
  return (
    <button
      type="button"
      onClick={(e)=>{ e.stopPropagation(); speak(text, lang); }}
      className={`w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 ${className||''}`}
      aria-label="Read aloud"
    ><Volume2 size={18} /></button>
  );
}

function TaskIntro({ icon:Icon, title, text, lang, audioOn, onStart }){
  useEffect(()=>{ if (audioOn) speak(title + '. ' + text, lang); /* eslint-disable-next-line */ }, []);
  return (
    <div className="card-elevated p-6 text-center animate-fadeIn">
      {Icon && <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3"><Icon size={28} /></div>}
      <h2 className="text-xl font-bold text-primary flex items-center justify-center gap-2">
        {title}<Speaker text={title + '. ' + text} lang={lang} />
      </h2>
      <p className="text-muted mt-2">{text}</p>
      <button className="btn-primary mt-5 inline-flex items-center gap-2" onClick={onStart}>
        {lang==='HI' ? 'शुरू करो' : 'Start'} <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── GENERIC CHOICE-SEQUENCE TASK ───────────────────────────────────────────
function ChoiceSequence({ intro, trials, lang, audioOn, onDone }){
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const correctRef = useRef(0);
  const rtRef = useRef([]);
  const startRef = useRef(0);

  const t = trials[idx];
  useEffect(()=>{
    if (started && t){ startRef.current = performance.now(); setPicked(null); if (audioOn) speak(t.audio || t.prompt, lang); }
    // eslint-disable-next-line
  }, [started, idx]);

  if (!started){
    return <TaskIntro icon={intro.icon} title={intro.title} text={intro.text} lang={lang} audioOn={audioOn} onStart={()=>setStarted(true)} />;
  }

  const choose = (opt, i) => {
    if (picked !== null) return;
    setPicked(i);
    rtRef.current.push(performance.now() - startRef.current);
    if (opt.correct) correctRef.current += 1;
    setTimeout(()=>{
      if (idx + 1 >= trials.length){
        const accuracy = correctRef.current / trials.length;
        onDone({ concern: clamp01(1 - accuracy), detail:{ accuracy: Math.round(accuracy*100)/100, meanRtMs: Math.round(mean(rtRef.current)) } });
      } else {
        setIdx(idx + 1);
      }
    }, 600);
  };

  const opts = t._shuffled || (t._shuffled = shuffle(t.options));
  return (
    <div className="animate-fadeIn">
      <div className="card-elevated p-4 text-center mb-4">
        <p className="text-lg font-semibold text-primary flex items-center justify-center gap-2">
          {t.prompt}<Speaker text={t.audio || t.prompt} lang={lang} />
        </p>
        <p className="text-xs text-muted mt-1">{lang==='HI'?`सवाल ${idx+1} / ${trials.length}`:`${idx+1} of ${trials.length}`}</p>
      </div>
      <div className={`grid gap-3 ${t.twoCol ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {opts.map((opt, i) => {
          let cls = 'bg-card border-gray-200';
          if (picked === i) cls = opt.correct ? 'border-success bg-success/10' : 'border-warm bg-warm/10';
          return (
            <button key={i} disabled={picked!==null} onClick={()=>choose(opt,i)}
              className={`rounded-2xl border-2 p-4 min-h-[96px] flex flex-col items-center justify-center gap-1 transition-all ${cls}`}>
              {opt.emoji && <span style={{fontSize:'38px',lineHeight:1}}>{opt.emoji}</span>}
              {opt.label && <span className="text-primary font-medium">{opt.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── NUMBER LINE TASK (numeracy, confirm) ────────────────────────────────────
function NumberLineTask({ max, targets, lang, audioOn, onDone }){
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [mark, setMark] = useState(null);
  const errsRef = useRef([]);
  const barRef = useRef(null);
  const tg = targets[idx];

  useEffect(()=>{ if (started && tg!=null && audioOn) speak((lang==='HI'?'रेखा पर ':'Where does ')+tg+(lang==='HI'?' कहाँ है?':' go?'), lang); /* eslint-disable-next-line */ }, [started, idx]);

  if (!started) return <TaskIntro icon={Star} title={lang==='HI'?'यह कहाँ जाएगा?':'Where Does It Go?'} text={lang==='HI'?`रेखा 0 से ${max} तक है। संख्या जहाँ है वहाँ रेखा पर दबाओ।`:`The line goes 0 to ${max}. Tap where the number belongs.`} lang={lang} audioOn={audioOn} onStart={()=>setStarted(true)} />;

  const onTap = (e) => {
    if (mark !== null) return;
    const rect = barRef.current.getBoundingClientRect();
    const frac = clamp01((e.clientX - rect.left)/rect.width);
    const err = Math.abs(frac*max - tg)/max;
    errsRef.current.push(err);
    setMark(frac);
    setTimeout(()=>{
      if (idx+1 >= targets.length){
        onDone({ concern: clamp01(mean(errsRef.current)/0.20), detail:{ meanErrorPct: Math.round(mean(errsRef.current)*100) } });
      } else { setMark(null); setIdx(idx+1); }
    }, 750);
  };

  return (
    <div className="animate-fadeIn">
      <div className="card-elevated p-4 text-center mb-6">
        <p className="text-lg font-semibold text-primary flex items-center justify-center gap-2">
          {lang==='HI'?'कहाँ है ':'Where does '}<span className="text-2xl text-accent">{tg}</span>{lang==='HI'?'?':' go?'}
          <Speaker text={(lang==='HI'?'रेखा पर ':'Where does ')+tg+(lang==='HI'?' कहाँ है?':' go?')} lang={lang} />
        </p>
      </div>
      <div className="card-elevated p-6">
        <div ref={barRef} onClick={onTap} className="relative h-16 cursor-pointer">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-accent/30" />
          <div className="absolute left-0 top-0 text-xs font-bold text-muted">0</div>
          <div className="absolute right-0 top-0 text-xs font-bold text-muted">{max}</div>
          {mark!==null && <div className="absolute -top-1 text-2xl -translate-x-1/2" style={{left:(mark*100)+'%'}}>📍</div>}
        </div>
        <p className="text-xs text-muted text-center mt-2">{lang==='HI'?'रेखा पर कहीं भी दबाओ':'Tap anywhere on the line'}</p>
      </div>
    </div>
  );
}

// ─── DIGIT SPAN TASK (memory) ────────────────────────────────────────────────
function DigitSpanTask({ lengths, expect, lang, audioOn, onDone }){
  const [phase, setPhase] = useState('intro'); // intro | show | recall
  const [shownDigit, setShownDigit] = useState('');
  const [entered, setEntered] = useState([]);
  const seqRef = useRef([]);
  const liRef = useRef(0);
  const bestRef = useRef(0);
  const timerRef = useRef(null);

  const startLevel = () => {
    if (liRef.current >= lengths.length){
      onDone({ concern: clamp01((expect - bestRef.current)/2), detail:{ span: bestRef.current, expected: expect } });
      return;
    }
    const len = lengths[liRef.current];
    const seq = []; for (let i=0;i<len;i++) seq.push(randInt(10));
    seqRef.current = seq;
    setEntered([]);
    setPhase('show');
    let k = 0;
    const step = () => {
      if (k >= seq.length){ setShownDigit(''); setTimeout(()=>setPhase('recall'), 300); return; }
      setShownDigit(String(seq[k]));
      if (audioOn) speak(String(seq[k]), lang);
      timerRef.current = setTimeout(()=>{ setShownDigit(''); timerRef.current = setTimeout(()=>{ k++; step(); }, 250); }, 850);
    };
    timerRef.current = setTimeout(step, 500);
  };
  useEffect(()=> ()=> clearTimeout(timerRef.current), []);

  if (phase === 'intro'){
    return <TaskIntro icon={Star} title={lang==='HI'?'संख्याएँ याद रखो':'Remember the Numbers'} text={lang==='HI'?'संख्याएँ एक-एक करके दिखेंगी। फिर उन्हें उसी क्रम में दबाओ।':'Numbers appear one at a time. Then tap them back in the same order.'} lang={lang} audioOn={audioOn} onStart={()=>{ liRef.current=0; bestRef.current=0; startLevel(); }} />;
  }
  if (phase === 'show'){
    return (
      <div className="card-elevated p-8 text-center animate-fadeIn">
        <p className="text-muted mb-4">{lang==='HI'?'देखो और सुनो...':'Watch and listen...'}</p>
        <div style={{fontSize:'84px',lineHeight:1.2,minHeight:120}} className="font-bold text-primary">{shownDigit}</div>
      </div>
    );
  }
  const submit = () => {
    const ok = entered.length===seqRef.current.length && entered.every((v,i)=>v===seqRef.current[i]);
    if (ok) bestRef.current = Math.max(bestRef.current, seqRef.current.length);
    liRef.current += 1;
    startLevel();
  };
  return (
    <div className="animate-fadeIn">
      <div className="card-elevated p-4 text-center mb-4">
        <p className="text-lg font-semibold text-primary">{lang==='HI'?'उसी क्रम में दबाओ':'Tap them in order'}</p>
        <div style={{fontSize:'34px',minHeight:46}} className="font-bold text-accent tracking-widest">{entered.join(' ')}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {[1,2,3,4,5,6,7,8,9].map(n=>(
          <button key={n} className="bg-card border-2 border-gray-200 rounded-xl text-2xl font-bold py-4 text-primary" onClick={()=>setEntered([...entered,n])}>{n}</button>
        ))}
        <button className="bg-card border-2 border-gray-200 rounded-xl text-xl py-4 text-muted" onClick={()=>setEntered(entered.slice(0,-1))}>⌫</button>
        <button className="bg-card border-2 border-gray-200 rounded-xl text-2xl font-bold py-4 text-primary" onClick={()=>setEntered([...entered,0])}>0</button>
        <button className="rounded-xl text-2xl py-4 bg-success text-white" onClick={submit}>✓</button>
      </div>
    </div>
  );
}

// ─── GO / NO-GO TASK (attention, CPT-style) ──────────────────────────────────
function GoNoGoTask({ lang, audioOn, onDone }){
  const [phase, setPhase] = useState('intro'); // intro | run
  const [stim, setStim] = useState('');
  const [count, setCount] = useState(0);
  const N = 24;
  const seqRef = useRef([]);
  const tRef = useRef(0);
  const curRef = useRef(null);
  const respRef = useRef(false);
  const shownAtRef = useRef(0);
  const omRef = useRef(0), coRef = useRef(0), goRef = useRef(0), nogoRef = useRef(0), rtRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(()=> ()=> clearTimeout(timerRef.current), []);

  const begin = () => {
    const seq = []; for (let i=0;i<N;i++) seq.push(Math.random()<0.28 ? 'nogo':'go');
    seqRef.current = seq; tRef.current = 0;
    omRef.current=0; coRef.current=0; goRef.current=0; nogoRef.current=0; rtRef.current=[];
    setPhase('run');
    timerRef.current = setTimeout(trial, 500);
  };
  const trial = () => {
    const t = tRef.current;
    if (t >= N){
      const omRate = goRef.current ? omRef.current/goRef.current : 0;
      const coRate = nogoRef.current ? coRef.current/nogoRef.current : 0;
      const rtVar = clamp01(sd(rtRef.current)/400);
      onDone({ concern: clamp01(0.5*omRate + 0.4*coRate + 0.1*rtVar),
        detail:{ omissions:omRef.current, commissions:coRef.current, goTotal:goRef.current, nogoTotal:nogoRef.current, meanRtMs:Math.round(mean(rtRef.current)) } });
      return;
    }
    const cur = seqRef.current[t];
    curRef.current = cur; respRef.current = false; shownAtRef.current = performance.now();
    if (cur==='go') goRef.current++; else nogoRef.current++;
    setStim(cur==='go' ? '🦋' : '🕷️');
    setCount(t+1);
    timerRef.current = setTimeout(()=>{
      if (curRef.current==='go' && !respRef.current) omRef.current++;
      curRef.current = null; setStim('');
      timerRef.current = setTimeout(()=>{ tRef.current = t+1; trial(); }, 350);
    }, 950);
  };
  const tap = () => {
    if (curRef.current==='go' && !respRef.current){ respRef.current=true; rtRef.current.push(performance.now()-shownAtRef.current); }
    else if (curRef.current==='nogo' && !respRef.current){ respRef.current=true; coRef.current++; }
  };

  if (phase==='intro') return <TaskIntro icon={Star} title={lang==='HI'?'तितली पकड़ो':'Catch the Butterfly'} text={lang==='HI'?'🦋 तितली दिखे तो दबाओ। 🕷️ मकड़ी दिखे तो मत दबाओ।':'Tap when you see a 🦋 butterfly. Do NOT tap for a 🕷️ spider.'} lang={lang} audioOn={audioOn} onStart={begin} />;

  return (
    <div className="animate-fadeIn">
      <div className="card-elevated p-4 text-center mb-4">
        <p className="text-lg font-semibold text-primary">{lang==='HI'?'🦋 के लिए दबाओ, 🕷️ के लिए नहीं':'Tap for 🦋, not for 🕷️'}</p>
        <p className="text-xs text-muted mt-1">{count} / {N}</p>
      </div>
      <button onClick={tap} className="w-full rounded-2xl bg-accent/5 border-2 border-accent/20 flex items-center justify-center select-none" style={{minHeight:200,fontSize:'90px'}}>
        {stim}
      </button>
    </div>
  );
}

// ─── MULTI-STEP TASK (organisation / executive function) ─────────────────────
function MultiStepTask({ lang, audioOn, onDone }){
  const ITEMS = [
    { say:'Tap the red circle, then the yellow star', sayHI:'पहले लाल गोला दबाओ, फिर पीला तारा', order:['red-circle','yellow-star'] },
    { say:'Tap the blue square, then the green circle', sayHI:'पहले नीला चौकोर दबाओ, फिर हरा गोला', order:['blue-square','green-circle'] },
  ];
  const SHAPES = [
    { id:'red-circle', color:'#D64545', shape:'circle' },
    { id:'yellow-star', color:'#D9A300', shape:'star' },
    { id:'blue-square', color:'#2E75B6', shape:'square' },
    { id:'green-circle', color:'#2E8B57', shape:'circle' },
  ];
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState([]);
  const tapsRef = useRef([]);
  const correctRef = useRef(0);
  const item = ITEMS[idx];

  useEffect(()=>{ if (started && item && audioOn) speak(lang==='HI'?item.sayHI:item.say, lang); /* eslint-disable-next-line */ }, [started, idx]);

  if (!started) return <TaskIntro icon={Star} title={lang==='HI'?'कदमों का पालन करो':'Follow the Steps'} text={lang==='HI'?'निर्देश सुनो, फिर आकृतियों को उसी क्रम में दबाओ।':'Listen to the instruction, then tap the shapes in that order.'} lang={lang} audioOn={audioOn} onStart={()=>setStarted(true)} />;

  const drawShape = (s) => {
    const base = { width:56, height:56, background:s.color, display:'flex' };
    if (s.shape==='circle') base.borderRadius='50%';
    else if (s.shape==='square') base.borderRadius='10px';
    else if (s.shape==='star'){ return <span style={{fontSize:56, color:s.color, lineHeight:1}}>★</span>; }
    return <div style={base} />;
  };
  const tap = (s) => {
    if (done.includes(s.id)) return;
    const nd = [...done, s.id]; setDone(nd); tapsRef.current.push(s.id);
    if (tapsRef.current.length === item.order.length){
      const ok = tapsRef.current.every((v,i)=>v===item.order[i]);
      if (ok) correctRef.current += 1;
      setTimeout(()=>{
        if (idx+1 >= ITEMS.length){ onDone({ concern: clamp01(1 - correctRef.current/ITEMS.length), detail:{ accuracy: correctRef.current/ITEMS.length } }); }
        else { tapsRef.current=[]; setDone([]); setIdx(idx+1); }
      }, 800);
    }
  };
  return (
    <div className="animate-fadeIn">
      <div className="card-elevated p-4 text-center mb-4">
        <p className="text-lg font-semibold text-primary flex items-center justify-center gap-2">
          {lang==='HI'?'सुनो, फिर क्रम में दबाओ':'Listen, then tap in order'}<Speaker text={lang==='HI'?item.sayHI:item.say} lang={lang} />
        </p>
      </div>
      <div className="flex flex-wrap gap-4 justify-center card-elevated p-6">
        {shuffle(SHAPES).map(s=>(
          <button key={s.id} onClick={()=>tap(s)} style={{opacity: done.includes(s.id)?0.4:1}} className="p-2">{drawShape(s)}</button>
        ))}
      </div>
    </div>
  );
}

// ─── SCORING ───────────────────────────────────────────────────────────────
const levelFromConcern = (c) => (c > 0.6 ? 'high' : (c > TYPICAL_THRESHOLD ? 'some' : 'low'));

function buildProfile(results){
  const byDomain = {};
  Object.keys(results).forEach(id=>{
    const r = results[id]; if (r.concern==null) return;
    (byDomain[r.domain] = byDomain[r.domain] || []).push(r.concern);
  });
  const supportProfile = { reading:'low', writing:'low', numeracy:'low', attention:'low', memory:'low', organisation:'low' };
  const concerns = {};
  Object.keys(byDomain).forEach(d=>{ const c = mean(byDomain[d]); concerns[d]=c; supportProfile[d] = levelFromConcern(c); });
  let primary = 'reading', best = -1;
  Object.keys(concerns).forEach(d=>{ if (concerns[d] > best){ best = concerns[d]; primary = d; } });
  const highs = Object.values(supportProfile).filter(v=>v==='high').length;
  const tier = highs >= 2 ? 3 : (highs >= 1 ? 2 : 1);
  return { supportProfile, primarySupportArea: primary, tier, concerns };
}

// ─── TASK REGISTRY (render takes (onDone, audioOn)) ──────────────────────────
function buildTasks(lang, gradeBand){
  const numMax = gradeBand==='early' ? 10 : (gradeBand==='upper' ? 100 : 20);
  const nlTargets = numMax<=10 ? [3,7,9] : (numMax<=20 ? [6,13,18] : [22,57,84]);
  const spanLens = gradeBand==='early' ? [3,4] : (gradeBand==='upper' ? [4,5,6] : [3,4,5]);
  const spanExpect = gradeBand==='early' ? 3 : (gradeBand==='upper' ? 5 : 4);

  return [
    { id:'rhyme', domain:'reading', render:(onDone, audioOn)=>(
      <ChoiceSequence key="rhyme" lang={lang} audioOn={audioOn} onDone={onDone}
        intro={{ icon:Star, title: lang==='HI'?'ध्वनि मिलान':'Sound Match', text: lang==='HI'?'शब्द सुनो, फिर वह तस्वीर चुनो जो अंत में उसी तरह लगती है।':'Listen, then tap the picture whose name sounds the same at the end.' }}
        trials={RHYME.map(r=>({ prompt: (lang==='HI'?'किसकी तुक मिलती है ':'Which rhymes with ')+r.audio.toUpperCase()+'?', audio:r.audio, options:r.options }))} />
    )},
    { id:'firstsound', domain:'reading', render:(onDone, audioOn)=>(
      <ChoiceSequence key="firstsound" lang={lang} audioOn={audioOn} onDone={onDone}
        intro={{ icon:Star, title: lang==='HI'?'पहली ध्वनि':'First Sound', text: lang==='HI'?'शब्द सुनो, फिर वह तस्वीर चुनो जो उसी पहली ध्वनि से शुरू होती है।':'Listen, then tap the picture that starts with the same first sound.' }}
        trials={FIRSTSOUND.map(r=>({ prompt: (lang==='HI'?'किसकी पहली ध्वनि वैसी ही है ':'Same first sound as ')+r.audio.toUpperCase()+'?', audio:r.audio, options:r.options }))} />
    )},
    { id:'magnitude', domain:'numeracy', render:(onDone, audioOn)=>(
      <ChoiceSequence key="magnitude" lang={lang} audioOn={audioOn} onDone={onDone}
        intro={{ icon:Star, title: lang==='HI'?'बड़ी संख्या':'Bigger Number', text: lang==='HI'?'दो संख्याओं में से जो बड़ी है उसे दबाओ।':'Tap the number that is bigger.' }}
        trials={MAG_PAIRS.map(p=>({ prompt: lang==='HI'?'कौन सी बड़ी है?':'Which is bigger?', audio: lang==='HI'?'बड़ी संख्या दबाओ':'Tap the bigger number', twoCol:true, options:[{label:String(p[0]),correct:p[0]>p[1]},{label:String(p[1]),correct:p[1]>p[0]}] }))} />
    )},
    { id:'numline', domain:'numeracy', render:(onDone, audioOn)=>(
      <NumberLineTask key="numline" max={numMax} targets={nlTargets} lang={lang} audioOn={audioOn} onDone={onDone} />
    )},
    { id:'digit', domain:'memory', render:(onDone, audioOn)=>(
      <DigitSpanTask key="digit" lengths={spanLens} expect={spanExpect} lang={lang} audioOn={audioOn} onDone={onDone} />
    )},
    { id:'gonogo', domain:'attention', render:(onDone, audioOn)=>(
      <GoNoGoTask key="gonogo" lang={lang} audioOn={audioOn} onDone={onDone} />
    )},
    { id:'trace', domain:'writing', render:(onDone, audioOn)=>(
      <TracePathTask key="trace" lang={lang} audioOn={audioOn} onDone={onDone} />
    )},
    { id:'spelling', domain:'writing', render:(onDone, audioOn)=>(
      <ChoiceSequence key="spelling" lang={lang} audioOn={audioOn} onDone={onDone}
        intro={{ icon:Star, title: lang==='HI'?'सही वर्तनी':'Find the Spelling', text: lang==='HI'?'शब्द सुनो, फिर वह डिब्बा दबाओ जिसमें वह सही लिखा है।':'Listen, then tap the box where it is spelled correctly.' }}
        trials={SPELL.map(s=>({ prompt: lang==='HI'?'कौन सी वर्तनी सही है?':'Which spelling is correct?', audio:s.word, options:s.options.map(o=>({label:o,correct:o===s.word})) }))} />
    )},
    { id:'multistep', domain:'organisation', render:(onDone, audioOn)=>(
      <MultiStepTask key="multistep" lang={lang} audioOn={audioOn} onDone={onDone} />
    )},
  ];
}

// ─── MAIN CONTROLLER ─────────────────────────────────────────────────────────
const Screening = () => {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;
  const gradeBand = (appState.studentClass <= 2) ? 'early' : (appState.studentClass >= 6 ? 'upper' : 'mid');

  const [audioOn, setAudioOn] = useState(true);
  const [taskIndex, setTaskIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const resultsRef = useRef({});
  const tasks = useRef(buildTasks(lang, gradeBand)).current;

  useEffect(()=> ()=> stopSpeak(), []);

  const handleTaskDone = (metrics) => {
    const task = tasks[taskIndex];
    resultsRef.current[task.id] = { domain: task.domain, concern: metrics.concern, detail: metrics.detail };
    stopSpeak();
    if (taskIndex + 1 >= tasks.length){ finalize(); }
    else { setTaskIndex(taskIndex + 1); }
  };

  async function finalize(){
    const profile = buildProfile(resultsRef.current);
    const motorConcern = resultsRef.current.trace ? resultsRef.current.trace.concern : null;
    setFinished(true);
    stopSpeak();
    setTimeout(()=>{ try{ confetti({ particleCount:90, spread:70, origin:{y:0.7}, colors:['#2E75B6','#E87722','#2E8B57'] }); }catch(e){} }, 300);

    // Keep results in local state for the app, but NEVER show them to the student.
    updateState({
      supportProfile: profile.supportProfile,
      primarySupportArea: profile.primarySupportArea,
      tier: profile.tier,
      motorConcern,
      screeningStatus: 'awaiting_observation',
    });

    // Persist to Firebase, tagged with the class code, for the teacher portal.
    try {
      const studentId = appState.studentId || appState.firebaseStudentId;
      if (studentId){
        const screeningResults = {
          source: 'student_cognitive',
          supportProfile: profile.supportProfile,
          primarySupportArea: profile.primarySupportArea,
          tier: profile.tier,
          concerns: profile.concerns,
          motorConcern,
        };
        await saveStudentToFirebase({
          id: studentId,
          name: appState.studentName || 'Student',
          class: appState.studentClass || 4,
          classCode: (appState.classCode || 'SCH001').toUpperCase(),
          supportProfile: profile.supportProfile,
          primarySupportArea: profile.primarySupportArea,
          tier: profile.tier,
          motorConcern,
          screeningStatus: 'awaiting_observation',
          companion: appState.companion || null,
          // Teacher dashboard fields — defaults so cards render correctly from day 1
          status: 'green',
          streakDays: appState.streakDays ?? 0,
          activitiesCompleted: appState.activitiesCompleted || {},
          referralStatus: 'none',
        });
        await saveScreeningResults(studentId, screeningResults, resultsRef.current);

        // ── Generate personalised intervention plan (non-blocking) ────────────
        // Fire-and-forget: never delays the student. Plan appears on home page
        // once Gemini responds. Persisted to both appState and Firebase.
        generateInterventionPlan({
          name:               appState.studentName || 'Student',
          class:              appState.studentClass || 4,
          language:           lang,
          supportProfile:     profile.supportProfile,
          primarySupportArea: profile.primarySupportArea,
          tier:               profile.tier,
        }).then(plan => {
          if (!plan) return;
          updateState({ interventionPlan: plan });
          updateStudentProgress(studentId, { interventionPlan: plan }).catch(() => {});
        }).catch(() => {});
      }
    } catch (e) { /* offline-safe: local state already updated */ }
  }

  const progress = finished ? 1 : (taskIndex / tasks.length);

  return (
    <Layout
      title={S.screeningTitle || (lang==='HI'?'खेल का समय':'Game Time')}
      showBack={false}
      showCompanion
      pageContext="Playing short screening games. Never show the child any result, score, or label."
      companionState={finished ? 'happy' : 'encouraging'}
      lang={lang}
      setLanguage={(l)=>updateState({ language:l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      <div className="max-w-md mx-auto px-4 py-5 pb-28">
        {!finished && (
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-accent to-calm transition-all" style={{ width: Math.round(progress*100)+'%' }} />
            </div>
            <button
              onClick={()=>{ const v=!audioOn; setAudioOn(v); if(!v) stopSpeak(); }}
              className="w-10 h-10 rounded-full bg-card border border-gray-200 flex items-center justify-center text-primary"
              aria-label={audioOn ? 'Mute audio' : 'Unmute audio'}
            >{audioOn ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
          </div>
        )}

        {!finished ? (
          tasks[taskIndex].render(handleTaskDone, audioOn)
        ) : (
          <div className="card-elevated p-8 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="text-success" size={36} />
            </div>
            <h1 className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
              {lang==='HI' ? 'शाबाश!' : 'All done!'}<Sparkles className="text-warm" size={22} />
            </h1>
            <p className="text-muted mt-2">
              {lang==='HI' ? 'तुमने सारे खेल पूरे कर लिए। बहुत बढ़िया मेहनत!' : 'You finished all the games. Great effort!'}
            </p>
            <button className="btn-primary mt-6 inline-flex items-center gap-2" onClick={()=>navigate('/home')}>
              {lang==='HI' ? 'घर जाओ' : 'Go to my home'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Screening;
