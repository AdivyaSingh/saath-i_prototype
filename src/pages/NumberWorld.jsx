// src/pages/NumberWorld.jsx
// Route: /number-world
// Dyscalculia activity — object-first maths, no timers.
// Module 4 will build this page fully.
// Placeholder: unblocks routing.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { MATH_ACTIVITIES, STRINGS } from '../data';

const ADDITION = MATH_ACTIVITIES[0];
const COMPARISON = MATH_ACTIVITIES[1];

// Generate apple array [{id, counted}]
function makeApples(count, side) {
  return Array.from({ length: count }, (_, i) => ({ id: `${side}_${i}`, counted: false }));
}

export default function NumberWorld() {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';
  const S = STRINGS[lang] || STRINGS.EN;

  const [activeTab, setActiveTab] = useState('addition');
  const [companionState, setCompanionState] = useState('idle');

  return (
    <Layout
      title={S.numberWorld}
      showBack
      showCompanion
      companionState={companionState}
      lang={lang}
      setLanguage={(l) => updateState({ language: l })}
      companion={appState.companion}
      streak={appState.streakDays}
    >
      <div className="max-w-md mx-auto px-4 py-4 pb-24">

        {/* ── Activity title ─────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-warm/10 flex items-center justify-center text-2xl flex-shrink-0">
            🔢
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">{S.numberWorld}</h1>
            <p className="text-muted text-sm">
              {lang === 'HI' ? 'पहले देखो, फिर गिनो!' : 'See first, then count!'}
            </p>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setActiveTab('addition')}
            className={`flex-1 py-2 rounded-xl font-semibold text-sm min-h-[48px] transition-colors border ${
              activeTab === 'addition'
                ? 'bg-warm text-white border-warm shadow-sm'
                : 'bg-card text-muted border-gray-200 hover:bg-surface'
            }`}
          >
            {lang === 'HI' ? '🍎 जोड़ना' : '🍎 Adding'}
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 py-2 rounded-xl font-semibold text-sm min-h-[48px] transition-colors border ${
              activeTab === 'comparison'
                ? 'bg-warm text-white border-warm shadow-sm'
                : 'bg-card text-muted border-gray-200 hover:bg-surface'
            }`}
          >
            {lang === 'HI' ? '🍊 कौन ज़्यादा?' : '🍊 Which is More?'}
          </button>
        </div>

        {/* ── Activity area ─────────────────────────────────────── */}
        {activeTab === 'addition' ? (
          <AdditionActivity lang={lang} S={S} companion={appState.companion} setCompanionState={setCompanionState} />
        ) : (
          <ComparisonActivity lang={lang} S={S} setCompanionState={setCompanionState} />
        )}

        {/* ── Number Town ───────────────────────────────────────── */}
        <NumberTown lang={lang} />

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
    </Layout>
  );
}

