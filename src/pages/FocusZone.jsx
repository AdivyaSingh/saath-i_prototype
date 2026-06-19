// src/pages/FocusZone.jsx
// Route: /focus-zone
// Focus Zone - short, gentle warm-up activities for attention, concentration,
// visual tracking, and memory. Fully self-contained: no AI calls, no shared data,
// so it works on localhost without the Vercel backend.
// Emotionally safe: no punishing timers, no scores shown as judgement, no SLD
// labels. It rewards effort and gives gentle feedback. Support-based framing only.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye, Search, Brain, Zap, Volume2, RefreshCw, Check,
  Sparkles, ArrowRight, ArrowLeft, Trophy, Star,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../App';
import Layout from '../components/Layout';

// ─── SMALL HELPERS ─────────────────────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sample = (arr, n) => shuffle(arr).slice(0, n);

// Speak an instruction aloud (audio support for non-readers). Safe no-op if the
// browser has no speech synthesis or no matching voice.
const speak = (text, lang) => {
  try {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'HI' ? 'hi-IN' : 'en-IN';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* ignore */
  }
};

const celebrate = () => {
  try {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
  } catch {
    /* ignore */
  }
};

// A reusable little instruction row with a speaker button.
const Instruction = ({ text, lang }) => (
  <div className="flex items-center justify-center gap-2 mb-4">
    <p className="text-primary font-semibold text-base text-center">{text}</p>
    <button
      onClick={() => speak(text, lang)}
      className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0"
      aria-label="Read aloud"
    >
      <Volume2 className="w-5 h-5" />
    </button>
  </div>
);

// A friendly "you did it" panel shown when an activity is finished.
const DonePanel = ({ lang, onAgain }) => (
  <div className="text-center mt-6 animate-scaleIn">
    <div className="w-16 h-16 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-3">
      <Check className="w-8 h-8 text-success" />
    </div>
    <p className="text-primary font-bold text-lg">
      {lang === 'HI' ? 'बहुत बढ़िया ध्यान!' : 'Great focusing!'}
    </p>
    <p className="text-muted text-sm mb-4">
      {lang === 'HI' ? 'तुमने इसे पूरा किया।' : 'You finished it.'}
    </p>
    <button onClick={onAgain} className="btn-secondary inline-flex items-center gap-2">
      <RefreshCw className="w-4 h-4" />
      {lang === 'HI' ? 'फिर खेलो' : 'Play again'}
    </button>
  </div>
);

