// src/pages/TeacherObservation.jsx
// Route: /teacher/observe/:id  (teacher portal)
//
// PRIORITY 1, teacher half. In a government-school setting parents are usually not
// available to answer a questionnaire, so the class teacher completes the OBSERVATION
// part of the screening. It becomes available once the student has finished their own
// games (screeningStatus === 'awaiting_observation').
//
// The teacher's observations are combined with the student's cognitive results using a
// CONFIRM-BEFORE-FLAG rule: an area is only shown as "higher support" when BOTH the
// student's games AND the teacher's observation point the same way. A single signal is
// shown as "some support — worth confirming". The result (a support profile + tier +
// plain-language tendencies) is shown ONLY here, to the teacher. The student is never
// labelled and never shown any of this.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, CheckCircle2, Save, Info, AlertTriangle, Loader2,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { SUPPORT_AREAS, TIER_LABELS, DEMO_STUDENTS } from '../data';
import { getStudentById, updateStudentProgress, saveScreeningResults } from '../firebase';

// ─── OBSERVATION ITEMS (teacher-rated; map to support areas) ─────────────────
const OBS_ITEMS = [
  { id:'r1', domain:'reading',      EN:'Struggles to read words at class level',           HI:'कक्षा-स्तर के शब्द पढ़ने में कठिनाई' },
  { id:'r2', domain:'reading',      EN:'Avoids or finds reading aloud hard',                HI:'ज़ोर से पढ़ने से बचता/कठिनाई' },
  { id:'w1', domain:'writing',      EN:'Writing is hard to read or very slow',              HI:'लिखावट पढ़ने में कठिन या बहुत धीमी' },
  { id:'w2', domain:'writing',      EN:'Reverses or muddles letters when writing',          HI:'लिखते समय अक्षर उलट/गड्डमड्ड करता' },
  { id:'n1', domain:'numeracy',     EN:'Finds class-level number work hard',                HI:'कक्षा-स्तर का गणित कठिन लगता' },
  { id:'n2', domain:'numeracy',     EN:'Loses track when counting or calculating',          HI:'गिनती/गणना में बीच में भटक जाता' },
  { id:'a1', domain:'attention',    EN:'Hard to stay focused on a task',                    HI:'किसी काम पर ध्यान बनाए रखना कठिन' },
  { id:'a2', domain:'attention',    EN:'Acts before thinking or blurts out',                HI:'सोचे बिना कर देता या बीच में बोल देता' },
  { id:'m1', domain:'memory',       EN:'Forgets instructions soon after hearing them',      HI:'निर्देश सुनते ही जल्दी भूल जाता' },
  { id:'m2', domain:'memory',       EN:'Struggles to remember a sequence of steps',         HI:'कदमों का क्रम याद रखने में कठिनाई' },
  { id:'o1', domain:'organisation', EN:'Loses or forgets books and materials',              HI:'किताबें/सामान खो देता या भूल जाता' },
  { id:'o2', domain:'organisation', EN:'Struggles to start or finish multi-step tasks',     HI:'कई-कदम वाले काम शुरू/पूरा करने में कठिनाई' },
];

// Context flags — treated as "confirm, not label", never added to a deficit score.
const CONTEXT_ITEMS = [
  { id:'c_lang', EN:'Speaks a different language at home than the class language', HI:'घर पर कक्षा से अलग भाषा बोलता है' },
  { id:'c_print', EN:'Little access to books or print at home',                    HI:'घर पर किताबों/छपी सामग्री तक कम पहुँच' },
  { id:'c_attend', EN:'Attendance has been irregular',                            HI:'उपस्थिति अनियमित रही है' },
];

const SCALE = [
  { v:0, EN:'Not at all', HI:'बिल्कुल नहीं' },
  { v:1, EN:'Sometimes',  HI:'कभी-कभी' },
  { v:2, EN:'Often',      HI:'अक्सर' },
];

const AREAS = ['reading','writing','numeracy','attention','memory','organisation'];
const TYPICAL = 0.35, HIGH = 0.6;

const areaLabel = (id, lang) => { const a = SUPPORT_AREAS.find(x=>x.id===id); return a ? (lang==='HI'?a.labelHI:a.labelEN) : id; };
const levelFromConcern = (c) => (c==null ? null : (c>HIGH ? 'high' : (c>TYPICAL ? 'some' : 'low')));
const levelToConcern = (lvl) => (lvl==='high'?0.8 : lvl==='some'?0.45 : lvl==='low'?0.15 : null);
const isElevated = (lvl) => (lvl==='some' || lvl==='high');

