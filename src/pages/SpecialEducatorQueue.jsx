// src/pages/SpecialEducatorQueue.jsx
// Route: /teacher/queue
//
// PRIORITY 6 — Special Educator Referral Workflow (specialist-facing half).
//
// This is the hackathon-MVP version of "a special educator reviews escalated
// cases". There is no real scheduling, video call, or separate login system —
// just a queue of students a teacher has referred, with a simple review flow:
//   Review Case → Add Notes → Add Recommendations → Mark Review Complete
//
// Design choices that keep this demo-friendly and honest:
//  - No diagnosis anywhere. Support areas + tier only.
//  - The AI never appears here. A referral only exists because a teacher
//    submitted one from TeacherDashboard.jsx.
//  - Recommendations are picked from a small set of practical, support-based
//    templates (data.js: RECOMMENDATION_TEMPLATES) plus a free-text note.
//  - On "Mark Review Complete", the recommendations are written into the
//    EXISTING `specialistNotes` field on the student record (same shape the
//    app already uses: {date, author, note}). IEPGenerator.jsx and
//    gemini.js's generateIEP() already read this field — so completed
//    referrals flow into IEP generation with zero changes to either file.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, User, CheckCircle2, Loader2, Stethoscope,
  Calendar, ChevronDown, ChevronUp,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import {
  DEMO_STUDENTS, SUPPORT_AREAS, TIER_LABELS, REFERRAL_STATUS_LABELS,
  RECOMMENDATION_TEMPLATES, MOCK_SPECIAL_EDUCATORS,
} from '../data';
import { subscribeToStudents, saveStudentToFirebase } from '../firebase';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const supportAreaBadgeClass = {
  reading:      'badge badge-reading',
  writing:      'badge badge-writing',
  numeracy:     'badge badge-numeracy',
  attention:    'badge badge-attention',
  memory:       'badge badge-memory',
  organisation: 'badge badge-organisation',
};

const tierBadgeClass = { 1: 'badge badge-tier-1', 2: 'badge badge-tier-2', 3: 'badge badge-tier-3' };

const supportAreaLabel = (areaId, language) => {
  const area = SUPPORT_AREAS.find((a) => a.id === areaId);
  if (!area) return areaId;
  return language === 'HI' ? area.labelHI : area.labelEN;
};

const tierShortLabel = (tier, language) => (language === 'HI' ? `स्तर ${tier || 1}` : `Tier ${tier || 1}`);

const referralStatusPillClass = {
  none:         'bg-gray-100 text-gray-500',
  recommended:  'bg-warm/10 text-warm',
  submitted:    'bg-accent/10 text-accent',
  under_review: 'bg-amber-100 text-amber-700',
  complete:     'bg-green-100 text-green-700',
};