// ─── ACTIVITY 1: SYMBOL SEARCH (attention + visual scanning) ────────────────────
function SymbolSearch({ lang, onComplete }) {
  const POOL = ['🍎', '🍌', '🍇', '🍓', '🍊', '🥝', '🍉', '🍑'];
  const GRID = 20;
  const TARGET_COUNT = 5;

  const [round, setRound] = useState(0);
  const [target, setTarget] = useState('🍎');
  const [cells, setCells] = useState([]);
  const [found, setFound] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const tgt = POOL[Math.floor(Math.random() * POOL.length)];
    const others = POOL.filter((e) => e !== tgt);
    const arr = [];
    for (let i = 0; i < TARGET_COUNT; i++) arr.push({ emoji: tgt, isTarget: true, found: false });
    for (let i = TARGET_COUNT; i < GRID; i++) {
      arr.push({ emoji: others[Math.floor(Math.random() * others.length)], isTarget: false, found: false });
    }
    setTarget(tgt);
    setCells(shuffle(arr));
    setFound(0);
    setDone(false);
  }, [round]);

  const tap = (i) => {
    const c = cells[i];
    if (!c || !c.isTarget || c.found) return; // distractors do nothing, no penalty
    const next = cells.map((cell, idx) => (idx === i ? { ...cell, found: true } : cell));
    setCells(next);
    const f = next.filter((x) => x.isTarget && x.found).length;
    setFound(f);
    if (f === TARGET_COUNT) {
      setDone(true);
      celebrate();
      onComplete && onComplete();
    }
  };

  const instruction = lang === 'HI' ? `सारे ${target} पर टैप करो` : `Tap all the ${target}`;

  return (
    <div>
      <Instruction text={instruction} lang={lang} />
      <p className="text-center text-muted text-sm mb-4">
        {lang === 'HI' ? `मिल गए: ${found} / ${TARGET_COUNT}` : `Found: ${found} / ${TARGET_COUNT}`}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {cells.map((c, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            disabled={c.found}
            className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-150 ${
              c.found ? 'bg-success/20 ring-2 ring-success' : 'bg-card card-elevated active:scale-95'
            }`}
            aria-label={c.found ? 'found' : 'symbol'}
          >
            <span aria-hidden="true">{c.emoji}</span>
          </button>
        ))}
      </div>
      {done && <DonePanel lang={lang} onAgain={() => setRound((r) => r + 1)} />}
    </div>
  );
}

// ─── ACTIVITY 2: FOLLOW THE STAR (visual tracking) ──────────────────────────────
function VisualTracking({ lang, onComplete }) {
  const [order, setOrder] = useState([0, 1, 2]); // left-to-right cup ids
  const [starCup, setStarCup] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro | reveal | shuffle | guess | result
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(false);
  const timerRef = useRef(null);

  const start = () => {
    setStarCup(Math.floor(Math.random() * 3));
    setOrder([0, 1, 2]);
    setPicked(null);
    setCorrect(false);
    setPhase('reveal');
  };

  // Phase machine
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (phase === 'reveal') {
      timerRef.current = setTimeout(() => setPhase('shuffle'), 1300);
    } else if (phase === 'shuffle') {
      let count = 0;
      const SWAPS = 5;
      const doSwap = () => {
        setOrder((prev) => {
          const a = [...prev];
          let i = Math.floor(Math.random() * 3);
          let j = Math.floor(Math.random() * 3);
          while (j === i) j = Math.floor(Math.random() * 3);
          [a[i], a[j]] = [a[j], a[i]];
          return a;
        });
        count++;
        if (count < SWAPS) timerRef.current = setTimeout(doSwap, 650);
        else timerRef.current = setTimeout(() => setPhase('guess'), 700);
      };
      timerRef.current = setTimeout(doSwap, 650);
    }
    return () => clearTimeout(timerRef.current);
  }, [phase]);

  const pickSlot = (slotIndex) => {
    if (phase !== 'guess') return;
    const cupId = order[slotIndex];
    setPicked(slotIndex);
    const ok = cupId === starCup;
    setCorrect(ok);
    setPhase('result');
    if (ok) {
      celebrate();
      onComplete && onComplete();
    }
  };

  const showStar = phase === 'reveal' || phase === 'result';

  const instruction =
    phase === 'reveal'
      ? lang === 'HI' ? 'तारे वाले कप को याद रखो' : 'Remember the cup with the star'
      : phase === 'shuffle'
      ? lang === 'HI' ? 'कपों को ध्यान से देखो...' : 'Watch the cups carefully...'
      : phase === 'guess'
      ? lang === 'HI' ? 'तारा किस कप में है?' : 'Which cup has the star?'
      : '';

  return (
    <div>
      {phase === 'intro' ? (
        <div className="text-center py-8">
          <Eye className="w-12 h-12 text-calm mx-auto mb-3" />
          <p className="text-muted text-sm mb-5">
            {lang === 'HI'
              ? 'तारे वाले कप पर नज़र रखो जब वे घूमें।'
              : 'Keep your eyes on the cup with the star as they move.'}
          </p>
          <button onClick={start} className="btn-primary inline-flex items-center gap-2">
            {lang === 'HI' ? 'शुरू करो' : 'Start'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {instruction && <Instruction text={instruction} lang={lang} />}
          <div className="flex justify-center gap-4 my-8 min-h-[120px] items-end">
            {order.map((cupId, slotIndex) => (
              <motion.button
                key={cupId}
                layout
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                onClick={() => pickSlot(slotIndex)}
                disabled={phase !== 'guess'}
                className="relative flex flex-col items-center"
                aria-label={`cup ${slotIndex + 1}`}
              >
                {showStar && cupId === starCup && (
                  <Star className="w-7 h-7 text-warm fill-warm absolute -top-8" aria-hidden="true" />
                )}
                <div
                  className={`w-16 h-20 rounded-b-2xl rounded-t-lg border-2 transition-all duration-150 ${
                    phase === 'result' && picked === slotIndex
                      ? correct
                        ? 'bg-success/20 border-success'
                        : 'bg-red-50 border-red-300'
                      : 'bg-accent/10 border-accent/40'
                  } ${phase === 'guess' ? 'active:scale-95 cursor-pointer' : ''}`}
                />
              </motion.button>
            ))}
          </div>
          {phase === 'result' && (
            <div className="text-center animate-fadeIn">
              <p className={`font-semibold ${correct ? 'text-success' : 'text-primary'}`}>
                {correct
                  ? lang === 'HI' ? 'सही! बढ़िया नज़र!' : 'Yes! Great tracking!'
                  : lang === 'HI' ? 'यहाँ था! फिर कोशिश करो।' : 'It was here! Try again.'}
              </p>
              <button onClick={start} className="btn-secondary inline-flex items-center gap-2 mt-4">
                <RefreshCw className="w-4 h-4" />
                {lang === 'HI' ? 'फिर खेलो' : 'Play again'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── ACTIVITY 3: MEMORY MATCH (memory) ──────────────────────────────────────────
function MemoryMatch({ lang, onComplete }) {
  const POOL = ['🌟', '🌈', '🌸', '🍀', '🎈', '🦋', '🐢', '🌻'];
  const PAIRS = 4;

  const [round, setRound] = useState(0);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [lock, setLock] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const chosen = sample(POOL, PAIRS);
    const deck = shuffle(
      [...chosen, ...chosen].map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }))
    );
    setCards(deck);
    setFlipped([]);
    setLock(false);
    setDone(false);
  }, [round]);

  useEffect(() => {
    if (cards.length && cards.every((c) => c.matched) && !done) {
      setDone(true);
      celebrate();
      onComplete && onComplete();
    }
  }, [cards, done, onComplete]);

  const tap = (i) => {
    if (lock) return;
    const c = cards[i];
    if (!c || c.flipped || c.matched) return;
    const nf = [...flipped, i];
    setCards(cards.map((card, idx) => (idx === i ? { ...card, flipped: true } : card)));
    setFlipped(nf);
    if (nf.length === 2) {
      setLock(true);
      const [a, b] = nf;
      const isMatch = cards[a].emoji === cards[b].emoji;
      setTimeout(() => {
        setCards((prev) =>
          prev.map((card, idx) =>
            idx === a || idx === b
              ? isMatch
                ? { ...card, matched: true }
                : { ...card, flipped: false }
              : card
          )
        );
        setFlipped([]);
        setLock(false);
      }, isMatch ? 450 : 850);
    }
  };

  return (
    <div>
      <Instruction
        text={lang === 'HI' ? 'मिलते हुए जोड़े ढूंढो' : 'Find the matching pairs'}
        lang={lang}
      />
      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
        {cards.map((c, i) => {
          const faceUp = c.flipped || c.matched;
          return (
            <button
              key={c.id}
              onClick={() => tap(i)}
              disabled={faceUp || lock}
              className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-200 ${
                c.matched
                  ? 'bg-success/20 ring-2 ring-success'
                  : faceUp
                  ? 'bg-card card-elevated'
                  : 'bg-accent active:scale-95'
              }`}
              aria-label={faceUp ? 'card face up' : 'card face down'}
            >
              <span aria-hidden="true">{faceUp ? c.emoji : ''}</span>
            </button>
          );
        })}
      </div>
      {done && <DonePanel lang={lang} onAgain={() => setRound((r) => r + 1)} />}
    </div>
  );
}