function levelPill(level, lang){
  const map = {
    low:  { cls:'bg-success/10 text-success', EN:'On track',         HI:'ठीक' },
    some: { cls:'bg-warm/10 text-warm',       EN:'Some support',      HI:'कुछ सहायता' },
    high: { cls:'bg-red-50 text-red-600',     EN:'Higher support',    HI:'अधिक सहायता' },
    none: { cls:'bg-gray-100 text-muted',     EN:'Needs more data',   HI:'और जानकारी चाहिए' },
  };
  const m = map[level] || map.none;
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${m.cls}`}>{lang==='HI'?m.HI:m.EN}</span>;
}

const TeacherObservation = () => {
  const { appState, updateState } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const lang = appState.language || 'EN';

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});   // itemId -> 0|1|2
  const [context, setContext] = useState({});   // contextId -> bool
  const [result, setResult] = useState(null);   // computed final tendencies
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(()=>{
    let alive = true;
    (async ()=>{
      let s = null;
      try { s = await getStudentById(id); } catch(e) { s = null; }
      if (!s) s = DEMO_STUDENTS.find(x=>x.id===id) || null;
      if (alive){ setStudent(s); setLoading(false); }
    })();
    return ()=>{ alive=false; };
  }, [id]);

  // cognitive concern per area, from the student's saved screening
  const cognitiveConcerns = () => {
    const fromResults = student && student.screeningResults && student.screeningResults.concerns;
    if (fromResults) return fromResults;
    // derive from a saved supportProfile if concerns are not stored
    const prof = student && student.supportProfile;
    if (!prof) return {};
    const out = {}; AREAS.forEach(a=>{ if (prof[a]) out[a] = levelToConcern(prof[a]); });
    return out;
  };

  const setAns = (itemId, v) => setAnswers(prev=>({ ...prev, [itemId]: v }));

  const compute = () => {
    const cog = cognitiveConcerns();
    // observation concern per area = mean of that area's item scores / 2
    const obs = {};
    AREAS.forEach(a=>{
      const items = OBS_ITEMS.filter(it=>it.domain===a);
      const vals = items.map(it=>answers[it.id]).filter(v=>v!=null);
      obs[a] = vals.length ? (vals.reduce((s,x)=>s+x,0)/vals.length)/2 : null;
    });
    const finalProfile = {};
    AREAS.forEach(a=>{
      const cogLvl = levelFromConcern(cog[a]);
      const obsLvl = levelFromConcern(obs[a]);
      const cogElev = isElevated(cogLvl);
      const obsElev = isElevated(obsLvl);
      if (cogLvl==null && obsLvl==null){ finalProfile[a] = 'none'; return; }
      if (cogElev && obsElev) finalProfile[a] = (cogLvl==='high' || obsLvl==='high') ? 'high' : 'some'; // confirmed
      else if (cogElev || obsElev) finalProfile[a] = 'some'; // single signal -> confirm
      else finalProfile[a] = 'low';
    });
    const highs = Object.values(finalProfile).filter(v=>v==='high').length;
    const tier = highs>=2 ? 3 : (highs>=1 ? 2 : 1);
    const contextFlags = CONTEXT_ITEMS.filter(c=>context[c.id]).map(c=> lang==='HI'?c.HI:c.EN);
    return { finalProfile, tier, cogConcerns:cog, obsConcerns:obs, contextFlags };
  };

  const onCompute = () => { setResult(compute()); setSaved(false); window.scrollTo(0,0); };

  const onSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await updateStudentProgress(id, {
        supportProfile: result.finalProfile,
        tier: result.tier,
        screeningStatus: 'complete',
        teacherObservation: { answers, context, completedBy: appState.teacherName || 'Teacher' },
      });
      await saveScreeningResults(id, {
        source: 'combined',
        supportProfile: result.finalProfile,
        tier: result.tier,
        cognitive: result.cogConcerns,
        observation: result.obsConcerns,
        contextFlags: result.contextFlags,
      }, { observationAnswers: answers, context });
      setSaved(true);
    } catch(e) { /* offline-safe */ setSaved(true); }
    setSaving(false);
  };

  const allAnswered = OBS_ITEMS.every(it=>answers[it.id]!=null);
  const cognitiveDone = !!(student && (student.supportProfile || (student.screeningResults)));

  return (
    <Layout
      title={lang==='HI'?'अवलोकन':'Observation'}
      showBack
      isTeacherPage
      lang={lang}
      setLanguage={(l)=>updateState({ language:l })}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
        <button onClick={()=>navigate('/teacher')} className="flex items-center gap-2 text-sm text-muted mb-4 hover:text-primary">
          <ArrowLeft className="w-4 h-4" /> {lang==='HI'?'डैशबोर्ड पर वापस':'Back to dashboard'}
        </button>

        {loading ? (
          <div className="card-elevated p-8 text-center text-muted"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : !student ? (
          <div className="card-elevated p-6 text-center text-muted">{lang==='HI'?'छात्र नहीं मिला।':'Student not found.'}</div>
        ) : (
          <>
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-accent" />
                <h1 className="text-2xl font-bold text-primary">{student.name}</h1>
              </div>
              <p className="text-muted text-sm">
                {lang==='HI'?`कक्षा ${student.class||''} · शिक्षक अवलोकन`:`Class ${student.class||''} · Teacher observation`}
              </p>
            </div>

            {!cognitiveDone && (
              <div className="card-elevated p-4 mb-5 border-l-4 border-warm flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-warm flex-shrink-0 mt-0.5" />
                <p className="text-sm text-primary">
                  {lang==='HI'
                    ? 'इस छात्र ने अभी अपने खेल पूरे नहीं किए हैं। आप अभी अवलोकन भर सकते हैं, पर पूरा परिणाम तब बनेगा जब छात्र अपना हिस्सा पूरा करेगा।'
                    : 'This student has not finished their games yet. You can still fill the observation now, but the full result needs the student\'s part too.'}
                </p>
              </div>
            )}

            {/* RESULT (teacher-only tendencies) */}
            {result && (
              <div className="card-elevated p-5 mb-6 animate-fadeIn">
                <h2 className="text-lg font-bold text-primary mb-1">{lang==='HI'?'झलक: संभावित प्रवृत्तियाँ':'Snapshot: likely tendencies'}</h2>
                <p className="text-xs text-muted mb-3">{lang==='HI'? (TIER_LABELS[result.tier]?.HI) : (TIER_LABELS[result.tier]?.EN)}</p>
                {AREAS.map(a=>(
                  <div key={a} className="flex items-center gap-2 py-2 border-b border-gray-100">
                    <span className="flex-1 text-primary font-medium">{areaLabel(a, lang)}</span>
                    {levelPill(result.finalProfile[a], lang)}
                  </div>
                ))}

                {(() => {
                  const mc = (student && (student.motorConcern != null ? student.motorConcern
                    : (student.screeningResults && student.screeningResults.motorConcern))) ;
                  const motorFlag = (mc != null && mc > 0.35)
                    || result.finalProfile.writing === 'some' || result.finalProfile.writing === 'high';
                  if (!motorFlag) return null;
                  return (
                    <div className="mt-4 bg-warm/5 border-l-4 border-warm rounded-lg p-3">
                      <p className="text-sm font-semibold text-primary mb-1">
                        {lang==='HI' ? 'हाथ से करने वाली सहायता (कक्षा में)' : 'Hands-on support (in class)'}
                      </p>
                      <p className="text-xs text-primary">
                        {lang==='HI'
                          ? 'लिखावट/सूक्ष्म-गति की कठिनाई के संकेत हैं। यह स्क्रीन पर ठीक नहीं हो सकती — इसके लिए कक्षा में हाथ से अभ्यास चाहिए। रोज़ थोड़ा करें: रेत/स्लेट पर अक्षर बनाना, मिट्टी/आटे से हाथ की ताकत, पेंसिल पकड़ का अभ्यास, बिंदु-जोड़ो और भूल-भुलैया, और खड़ी सतह पर लिखना। चूँकि स्क्रीन-ट्रेसिंग केवल मोटा संकेत है, निष्कर्ष से पहले बच्चे को कुछ अक्षर हाथ से लिखते हुए देखकर पुष्टि करें।'
                          : 'There are signs of a handwriting / fine-motor difficulty. This cannot be fixed on a screen — it needs hands-on practice in class. Try short daily activities: forming letters in sand or on a slate, playdough or clay for hand strength, pencil-grip practice, dot-to-dot and mazes, and writing on a vertical surface. Because screen tracing is only a rough signal, confirm with a quick hands-on check (watch the child copy a few letters) before concluding.'}
                      </p>
                    </div>
                  );
                })()}

                {result.contextFlags.length>0 && (
                  <div className="mt-4 bg-accent/5 border-l-4 border-accent rounded-lg p-3 flex items-start gap-2">
                    <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-primary">
                      <strong>{lang==='HI'?'संदर्भ (पुष्टि करें, लेबल नहीं): ':'Context (confirm, do not label): '}</strong>
                      {result.contextFlags.join('; ')}. {lang==='HI'?'कम छपाई-अनुभव या भिन्न घरेलू भाषा को पहले सहायता-ज़रूरत मानें, कमी नहीं।':'Treat limited print exposure or a different home language as a support need to confirm, not a deficit.'}
                    </p>
                  </div>
                )}
                <div className="mt-4 bg-warm/5 border-l-4 border-warm rounded-lg p-3">
                  <p className="text-xs text-primary">
                    {lang==='HI'
                      ? 'यह स्क्रीनिंग है, निदान नहीं। किसी क्षेत्र को "अधिक सहायता" तभी दिखाया गया है जब छात्र के खेल और आपके अवलोकन दोनों एक ही ओर इशारा करते हैं। छात्र को कभी कोई लेबल या परिणाम नहीं दिखाया जाता।'
                      : 'This is a screen, not a diagnosis. An area is shown as "higher support" only when the student\'s games and your observation agree. The student is never shown any label or result.'}
                  </p>
                </div>
                <button onClick={onSave} disabled={saving}
                  className="btn-primary mt-4 inline-flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
                  {saved ? (lang==='HI'?'सहेजा गया':'Saved') : (lang==='HI'?'परिणाम सहेजें':'Save to student record')}
                </button>
              </div>
            )}

            {/* OBSERVATION FORM */}
            <div className="card-elevated p-5 mb-5">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide mb-1">{lang==='HI'?'कक्षा में आप क्या देखते हैं':'What you see in class'}</h2>
              <p className="text-xs text-muted mb-4">{lang==='HI'?'हर पंक्ति के लिए चुनें कि यह कितनी बार होता है।':'For each row, choose how often you see this.'}</p>
              {OBS_ITEMS.map(it=>(
                <div key={it.id} className="py-3 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-primary mb-2">{lang==='HI'?it.HI:it.EN}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {SCALE.map(sc=>(
                      <button key={sc.v} onClick={()=>setAns(it.id, sc.v)}
                        className={`rounded-lg border-2 py-2 text-sm font-medium transition-all ${answers[it.id]===sc.v ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 text-muted'}`}>
                        {lang==='HI'?sc.HI:sc.EN}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* CONTEXT */}
            <div className="card-elevated p-5 mb-6">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide mb-1">{lang==='HI'?'संदर्भ':'Context'}</h2>
              <p className="text-xs text-muted mb-3">{lang==='HI'?'ये कमियाँ नहीं हैं — ये बताते हैं कि किसे पहले पुष्टि करनी है।':'These are not deficits — they tell us what to confirm first.'}</p>
              {CONTEXT_ITEMS.map(c=>(
                <label key={c.id} className="flex items-center gap-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={!!context[c.id]} onChange={e=>setContext(prev=>({ ...prev, [c.id]: e.target.checked }))}
                    className="w-5 h-5 accent-accent" />
                  <span className="text-sm text-primary">{lang==='HI'?c.HI:c.EN}</span>
                </label>
              ))}
            </div>

            <button onClick={onCompute} disabled={!allAnswered}
              className={`w-full py-3 rounded-xl font-semibold min-h-[52px] ${allAnswered ? 'bg-accent text-white' : 'bg-gray-200 text-muted'}`}>
              {allAnswered ? (lang==='HI'?'प्रवृत्तियाँ देखें':'See tendencies') : (lang==='HI'?'सभी पंक्तियाँ भरें':'Answer every row first')}
            </button>
          </>
        )}
      </div>
    </Layout>
  );
};

export default TeacherObservation;