const ReferralStatusPill = ({ status, language }) => {
  const s = status || 'none';
  const label = REFERRAL_STATUS_LABELS[s] || REFERRAL_STATUS_LABELS.none;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${referralStatusPillClass[s]}`}>
      {language === 'HI' ? label.HI : label.EN}
    </span>
  );
};

// "Why was referral suggested?" — explainable, data-grounded reasons. Built
// from the data already on the record, never invented.
const explainReferral = (student, language) => {
  const reasons = [];
  const profile = student.supportProfile || {};
  Object.entries(profile).forEach(([area, level]) => {
    if (level === 'high') {
      reasons.push(
        language === 'HI'
          ? `${supportAreaLabel(area, 'HI')} में उच्च आवश्यकता`
          : `High ${supportAreaLabel(area, 'EN')} need`
      );
    }
  });
  if (student.teacherReferralReason) {
    reasons.push(language === 'HI' ? 'शिक्षक की चिंता दर्ज की गई' : 'Teacher concern raised');
  }
  if ((student.progressHistory || []).length >= 2) {
    const hist = student.progressHistory;
    const last = hist[hist.length - 1];
    const first = hist[0];
    if (last <= first) {
      reasons.push(language === 'HI' ? 'हस्तक्षेप के बाद सीमित प्रगति' : 'Limited progress after intervention');
    }
  }
  if (reasons.length === 0) {
    reasons.push(language === 'HI' ? 'शिक्षक द्वारा मैन्युअल रूप से रेफर किया गया' : 'Manually referred by teacher');
  }
  return reasons;
};

// ─── REVIEW PANEL (per referral) ──────────────────────────────────────────────
function ReviewPanel({ student, language, reviewerName, onSaved }) {
  const [open, setOpen] = useState(student.referralStatus !== 'complete');
  const [notes, setNotes] = useState(student.specialEducatorNotes || '');
  const [selectedRecs, setSelectedRecs] = useState(student.specialEducatorRecommendations || []);
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);

  const toggleRec = (label) => {
    setSelectedRecs((prev) =>
      prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label]
    );
  };

  const startReview = async () => {
    setOpen(true);
    if (student.referralStatus === 'submitted') {
      await saveStudentToFirebase({ id: student.id, referralStatus: 'under_review' });
    }
  };

  const markComplete = async () => {
    if (selectedRecs.length === 0 && !notes.trim()) return; // require at least something useful
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const existingSpecialistNotes = student.specialistNotes || [];
    const newEntries = [
      ...(notes.trim()
        ? [{ date: today, author: reviewerName, note: notes.trim() }]
        : []),
      ...selectedRecs.map((rec) => ({
        date: today,
        author: reviewerName,
        note: (language === 'HI' ? 'सुझाव: ' : 'Recommendation: ') + rec,
      })),
    ];
    try {
      await saveStudentToFirebase({
        id: student.id,
        referralStatus: 'complete',
        reviewCompleted: true,
        reviewDate: today,
        specialEducatorReviewer: reviewerName,
        specialEducatorNotes: notes.trim(),
        specialEducatorRecommendations: selectedRecs,
        // Reuse the EXISTING field IEPGenerator.jsx / gemini.js already read —
        // this is what makes "Teacher sees recommendations → Generate IEP" work
        // with no changes to either of those files.
        specialistNotes: [...existingSpecialistNotes, ...newEntries],
      });
      setSavedJustNow(true);
      onSaved && onSaved();
    } catch (e) {
      console.error('[SpecialEducatorQueue] save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const recsByArea = useMemo(() => {
    const grouped = {};
    RECOMMENDATION_TEMPLATES.forEach((r) => {
      grouped[r.area] = grouped[r.area] || [];
      grouped[r.area].push(r);
    });
    return grouped;
  }, []);

  const isComplete = student.referralStatus === 'complete';

  return (
    <div className="border-t border-gray-100 mt-3 pt-3">
      <button
        onClick={() => (open ? setOpen(false) : startReview())}
        className="flex items-center gap-1.5 text-sm font-semibold text-accent"
      >
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {isComplete
          ? (language === 'HI' ? 'समीक्षा देखें' : 'View review')
          : (language === 'HI' ? 'मामले की समीक्षा करें' : 'Review Case')}
      </button>

      {open && (
        <div className="mt-3 space-y-4 animate-fadeIn">
          <div>
            <label className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5 block">
              {language === 'HI' ? 'विशेषज्ञ टिप्पणी जोड़ें' : 'Add Notes'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isComplete}
              rows={3}
              placeholder={language === 'HI' ? 'अपनी टिप्पणी यहाँ लिखें...' : 'Write your observations here...'}
              className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:border-accent focus:outline-none resize-none disabled:bg-gray-50 disabled:text-muted"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5 block">
              {language === 'HI' ? 'सुझाव जोड़ें' : 'Add Recommendations'}
            </label>
            <div className="space-y-3">
              {Object.entries(recsByArea).map(([area, recs]) => (
                <div key={area}>
                  {area !== 'general' && (
                    <p className="text-xs font-semibold text-muted mb-1">{supportAreaLabel(area, language)}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {recs.map((rec) => {
                      const label = language === 'HI' ? rec.HI : rec.EN;
                      const checked = selectedRecs.includes(label);
                      return (
                        <button
                          key={rec.id}
                          disabled={isComplete}
                          onClick={() => toggleRec(label)}
                          className={`text-xs font-medium px-3 py-2 rounded-lg border-2 transition-all disabled:opacity-70 ${
                            checked ? 'bg-accent text-white border-accent' : 'bg-surface text-primary border-gray-200 hover:border-accent/40'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isComplete ? (
            <button
              onClick={markComplete}
              disabled={saving || (selectedRecs.length === 0 && !notes.trim())}
              className="w-full bg-accent text-white font-semibold py-3 rounded-xl min-h-[48px] disabled:opacity-40 hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {language === 'HI' ? 'समीक्षा पूर्ण करें' : 'Mark Review Complete'}
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700">
                {language === 'HI'
                  ? `समीक्षा पूर्ण — ${student.specialEducatorReviewer || reviewerName} द्वारा (${student.reviewDate || ''})`
                  : `Review complete — by ${student.specialEducatorReviewer || reviewerName} (${student.reviewDate || ''})`}
              </p>
            </div>
          )}
          {savedJustNow && (
            <p className="text-xs text-muted text-center">
              {language === 'HI'
                ? 'ये सुझाव अब "विशेषज्ञ टिप्पणियाँ" में सहेजे गए हैं और IEP बनाते समय शामिल होंगे।'
                : 'These are now saved under "Specialist Notes" and will be included when an IEP is generated.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── REFERRAL CARD ────────────────────────────────────────────────────────────
function ReferralCard({ student, language, reviewerName, onSaved }) {
  return (
    <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="font-bold text-primary">{student.name}</h3>
            <p className="text-xs text-muted">
              {language === 'HI' ? `कक्षा ${student.class}` : `Class ${student.class}`}
            </p>
          </div>
        </div>
        <ReferralStatusPill status={student.referralStatus} language={language} />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className={supportAreaBadgeClass[student.primarySupportArea] || 'badge'}>
          {supportAreaLabel(student.primarySupportArea, language)}
        </span>
        <span className={tierBadgeClass[student.tier] || 'badge'}>{tierShortLabel(student.tier, language)}</span>
        {student.referralDate && (
          <span className="text-xs text-muted flex items-center gap-1">
            <Calendar size={12} /> {student.referralDate}
          </span>
        )}
      </div>

      {/* Why was referral suggested? — explainable reasons */}
      <div className="bg-surface rounded-xl p-3 mb-3">
        <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
          {language === 'HI' ? 'रेफरल क्यों सुझाया गया?' : 'Why was referral suggested?'}
        </p>
        <ul className="space-y-1">
          {explainReferral(student, language).map((reason, i) => (
            <li key={i} className="text-xs text-primary flex items-start gap-1.5">
              <span className="text-accent mt-0.5">•</span>{reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Teacher's reason + notes */}
      {(student.teacherReferralReason || student.teacherNotes) && (
        <div className="bg-accent/5 border border-accent/10 rounded-xl p-3 mb-1">
          <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">
            {language === 'HI' ? 'शिक्षक की टिप्पणी' : 'Teacher Notes'}
          </p>
          {student.teacherReferralReason && (
            <p className="text-sm text-primary mb-1">{student.teacherReferralReason}</p>
          )}
          {student.teacherNotes && (
            <p className="text-xs text-muted italic">{student.teacherNotes}</p>
          )}
          {student.referredBy && (
            <p className="text-xs text-muted mt-1">
              — {student.referredBy}
            </p>
          )}
        </div>
      )}

      <ReviewPanel student={student} language={language} reviewerName={reviewerName} onSaved={onSaved} />
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SpecialEducatorQueue() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const language = appState.language === 'HI' ? 'HI' : 'EN';

  const [firebaseStudents, setFirebaseStudents] = useState([]);
  const [tab, setTab] = useState('pending'); // 'pending' | 'complete'
  const [reviewerName, setReviewerName] = useState(MOCK_SPECIAL_EDUCATORS[0].name);

  useEffect(() => {
    const unsub = subscribeToStudents(setFirebaseStudents);
    return unsub;
  }, []);

  const allStudents = useMemo(() => {
    const demoIds = new Set(DEMO_STUDENTS.map((s) => s.id));
    const uniqueFirebase = firebaseStudents.filter((s) => !demoIds.has(s.id));
    return [...DEMO_STUDENTS, ...uniqueFirebase];
  }, [firebaseStudents]);

  const referrals = allStudents.filter((s) =>
    ['submitted', 'under_review', 'complete'].includes(s.referralStatus)
  );
  const pending = referrals.filter((s) => s.referralStatus !== 'complete');
  const completed = referrals.filter((s) => s.referralStatus === 'complete');
  const visible = tab === 'pending' ? pending : completed;

  // Redirect non-teachers back to the teacher login (this queue lives behind
  // the same teacher-portal login — no separate specialist auth for the demo).
  useEffect(() => {
    if (!appState.teacherLoggedIn) navigate('/teacher');
  }, [appState.teacherLoggedIn, navigate]);

  return (
    <Layout title="" showNav={false} showCompanion={false} isTeacherPage lang={language} setLanguage={(l) => updateState({ language: l })}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/teacher')}
          className="flex items-center gap-2 text-sm text-muted mb-4 hover:text-primary"
        >
          <ArrowLeft size={16} /> {language === 'HI' ? 'डैशबोर्ड पर वापस' : 'Back to dashboard'}
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Stethoscope size={24} className="text-accent" />
          <h1 className="text-2xl font-bold text-primary">
            {language === 'HI' ? 'विशेष शिक्षक कतार' : 'Special Educator Queue'}
          </h1>
        </div>
        <p className="text-sm text-muted mb-5">
          {language === 'HI'
            ? 'केवल वे छात्र जिन्हें किसी शिक्षक ने रेफर किया है। AI कभी सीधे रेफर नहीं करता — शिक्षक ही अंतिम निर्णय लेता है।'
            : 'Only students a teacher has referred appear here. The AI never refers a student directly — the teacher always makes that call.'}
        </p>

        {/* Mock "reviewing as" — demo realism only, no real auth */}
        <div className="bg-card border border-gray-100 rounded-xl p-3 mb-5 flex items-center gap-3 flex-wrap">
          <label className="text-xs font-semibold text-muted">
            {language === 'HI' ? 'समीक्षक के रूप में:' : 'Reviewing as:'}
          </label>
          <select
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            className="text-sm font-semibold text-primary border border-gray-200 rounded-lg px-3 py-1.5 focus:border-accent focus:outline-none"
          >
            {MOCK_SPECIAL_EDUCATORS.map((se) => (
              <option key={se.id} value={se.name}>{se.name}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { id: 'pending', label: language === 'HI' ? `लंबित (${pending.length})` : `Pending (${pending.length})` },
            { id: 'complete', label: language === 'HI' ? `पूर्ण (${completed.length})` : `Completed (${completed.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-card text-muted border-gray-200 hover:border-accent/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Referral list */}
        <div className="space-y-4">
          {visible.length === 0 && (
            <div className="text-center py-14">
              <ClipboardList size={32} className="text-muted mx-auto mb-3 opacity-50" />
              <p className="text-muted text-sm">
                {tab === 'pending'
                  ? (language === 'HI' ? 'अभी कोई लंबित रेफरल नहीं है।' : 'No pending referrals right now.')
                  : (language === 'HI' ? 'अभी कोई पूर्ण समीक्षा नहीं है।' : 'No completed reviews yet.')}
              </p>
            </div>
          )}
          {visible.map((student) => (
            <ReferralCard
              key={student.id}
              student={student}
              language={language}
              reviewerName={reviewerName}
              onSaved={() => {}}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
}