// ─── ACTIVITY 4: PATTERN POP (concentration + working memory) ───────────────────
function PatternPop({ lang, onComplete }) {
  const PADS = [
    { id: 0, on: 'bg-accent', off: 'bg-accent/30' },
    { id: 1, on: 'bg-warm', off: 'bg-warm/30' },
    { id: 2, on: 'bg-success', off: 'bg-success/30' },
    { id: 3, on: 'bg-calm', off: 'bg-calm/30' },
  ];
  const MAX_LEVEL = 5;

  const [seq, setSeq] = useState([]);
  const [phase, setPhase] = useState('idle'); // idle | watch | input | win
  const [active, setActive] = useState(null);
  const [inputIdx, setInputIdx] = useState(0);
  const [level, setLevel] = useState(0);
  const timerRef = useRef(null);

  const start = () => {
    setSeq([Math.floor(Math.random() * 4)]);
    setLevel(1);
    setInputIdx(0);
    setPhase('watch');
  };

  // Play the sequence when in 'watch' phase
  useEffect(() => {
    if (phase !== 'watch') return;
    let i = 0;
    const playNext = () => {
      setActive(seq[i]);
      timerRef.current = setTimeout(() => {
        setActive(null);
        i++;
        if (i < seq.length) timerRef.current = setTimeout(playNext, 350);
        else {
          setInputIdx(0);
          setPhase('input');
        }
      }, 600);
    };
    timerRef.current = setTimeout(playNext, 600);
    return () => clearTimeout(timerRef.current);
  }, [phase, seq]);

  const tapPad = (id) => {
    if (phase !== 'input') return;
    setActive(id);
    setTimeout(() => setActive(null), 200);
    if (id === seq[inputIdx]) {
      const ni = inputIdx + 1;
      if (ni === seq.length) {
        if (seq.length >= MAX_LEVEL) {
          setPhase('win');
          celebrate();
          onComplete && onComplete();
        } else {
          const next = [...seq, Math.floor(Math.random() * 4)];
          setTimeout(() => {
            setSeq(next);
            setLevel((l) => l + 1);
            setPhase('watch');
          }, 600);
        }
      } else {
        setInputIdx(ni);
      }
    } else {
      // wrong tap: gentle, just replay the same sequence, no penalty
      setTimeout(() => {
        setInputIdx(0);
        setPhase('watch');
      }, 600);
    }
  };

  const instruction =
    phase === 'watch'
      ? lang === 'HI' ? 'रोशनी का क्रम देखो' : 'Watch the light pattern'
      : phase === 'input'
      ? lang === 'HI' ? 'अब वही क्रम दोहराओ' : 'Now repeat the pattern'
      : '';

  return (
    <div>
      {phase === 'idle' ? (
        <div className="text-center py-8">
          <Zap className="w-12 h-12 text-warm mx-auto mb-3" />
          <p className="text-muted text-sm mb-5">
            {lang === 'HI'
              ? 'रोशनी का क्रम देखो, फिर उसे दोहराओ। हर बार क्रम थोड़ा लंबा होगा।'
              : 'Watch the pattern of lights, then tap them in the same order. It gets one longer each time.'}
          </p>
          <button onClick={start} className="btn-primary inline-flex items-center gap-2">
            {lang === 'HI' ? 'शुरू करो' : 'Start'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {instruction && <Instruction text={instruction} lang={lang} />}
          {phase !== 'win' && (
            <p className="text-center text-muted text-sm mb-4">
              {lang === 'HI' ? `स्तर ${level}` : `Level ${level}`}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 max-w-[260px] mx-auto">
            {PADS.map((pad) => (
              <button
                key={pad.id}
                onClick={() => tapPad(pad.id)}
                disabled={phase !== 'input'}
                className={`aspect-square rounded-2xl transition-all duration-150 ${
                  active === pad.id ? `${pad.on} scale-105 shadow-lg` : pad.off
                } ${phase === 'input' ? 'active:scale-95 cursor-pointer' : ''}`}
                aria-label={`pad ${pad.id + 1}`}
              />
            ))}
          </div>
          {phase === 'win' && <DonePanel lang={lang} onAgain={start} />}
        </>
      )}
    </div>
  );
}

// ─── MAIN: FOCUS ZONE HUB ───────────────────────────────────────────────────────
const FocusZone = () => {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const t = (en, hi) => (lang === 'HI' ? hi : en);

  const [view, setView] = useState('hub'); // hub | symbol | tracking | memory | pattern
  const [companionState, setCompanionState] = useState('idle');

  // Award focus points into shared state (merges safely; no App.jsx change needed).
  const handleComplete = () => {
    setCompanionState('happy');
    updateState({ focusPoints: (appState.focusPoints || 0) + 10 });
    setTimeout(() => setCompanionState('idle'), 1500);
  };

  const ACTIVITIES = [
    {
      id: 'symbol',
      icon: Search,
      title: t('Symbol Search', 'चिह्न खोज'),
      desc: t('Find all the hidden symbols', 'सारे छिपे चिह्न ढूंढो'),
      area: t('Attention', 'ध्यान'),
      color: 'text-accent',
      bg: 'bg-accent/10',
      border: 'border-accent',
    },
    {
      id: 'tracking',
      icon: Eye,
      title: t('Follow the Star', 'तारा देखो'),
      desc: t('Track the cup with the star', 'तारे वाले कप पर नज़र रखो'),
      area: t('Visual tracking', 'दृश्य ट्रैकिंग'),
      color: 'text-calm',
      bg: 'bg-calm/10',
      border: 'border-calm',
    },
    {
      id: 'memory',
      icon: Brain,
      title: t('Memory Match', 'याददाश्त मिलान'),
      desc: t('Find the matching pairs', 'मिलते जोड़े ढूंढो'),
      area: t('Memory', 'याददाश्त'),
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success',
    },
    {
      id: 'pattern',
      icon: Zap,
      title: t('Pattern Pop', 'क्रम याद करो'),
      desc: t('Repeat the light pattern', 'रोशनी का क्रम दोहराओ'),
      area: t('Concentration', 'एकाग्रता'),
      color: 'text-warm',
      bg: 'bg-warm/10',
      border: 'border-warm',
    },
  ];

  const renderActivity = () => {
    switch (view) {
      case 'symbol':
        return <SymbolSearch key="symbol" lang={lang} onComplete={handleComplete} />;
      case 'tracking':
        return <VisualTracking key="tracking" lang={lang} onComplete={handleComplete} />;
      case 'memory':
        return <MemoryMatch key="memory" lang={lang} onComplete={handleComplete} />;
      case 'pattern':
        return <PatternPop key="pattern" lang={lang} onComplete={handleComplete} />;
      default:
        return null;
    }
  };

  const active = ACTIVITIES.find((a) => a.id === view);

  return (
    <Layout
      title={t('Focus Zone', 'फोकस ज़ोन')}
      showBack
      showCompanion
      pageContext="In the Focus Zone doing a short attention or memory warm-up"
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      <div className="max-w-md mx-auto px-4 py-6 pb-28">
        {view === 'hub' ? (
          <>
            {/* Intro */}
            <div className="mb-6 animate-fadeIn">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-6 h-6 text-warm" />
                <h1 className="text-2xl font-bold text-primary">
                  {t('Focus Zone', 'फोकस ज़ोन')}
                </h1>
              </div>
              <p className="text-muted text-sm">
                {t(
                  'Short games to warm up your attention and memory. No timers, no scores. Just play.',
                  'ध्यान और याददाश्त के छोटे खेल। कोई समय-सीमा नहीं, कोई अंक नहीं। बस खेलो।'
                )}
              </p>
            </div>

            {/* Focus points (gentle, effort-based) */}
            <div className="mb-6 bg-gradient-to-r from-calm/10 to-accent/10 rounded-2xl p-4 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-calm flex-shrink-0" />
              <div>
                <p className="text-primary font-semibold">
                  {appState.focusPoints || 0} {t('focus points', 'फोकस अंक')}
                </p>
                <p className="text-muted text-sm">
                  {t('You earn 10 every time you finish a game.', 'हर खेल पूरा करने पर 10 अंक मिलते हैं।')}
                </p>
              </div>
            </div>

            {/* Activity cards */}
            <div className="space-y-3">
              {ACTIVITIES.map((a, idx) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.id}
                    onClick={() => setView(a.id)}
                    className={`w-full text-left card-elevated p-4 border-l-4 ${a.border} animate-slideUp flex items-center gap-3 hover:shadow-md`}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    aria-label={`Open ${a.title}`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                      <Icon className={`w-6 h-6 ${a.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-primary text-base leading-tight">{a.title}</h3>
                      <p className="text-muted text-sm mt-0.5">{a.desc}</p>
                      <span className={`text-xs font-medium ${a.color} mt-1 inline-block`}>{a.area}</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Activity header with back-to-hub */}
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => setView('hub')}
                className="w-10 h-10 rounded-xl bg-card card-elevated flex items-center justify-center"
                aria-label={t('Back to activities', 'गतिविधियों पर वापस')}
              >
                <ArrowLeft className="w-5 h-5 text-primary" />
              </button>
              <h2 className="text-xl font-bold text-primary">{active?.title}</h2>
            </div>

            <div className="card-elevated p-4 animate-fadeIn">{renderActivity()}</div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default FocusZone;
