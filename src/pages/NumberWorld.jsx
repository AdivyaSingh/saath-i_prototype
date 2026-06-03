// src/pages/NumberWorld.jsx
// Route: /number-world
// Dyscalculia activity - object-first maths with addition and comparison tabs.
// No timers, no scores, emotionally safe design.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeftRight, Heart, RefreshCw, Check, ChevronRight,
  Loader2, Sparkles, Calculator, Home, Award
} from 'lucide-react';
import { useApp } from '../App';
import Layout from '../components/Layout';
import { MATH_ACTIVITIES, STRINGS } from '../data';
import { generateMathActivity } from '../gemini';
import { updateStudentProgress } from '../firebase';

// ── Filter activities by type ────────────────────────────────────────────────
const ADDITION_ACTIVITIES = MATH_ACTIVITIES.filter((a) => a.type === 'addition');
const COMPARISON_ACTIVITY = MATH_ACTIVITIES.find((a) => a.type === 'comparison');

// ── Object colors for styled dots/circles ────────────────────────────────────
const OBJECT_COLORS = [
  'bg-warm', 'bg-accent', 'bg-success', 'bg-calm',
  'bg-primary', 'bg-warm', 'bg-accent', 'bg-success',
];

// Generate countable objects array [{id, counted}]
const makeObjects = (count, side) =>
  Array.from({ length: count }, (_, i) => ({ id: `${side}_${i}`, counted: false }));

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

        {/* ── Activity header ────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-warm/10 flex items-center justify-center flex-shrink-0">
            <Calculator className="w-6 h-6 text-warm" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">{S.numberWorld}</h1>
            <p className="text-muted text-sm">
              {lang === 'HI' ? 'पहले देखो, फिर गिनो!' : 'See first, then count!'}
            </p>
          </div>
        </div>

        {/* ── Pill-style tabs ─────────────────────────────────────── */}
        <div className="flex gap-2 mb-5 bg-surface p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('addition')}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm min-h-[48px] transition-all flex items-center justify-center gap-2 ${
              activeTab === 'addition'
                ? 'bg-warm text-white shadow-sm'
                : 'bg-transparent text-muted hover:bg-card'
            }`}
            aria-label="Addition activity tab"
          >
            <Plus className="w-4 h-4" />
            {lang === 'HI' ? 'जोड़ना' : 'Addition'}
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm min-h-[48px] transition-all flex items-center justify-center gap-2 ${
              activeTab === 'comparison'
                ? 'bg-warm text-white shadow-sm'
                : 'bg-transparent text-muted hover:bg-card'
            }`}
            aria-label="Comparison activity tab"
          >
            <ArrowLeftRight className="w-4 h-4" />
            {lang === 'HI' ? 'तुलना' : 'Comparison'}
          </button>
        </div>

        {/* ── Activity area ─────────────────────────────────────── */}
        {activeTab === 'addition' ? (
          <AdditionActivity
            lang={lang}
            S={S}
            companion={appState.companion}
            setCompanionState={setCompanionState}
            classLevel={appState.studentClass || 4}
          />
        ) : (
          <ComparisonActivity
            lang={lang}
            S={S}
            setCompanionState={setCompanionState}
            appState={appState}
            updateState={updateState}
          />
        )}

        {/* ── Number Town ──────────────────────────────────────── */}
        <NumberTown lang={lang} />

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
    </Layout>
  );
}