// ─── Addition Activity ──────────────────────────────────────────────────────
function AdditionActivity({ lang, S, companion, setCompanionState }) {
  const total = ADDITION.leftCount + ADDITION.rightCount;
  const [phase, setPhase] = useState(1); // 1=objects, 2=counting, 3=equation
  const [leftApples, setLeftApples] = useState(makeApples(ADDITION.leftCount, 'L'));
  const [rightApples, setRightApples] = useState(makeApples(ADDITION.rightCount, 'R'));
  const [counter, setCounter] = useState(0);
  const [shakingId, setShakingId] = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  // Animate in left + right apples after a short delay
  const [leftVisible, setLeftVisible] = useState(false);
  const [rightVisible, setRightVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeftVisible(true), 300);
    const t2 = setTimeout(() => setRightVisible(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleAppleTap = (apple, side) => {
    const alreadyCounted = apple.counted;
    if (alreadyCounted) {
      setShakingId(apple.id);
      setTimeout(() => setShakingId(null), 600);
      return;
    }

    const update = (arr) => arr.map((a) => a.id === apple.id ? { ...a, counted: true } : a);

    if (side === 'L') setLeftApples((prev) => update(prev));
    else setRightApples((prev) => update(prev));

    const newCount = counter + 1;
    setCounter(newCount);

    if (newCount === total) {
      setCelebrate(true);
      setCompanionState('happy');
      setTimeout(() => {
        setPhase(3);
        setCompanionState('idle');
      }, 1800);
    }
  };

  const handleStartCounting = () => setPhase(2);

  const handleReset = () => {
    setPhase(1);
    setLeftApples(makeApples(ADDITION.leftCount, 'L'));
    setRightApples(makeApples(ADDITION.rightCount, 'R'));
    setCounter(0);
    setCelebrate(false);
    setLeftVisible(false);
    setRightVisible(false);
    setTimeout(() => { setLeftVisible(true); setTimeout(() => setRightVisible(true), 600); }, 100);
  };

  return (
    <div className="bg-orange-50 rounded-2xl p-5 mb-5 border border-orange-100">
      <h2 className="text-lg font-bold text-primary mb-1">
        {lang === 'HI' ? ADDITION.titleHI : ADDITION.title}
      </h2>
      <p className="text-muted text-sm mb-4">
        {lang === 'HI' ? 'हर सेब को टैप करके गिनो!' : 'Tap each apple to count them! 👆'}
      </p>

      {/* Apples display */}
      <div className="flex gap-4 justify-center items-end mb-4 flex-wrap">
        {/* Left pile */}
        <div
          className={`flex flex-col items-center gap-2 transition-all duration-500 ${leftVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
        >
          <div className="flex flex-wrap gap-1.5 max-w-[120px] justify-center">
            {leftApples.map((apple) => (
              <AppleButton
                key={apple.id}
                apple={apple}
                onTap={() => phase === 2 && handleAppleTap(apple, 'L')}
                shaking={shakingId === apple.id}
                emoji={ADDITION.emoji}
                phase={phase}
              />
            ))}
          </div>
          <span className="text-sm text-primary font-medium">
            {lang === 'HI' ? `${ADDITION.leftCount} ${ADDITION.descriptionHI}` : `${ADDITION.leftCount} ${ADDITION.description}`}
          </span>
        </div>

        {/* Plus sign — phase 3 only */}
        {phase === 3 && (
          <span className="text-4xl font-bold text-primary pb-6">+</span>
        )}

        {/* Right pile */}
        <div
          className={`flex flex-col items-center gap-2 transition-all duration-500 ${rightVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
        >
          <div className="flex flex-wrap gap-1.5 max-w-[140px] justify-center">
            {rightApples.map((apple) => (
              <AppleButton
                key={apple.id}
                apple={apple}
                onTap={() => phase === 2 && handleAppleTap(apple, 'R')}
                shaking={shakingId === apple.id}
                emoji={ADDITION.emoji}
                phase={phase}
              />
            ))}
          </div>
          <span className="text-sm text-primary font-medium">
            {lang === 'HI' ? `${ADDITION.rightCount} और ${ADDITION.descriptionHI}` : `${ADDITION.rightCount} more ${ADDITION.description}`}
          </span>
        </div>
      </div>

      {/* Phase 2 — counter */}
      {phase === 2 && (
        <div className="text-center mb-3">
          <p className="text-muted text-sm mb-1">
            {lang === 'HI' ? 'गिनती:' : 'Count:'}
          </p>
          <p className="text-5xl font-bold text-primary">{counter}</p>
          {celebrate && (
            <p className="text-success font-bold text-lg mt-2 animate-bounce">
              {lang === 'HI' ? `${total} सेब मिलाकर! 🎉` : `${total} apples altogether! 🎉`}
            </p>
          )}
          {counter > 0 && counter < total && (
            <p className="text-accent text-sm mt-1">
              {lang === 'HI' ? `${total - counter} और बाकी हैं` : `${total - counter} more to go`}
            </p>
          )}
        </div>
      )}

      {/* Phase 3 — equation reveal */}
      {phase === 3 && (
        <div className="text-center animate-fade-in">
          <p className="text-muted text-sm mb-2">
            {lang === 'HI' ? 'देखो! अब यह समझ में आया:' : 'Look! Now it makes sense:'}
          </p>
          <p className="text-5xl font-bold text-primary tracking-wide">
            {ADDITION.equation}
          </p>
          <p className="text-success font-semibold mt-2 text-base">
            {lang === 'HI' ? '🌟 तुमने खुद गिन कर समझा!' : '🌟 You discovered it yourself!'}
          </p>
        </div>
      )}

      {/* Phase 1 CTA */}
      {phase === 1 && (
        <button
          onClick={handleStartCounting}
          className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] mt-2 hover:bg-orange-600 transition-colors shadow-sm"
        >
          {lang === 'HI' ? '👆 सेब गिनना शुरू करें!' : '👆 Start counting apples!'}
        </button>
      )}

      {/* Reset */}
      {phase === 3 && (
        <button
          onClick={handleReset}
          className="w-full border-2 border-accent text-accent py-3 rounded-xl font-semibold min-h-[48px] mt-4 hover:bg-accent hover:text-white transition-all"
        >
          {lang === 'HI' ? '🔄 फिर खेलें' : '🔄 Try again'}
        </button>
      )}

      {/* Already-counted hint */}
      {shakingId && (
        <p className="text-warm text-sm text-center mt-2 font-medium">
          {lang === 'HI' ? '😊 इसे तो तुमने पहले ही गिन लिया!' : '😊 You already counted that one!'}
        </p>
      )}
    </div>
  );
}

// ─── Apple button ───────────────────────────────────────────────────────────
function AppleButton({ apple, onTap, shaking, emoji, phase }) {
  return (
    <button
      onClick={onTap}
      disabled={apple.counted || phase !== 2}
      className={`w-11 h-11 text-2xl flex items-center justify-center rounded-lg transition-all min-h-[44px]
        ${apple.counted ? 'opacity-40' : phase === 2 ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}
        ${shaking ? 'animate-bounce' : ''}
      `}
      aria-label={apple.counted ? 'Already counted' : 'Tap to count'}
    >
      {apple.counted ? '✅' : emoji}
    </button>
  );
}

// ─── Comparison Activity ────────────────────────────────────────────────────
function ComparisonActivity({ lang, setCompanionState }) {
  const rounds = [
    { left: 3, right: 7, correct: 'right' },
    { left: 6, right: 8, correct: 'right' },
    { left: 5, right: 6, correct: 'right' },
  ];
  const [roundIdx, setRoundIdx] = useState(0);
  const [chosen, setChosen] = useState(null); // 'left' | 'right'
  const [allDone, setAllDone] = useState(false);

  const round = rounds[roundIdx];

  const handlePick = (side) => {
    if (chosen) return;
    setChosen(side);
    const correct = side === round.correct;
    setCompanionState(correct ? 'happy' : 'encouraging');
    setTimeout(() => {
      setCompanionState('idle');
      if (roundIdx < rounds.length - 1) {
        setRoundIdx((r) => r + 1);
        setChosen(null);
      } else {
        setAllDone(true);
      }
    }, 1400);
  };

  if (allDone) {
    return (
      <div className="bg-orange-50 rounded-2xl p-5 mb-5 border border-orange-100 text-center">
        <div className="text-4xl mb-2">🎊</div>
        <h2 className="text-xl font-bold text-primary mb-2">
          {lang === 'HI' ? 'सभी राउंड पूरे!' : 'All rounds complete!'}
        </h2>
        <p className="text-success font-semibold mb-4">
          {lang === 'HI' ? '🌟 तुम तुलना करने में बहुत अच्छे हो!' : '🌟 You are great at comparing!'}
        </p>
        <button
          onClick={() => { setRoundIdx(0); setChosen(null); setAllDone(false); }}
          className="border-2 border-accent text-accent px-6 py-2 rounded-xl font-semibold min-h-[48px] hover:bg-accent hover:text-white transition-all"
        >
          {lang === 'HI' ? '🔄 फिर खेलें' : '🔄 Play again'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-orange-50 rounded-2xl p-5 mb-5 border border-orange-100">
      <h2 className="text-lg font-bold text-primary mb-1">
        {lang === 'HI' ? COMPARISON.titleHI : COMPARISON.title}
      </h2>
      <p className="text-muted text-sm mb-1">
        {lang === 'HI' ? `राउंड ${roundIdx + 1} / ${rounds.length}` : `Round ${roundIdx + 1} of ${rounds.length}`}
      </p>
      <p className="text-primary text-base mb-4">
        {lang === 'HI' ? 'कौन सा ढेर ज़्यादा है? उस पर टैप करो! 👆' : 'Which pile has more? Tap the bigger pile! 👆'}
      </p>

      <div className="flex gap-4 justify-center items-end mb-4">
        {/* Left pile */}
        <PileButton
          count={round.left}
          emoji={COMPARISON.emoji}
          side="left"
          chosen={chosen}
          correct={round.correct}
          onPick={handlePick}
        />
        {/* Right pile */}
        <PileButton
          count={round.right}
          emoji={COMPARISON.emoji}
          side="right"
          chosen={chosen}
          correct={round.correct}
          onPick={handlePick}
        />
      </div>

      {chosen && (
        <p className={`text-center font-semibold text-base ${chosen === round.correct ? 'text-success' : 'text-warm'}`}>
          {chosen === round.correct
            ? (lang === 'HI' ? '🌟 बिल्कुल सही!' : '🌟 Correct!')
            : (lang === 'HI' ? '👍 अच्छी कोशिश! यह वाला ज़्यादा था।' : '👍 Good try! The other pile had more.')}
        </p>
      )}
    </div>
  );
}

function PileButton({ count, emoji, side, chosen, correct, onPick }) {
  const isChosen = chosen === side;
  const isCorrect = correct === side;
  const revealed = chosen && isCorrect;

  let cls = 'border-gray-200 bg-card hover:border-accent hover:bg-blue-50';
  if (isChosen && isCorrect) cls = 'border-success bg-green-50';
  if (isChosen && !isCorrect) cls = 'border-warm bg-orange-50';
  if (revealed && !isChosen) cls = 'border-success bg-green-50 opacity-80';

  return (
    <button
      onClick={() => onPick(side)}
      disabled={!!chosen}
      className={`flex flex-col items-center gap-2 border-2 rounded-2xl p-4 min-w-[120px] min-h-[48px] transition-all ${cls} ${!chosen ? 'cursor-pointer' : 'cursor-default'}`}
      aria-label={`Pile with ${count} items`}
    >
      <div className="flex flex-wrap gap-1 max-w-[100px] justify-center">
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="text-xl leading-none">{emoji}</span>
        ))}
      </div>
    </button>
  );
}

// ─── Number Town ─────────────────────────────────────────────────────────────
function NumberTown({ lang }) {
  const buildings = [
    { emoji: '🏠', label: lang === 'HI' ? 'एक अंक जोड़' : 'Single-digit Add', done: true },
    { emoji: '🏪', label: lang === 'HI' ? 'तुलना' : 'Comparison', done: true },
    { emoji: '🏗️', label: lang === 'HI' ? 'दो अंक जोड़' : 'Double-digit Add', done: false },
  ];
  return (
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      <h3 className="text-primary font-semibold text-base mb-3">
        {lang === 'HI' ? '🏘️ तुम्हारा नंबर टाउन बढ़ रहा है!' : '🏘️ Your Number Town is growing!'}
      </h3>
      <div className="flex gap-4 items-end justify-center">
        {buildings.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={`text-4xl transition-all ${b.done ? '' : 'opacity-50 grayscale'}`}>{b.emoji}</span>
            <span className={`text-xs font-medium text-center max-w-[70px] leading-tight ${b.done ? 'text-success' : 'text-muted'}`}>
              {b.label}
            </span>
            {b.done && <span className="text-success text-xs">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