// ─── Addition Activity ──────────────────────────────────────────────────────
const AdditionActivity = ({ lang, S, companion, setCompanionState, classLevel }) => {
  // Activity selection
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [generatedActivity, setGeneratedActivity] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Current activity data
  const currentActivity = generatedActivity || ADDITION_ACTIVITIES[selectedIdx] || ADDITION_ACTIVITIES[0];
  const total = currentActivity.leftCount + currentActivity.rightCount;

  // Phase state
  const [phase, setPhase] = useState(1); // 1=objects appear, 2=counting, 3=equation
  const [leftObjects, setLeftObjects] = useState(makeObjects(currentActivity.leftCount, 'L'));
  const [rightObjects, setRightObjects] = useState(makeObjects(currentActivity.rightCount, 'R'));
  const [counter, setCounter] = useState(0);
  const [shakingId, setShakingId] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [equationVisible, setEquationVisible] = useState(false);

  // Animate objects in
  const [leftVisible, setLeftVisible] = useState(false);
  const [rightVisible, setRightVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeftVisible(true), 300);
    const t2 = setTimeout(() => setRightVisible(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [selectedIdx, generatedActivity]);

  // Show equation with fade-in delay
  useEffect(() => {
    if (phase === 3) {
      const t = setTimeout(() => setEquationVisible(true), 300);
      return () => clearTimeout(t);
    }
    setEquationVisible(false);
  }, [phase]);

  const resetActivity = useCallback(() => {
    setPhase(1);
    setLeftObjects(makeObjects(currentActivity.leftCount, 'L'));
    setRightObjects(makeObjects(currentActivity.rightCount, 'R'));
    setCounter(0);
    setCelebrate(false);
    setLeftVisible(false);
    setRightVisible(false);
    setEquationVisible(false);
    setTimeout(() => {
      setLeftVisible(true);
      setTimeout(() => setRightVisible(true), 600);
    }, 100);
  }, [currentActivity]);

  // Reset when switching activity
  useEffect(() => {
    setLeftObjects(makeObjects(currentActivity.leftCount, 'L'));
    setRightObjects(makeObjects(currentActivity.rightCount, 'R'));
    setPhase(1);
    setCounter(0);
    setCelebrate(false);
    setEquationVisible(false);
  }, [currentActivity]);

  const handleObjectTap = (obj, side) => {
    if (obj.counted) {
      setShakingId(obj.id);
      setTimeout(() => setShakingId(null), 600);
      return;
    }

    const update = (arr) => arr.map((a) => a.id === obj.id ? { ...a, counted: true } : a);
    if (side === 'L') setLeftObjects((prev) => update(prev));
    else setRightObjects((prev) => update(prev));

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

  // Generate new problem with AI
  const handleGenerateNew = async () => {
    setGenerating(true);
    const result = await generateMathActivity(classLevel, 'addition');
    setGenerating(false);
    if (result) {
      setGeneratedActivity(result);
      setShowPicker(false);
    }
  };

  // Select a static activity
  const handleSelectActivity = (idx) => {
    setSelectedIdx(idx);
    setGeneratedActivity(null);
    setShowPicker(false);
  };

  return (
    <div className="bg-card rounded-2xl p-5 mb-5 border border-gray-100 shadow-sm">
      {/* Activity header with picker toggle */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-primary">
          {lang === 'HI' && currentActivity.titleHI ? currentActivity.titleHI : currentActivity.title}
        </h2>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-accent underline underline-offset-2 hover:text-primary transition-colors"
          aria-label="Choose different activity"
        >
          {lang === 'HI' ? 'बदलें' : 'Change'}
        </button>
      </div>

      {/* Activity picker dropdown */}
      {showPicker && (
        <div className="bg-surface rounded-xl p-3 mb-4 border border-gray-100 animate-slideUp">
          <div className="space-y-2 mb-3">
            {ADDITION_ACTIVITIES.map((act, idx) => (
              <button
                key={act.id}
                onClick={() => handleSelectActivity(idx)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium min-h-[48px] transition-colors flex items-center gap-3 ${
                  selectedIdx === idx && !generatedActivity
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'bg-card text-primary border border-gray-100 hover:border-accent/30'
                }`}
                aria-label={`Select ${act.title}`}
              >
                <div className="w-8 h-8 rounded-lg bg-warm/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{act.objectEmoji}</span>
                </div>
                <div>
                  <span>{lang === 'HI' && act.titleHI ? act.titleHI : act.title}</span>
                  <p className="text-xs text-muted">
                    {act.leftCount} + {act.rightCount} = {act.answer}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerateNew}
            disabled={generating}
            className="w-full bg-gradient-to-r from-accent to-primary text-white py-2.5 rounded-xl font-semibold text-sm min-h-[48px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            aria-label="Generate new math problem"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {lang === 'HI' ? 'बना रहे हैं...' : 'Creating...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {lang === 'HI' ? 'AI से नई समस्या बनाएं' : 'Generate New Problem'}
              </>
            )}
          </button>
        </div>
      )}

      <p className="text-muted text-sm mb-4">
        {phase === 1
          ? (lang === 'HI' ? 'देखो! वस्तुएं आ रही हैं...' : 'Look! Objects are appearing...')
          : phase === 2
          ? (lang === 'HI' ? 'हर वस्तु को टैप करके गिनो!' : 'Tap each object to count them!')
          : (lang === 'HI' ? 'तुमने खुद गिन कर समझा!' : 'You discovered it yourself!')}
      </p>

      {/* Objects display */}
      <div className="flex gap-6 justify-center items-center mb-4">
        {/* Left group */}
        <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${
          leftVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
        }`}>
          <div className="flex flex-wrap gap-2 max-w-[130px] justify-center">
            {leftObjects.map((obj, i) => (
              <ObjectButton
                key={obj.id}
                obj={obj}
                colorIdx={i}
                onTap={() => phase === 2 && handleObjectTap(obj, 'L')}
                shaking={shakingId === obj.id}
                phase={phase}
                emoji={currentActivity.objectEmoji}
              />
            ))}
          </div>
          <span className="text-sm text-primary font-medium">
            {lang === 'HI'
              ? `${currentActivity.leftCount} ${currentActivity.objectHI || currentActivity.object}`
              : `${currentActivity.leftCount} ${currentActivity.object}`}
          </span>
        </div>

        {/* Plus divider */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-warm/10 flex items-center justify-center">
            <Plus className="w-5 h-5 text-warm" />
          </div>
        </div>

        {/* Right group */}
        <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${
          rightVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
        }`}>
          <div className="flex flex-wrap gap-2 max-w-[130px] justify-center">
            {rightObjects.map((obj, i) => (
              <ObjectButton
                key={obj.id}
                obj={obj}
                colorIdx={i + currentActivity.leftCount}
                onTap={() => phase === 2 && handleObjectTap(obj, 'R')}
                shaking={shakingId === obj.id}
                phase={phase}
                emoji={currentActivity.objectEmoji}
              />
            ))}
          </div>
          <span className="text-sm text-primary font-medium">
            {lang === 'HI'
              ? `${currentActivity.rightCount} और ${currentActivity.objectHI || currentActivity.object}`
              : `${currentActivity.rightCount} more ${currentActivity.object}`}
          </span>
        </div>
      </div>

      {/* Phase 2 - live counter */}
      {phase === 2 && (
        <div className="text-center mb-3">
          <p className="text-muted text-sm mb-1">
            {lang === 'HI' ? 'गिनती:' : 'Count:'}
          </p>
          <p className="text-5xl font-bold text-primary">{counter}</p>
          {celebrate && (
            <div className="mt-2 animate-slideUp">
              <p className="text-success font-bold text-lg flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                {lang === 'HI'
                  ? `${total} ${currentActivity.objectHI || currentActivity.object} मिलाकर!`
                  : `${total} ${currentActivity.object} altogether!`}
              </p>
            </div>
          )}
          {counter > 0 && counter < total && (
            <p className="text-accent text-sm mt-1">
              {lang === 'HI' ? `${total - counter} और बाकी हैं` : `${total - counter} more to go`}
            </p>
          )}
        </div>
      )}

      {/* Phase 3 - equation reveal */}
      {phase === 3 && (
        <div className={`text-center transition-opacity duration-500 ${equationVisible ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-muted text-sm mb-2">
            {lang === 'HI' ? 'देखो! अब यह समझ में आया:' : 'Look! Now it makes sense:'}
          </p>
          <p className="text-5xl font-bold text-primary tracking-wide">
            {currentActivity.equation}
          </p>
          <p className="text-success font-semibold mt-3 text-base flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            {lang === 'HI' ? 'तुमने खुद गिन कर समझा!' : 'You discovered it yourself!'}
          </p>
        </div>
      )}

      {/* Phase 1 CTA */}
      {phase === 1 && (
        <button
          onClick={() => setPhase(2)}
          className="w-full bg-warm text-white py-3 rounded-xl font-semibold min-h-[48px] mt-2 hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
          aria-label="Start counting"
        >
          <ChevronRight className="w-5 h-5" />
          {lang === 'HI'
            ? `${currentActivity.objectHI || currentActivity.object} गिनना शुरू करें!`
            : `Start counting ${currentActivity.object}!`}
        </button>
      )}

      {/* Phase 3 - reset */}
      {phase === 3 && (
        <button
          onClick={resetActivity}
          className="w-full border-2 border-accent text-accent py-3 rounded-xl font-semibold min-h-[48px] mt-4 hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
          aria-label="Try again"
        >
          <RefreshCw className="w-4 h-4" />
          {lang === 'HI' ? 'फिर खेलें' : 'Try again'}
        </button>
      )}

      {/* Already counted hint - gentle shake feedback */}
      {shakingId && (
        <p className="text-warm text-sm text-center mt-2 font-medium animate-slideUp">
          {lang === 'HI' ? 'इसे तो तुमने पहले ही गिन लिया!' : 'You already counted that one!'}
        </p>
      )}
    </div>
  );
};

// ─── Styled Object Button ───────────────────────────────────────────────────
const ObjectButton = ({ obj, colorIdx, onTap, shaking, phase, emoji }) => {
  const colorClass = OBJECT_COLORS[colorIdx % OBJECT_COLORS.length];

  return (
    <button
      onClick={onTap}
      disabled={obj.counted || phase !== 2}
      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 min-h-[44px] border-2 ${
        obj.counted
          ? 'bg-success/10 border-success/30 scale-90'
          : phase === 2
          ? `${colorClass}/10 border-${colorClass === 'bg-warm' ? 'warm' : 'gray'}-200 hover:scale-110 cursor-pointer active:scale-95`
          : `${colorClass}/10 border-gray-100 cursor-default`
      } ${shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
      aria-label={obj.counted ? 'Already counted' : 'Tap to count'}
      style={{
        animation: shaking ? 'shake 0.5s ease-in-out' : undefined,
      }}
    >
      {obj.counted ? (
        <Check className="w-5 h-5 text-success" />
      ) : (
        <span className="text-xl">{emoji}</span>
      )}
    </button>
  );
};

// ─── Comparison Activity ────────────────────────────────────────────────────
const ComparisonActivity = ({ lang, S, setCompanionState }) => {
  const rounds = COMPARISON_ACTIVITY?.rounds || [
    { left: 3, right: 7, objectEmoji: '🍊' },
    { left: 8, right: 5, objectEmoji: '🍋' },
    { left: 5, right: 6, objectEmoji: '🫐' },
  ];

  const [roundIdx, setRoundIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [allDone, setAllDone] = useState(false);

  const round = rounds[roundIdx];
  const correctSide = round.left > round.right ? 'left' : 'right';

  const handlePick = (side) => {
    if (chosen) return;
    setChosen(side);
    const correct = side === correctSide;
    setCompanionState(correct ? 'happy' : 'encouraging');
    setTimeout(async () => {
      setCompanionState('idle');
      if (roundIdx < rounds.length - 1) {
        setRoundIdx((r) => r + 1);
        setChosen(null);
      } else {
        setAllDone(true);
        // Track completion in app state and Firebase
        if (!appState.activitiesCompleted?.maths) {
          const newCompleted = {
            ...appState.activitiesCompleted,
            maths: (appState.activitiesCompleted?.maths || 0) + 1
          };
          updateState({ activitiesCompleted: newCompleted });
          
          if (appState.firebaseStudentId) {
            await updateStudentProgress(appState.firebaseStudentId, {
              lastActivity: 'Number World',
              activitiesCompleted: newCompleted
            });
          }
        }
      }
    }, 1400);
  };

  if (allDone) {
    return (
      <div className="bg-card rounded-2xl p-5 mb-5 border border-gray-100 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-3">
          <Award className="w-7 h-7 text-success" />
        </div>
        <h2 className="text-xl font-bold text-primary mb-2">
          {lang === 'HI' ? 'सभी राउंड पूरे!' : 'All rounds complete!'}
        </h2>
        <p className="text-success font-semibold mb-4 flex items-center justify-center gap-2">
          <Check className="w-5 h-5" />
          {lang === 'HI' ? 'तुम तुलना करने में बहुत अच्छे हो!' : 'You are great at comparing!'}
        </p>
        <button
          onClick={() => { setRoundIdx(0); setChosen(null); setAllDone(false); }}
          className="border-2 border-accent text-accent px-6 py-2 rounded-xl font-semibold min-h-[48px] hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2 mx-auto"
          aria-label="Play again"
        >
          <RefreshCw className="w-4 h-4" />
          {lang === 'HI' ? 'फिर खेलें' : 'Play again'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-5 mb-5 border border-gray-100 shadow-sm">
      <h2 className="text-lg font-bold text-primary mb-1">
        {lang === 'HI' && COMPARISON_ACTIVITY?.titleHI
          ? COMPARISON_ACTIVITY.titleHI
          : COMPARISON_ACTIVITY?.title || 'Which group has more?'}
      </h2>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-muted text-sm">
          {lang === 'HI' ? `राउंड ${roundIdx + 1} / ${rounds.length}` : `Round ${roundIdx + 1} of ${rounds.length}`}
        </p>
        {/* Progress dots */}
        <div className="flex gap-1 ml-auto">
          {rounds.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < roundIdx ? 'bg-success' : i === roundIdx ? 'bg-accent' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
      <p className="text-primary text-base mb-4">
        {lang === 'HI' ? 'कौन सा ढेर ज़्यादा है? उस पर टैप करो!' : 'Which pile has more? Tap the bigger pile!'}
      </p>

      <div className="flex gap-4 justify-center items-end mb-4">
        <PileButton
          count={round.left}
          side="left"
          chosen={chosen}
          correct={correctSide}
          onPick={handlePick}
          lang={lang}
        />
        <div className="text-muted text-2xl font-bold pb-6">vs</div>
        <PileButton
          count={round.right}
          side="right"
          chosen={chosen}
          correct={correctSide}
          onPick={handlePick}
          lang={lang}
        />
      </div>

      {chosen && (
        <p className={`text-center font-semibold text-base flex items-center justify-center gap-2 ${
          chosen === correctSide ? 'text-success' : 'text-warm'
        }`}>
          {chosen === correctSide ? (
            <>
              <Check className="w-5 h-5" />
              {lang === 'HI' ? 'बिल्कुल सही!' : 'Correct!'}
            </>
          ) : (
            <>{lang === 'HI' ? 'अच्छी कोशिश! यह वाला ज़्यादा था।' : 'Good try! The other pile had more.'}</>
          )}
        </p>
      )}
    </div>
  );
};

// ─── Pile Button (styled dots instead of raw emoji) ──────────────────────────
const PileButton = ({ count, side, chosen, correct, onPick, lang }) => {
  const isChosen = chosen === side;
  const isCorrect = correct === side;
  const revealed = chosen && isCorrect;

  let cls = 'border-gray-200 bg-card hover:border-accent hover:bg-accent/5';
  if (isChosen && isCorrect) cls = 'border-success bg-success/5';
  if (isChosen && !isCorrect) cls = 'border-warm bg-warm/5';
  if (revealed && !isChosen) cls = 'border-success bg-success/5 opacity-80';

  // Use styled dots for visual representation
  const dotColors = ['bg-accent', 'bg-warm', 'bg-success', 'bg-calm', 'bg-primary'];

  return (
    <button
      onClick={() => onPick(side)}
      disabled={!!chosen}
      className={`flex flex-col items-center gap-2 border-2 rounded-2xl p-4 min-w-[120px] min-h-[100px] transition-all ${cls} ${
        !chosen ? 'cursor-pointer' : 'cursor-default'
      }`}
      aria-label={`Pile with ${count} items`}
    >
      <div className="flex flex-wrap gap-1.5 max-w-[100px] justify-center">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full ${dotColors[i % dotColors.length]} shadow-sm transition-transform`}
          />
        ))}
      </div>
      <span className="text-xs text-muted font-medium mt-1">{count}</span>
    </button>
  );
};

// ─── Number Town ─────────────────────────────────────────────────────────────
const NumberTown = ({ lang }) => {
  const concepts = [
    {
      label: lang === 'HI' ? 'एक अंक जोड़' : 'Single-digit Add',
      done: true,
      gradient: 'from-success to-success/80',
    },
    {
      label: lang === 'HI' ? 'तुलना' : 'Comparison',
      done: true,
      gradient: 'from-accent to-accent/80',
    },
    {
      label: lang === 'HI' ? 'दो अंक जोड़' : 'Double-digit Add',
      done: false,
      gradient: 'from-warm to-warm/80',
    },
  ];

  return (
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      <h3 className="text-primary font-semibold text-base mb-3 flex items-center gap-2">
        <Home className="w-4 h-4 text-accent" />
        {lang === 'HI' ? 'तुम्हारा नंबर टाउन बढ़ रहा है!' : 'Your Number Town is growing!'}
      </h3>
      <div className="flex gap-3 items-end justify-center">
        {concepts.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            {/* Building box - solid gradient if done, outline if in-progress */}
            <div
              className={`w-16 h-20 rounded-xl flex items-center justify-center transition-all ${
                c.done
                  ? `bg-gradient-to-b ${c.gradient} shadow-sm`
                  : 'border-2 border-dashed border-gray-300 bg-surface'
              }`}
            >
              {c.done ? (
                <Check className="w-6 h-6 text-white" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
            </div>
            <span className={`text-xs font-medium text-center max-w-[70px] leading-tight ${
              c.done ? 'text-primary' : 'text-muted'
            }`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

{/* Inline CSS for shake animation */}
const ShakeStyle = () => (
  <style>{`
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-3px); }
      80% { transform: translateX(3px); }
    }
  `}</style>
);
