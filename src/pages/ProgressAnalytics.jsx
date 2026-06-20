// src/pages/ProgressAnalytics.jsx
// Route: /teacher/analytics
// Class-level progress analytics for teachers. Uses the local class roster
// (DEMO_STUDENTS), so it works fully offline with no AI. Charts are drawn with
// plain SVG and CSS — no chart library, so no package.json change is needed.
//
// Honest data note: each student's progressHistory is a weekly tracked score whose
// direction is not a reliable signal on its own, so the "needs attention" and
// "improving" judgements here come from the student's status (set on the dashboard)
// and their error-pattern trends, which are the dependable signals. The sparkline is
// shown as context only and is coloured by status, never used to assert a direction.

import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, BarChart3, AlertTriangle, TrendingUp,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { DEMO_STUDENTS, SUPPORT_AREAS, TIER_LABELS } from '../data';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const supportAreaLabel = (areaId, language) => {
  const a = SUPPORT_AREAS.find(x => x.id === areaId);
  if (!a) return language === 'HI' ? 'सहायता' : 'Support';
  return language === 'HI' ? a.labelHI : a.labelEN;
};
const tierShort = (tier, language) => (language === 'HI' ? `स्तर ${tier || 1}` : `Tier ${tier || 1}`);

const statusStroke = { green: '#2E8B57', yellow: '#D9A300', red: '#D64545' };
const statusText = {
  green:  { EN: 'On track',      HI: 'ठीक चल रहा' },
  yellow: { EN: 'Watch',         HI: 'ध्यान दें' },
  red:    { EN: 'Needs support', HI: 'सहायता चाहिए' },
};
const statusLabel = (status, language) => {
  const s = statusText[status];
  if (!s) return '';
  return language === 'HI' ? s.HI : s.EN;
};

// Tiny weekly-trend line drawn as an SVG polyline.
function Sparkline({ data, stroke }) {
  if (!Array.isArray(data) || data.length < 2) {
    return <span className="text-xs text-muted">—</span>;
  }
  const w = 88, h = 28, pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - 2 * pad)) / (data.length - 1);
    const y = pad + (h - 2 * pad) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────
const ProgressAnalytics = () => {
  const { appState, updateState } = useApp();
  const navigate = useNavigate();
  const language = appState.language || 'EN';
  const t = (en, hi) => (language === 'HI' ? hi : en);

  const students = DEMO_STUDENTS;
  const total = students.length;

  // Class summary (same definitions the dashboard uses, so the numbers agree).
  const avgActivities = total
    ? Math.round(students.reduce((s, x) => s + (x.weeklyStats?.activitiesCompleted || 0), 0) / total)
    : 0;
  const needsAttention = students.filter(s => s.status === 'red' || s.status === 'yellow');
  const improvingSignals = students.reduce(
    (sum, s) => sum + (s.errorPatterns || []).filter(ep => ep.trend === 'improving').length, 0
  );

  // Where support is needed: per area, how many students are at 'some' or 'high'.
  const areaDist = SUPPORT_AREAS.map(a => {
    let some = 0, high = 0;
    students.forEach(s => {
      const lvl = s.supportProfile?.[a.id];
      if (lvl === 'high') high++;
      else if (lvl === 'some') some++;
    });
    return { id: a.id, some, high, total: some + high };
  }).filter(a => a.total > 0).sort((x, y) => y.total - x.total);
  const maxArea = Math.max(1, ...areaDist.map(a => a.total));

  // Tier spread.
  const tierDist = [1, 2, 3].map(tn => ({ tier: tn, count: students.filter(s => (s.tier || 1) === tn).length }));

  // A student is "improving" if at least half their error patterns are trending up.
  const isImproving = (s) => {
    const eps = s.errorPatterns || [];
    if (!eps.length) return false;
    return eps.filter(e => e.trend === 'improving').length / eps.length >= 0.5;
  };

  const summaryCards = [
    { Icon: Users,         value: total,            label: t('Students', 'छात्र'),                       color: 'text-primary',    bg: 'bg-primary/10' },
    { Icon: BarChart3,     value: avgActivities,    label: t('Avg activities/week', 'औसत गतिविधियाँ/सप्ताह'), color: 'text-calm',     bg: 'bg-calm/10' },
    { Icon: AlertTriangle, value: needsAttention.length, label: t('Need attention', 'ध्यान चाहिए'),       color: 'text-warm',       bg: 'bg-warm/10' },
    { Icon: TrendingUp,    value: improvingSignals, label: t('Improving signals', 'सुधार संकेत'),          color: 'text-green-600',  bg: 'bg-green-50' },
  ];

  const headingCls = 'text-sm font-bold text-primary uppercase tracking-wide mb-3';

  return (
    <Layout
      title={t('Progress Analytics', 'प्रगति विश्लेषण')}
      showBack
      isTeacherPage
      lang={language}
      setLanguage={(l) => updateState({ language: l })}
    >
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <button
          onClick={() => navigate('/teacher')}
          className="flex items-center gap-2 text-sm text-muted mb-4 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('Back to dashboard', 'डैशबोर्ड पर वापस')}
        </button>

        <div className="mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-bold text-primary">{t('Class Progress Analytics', 'कक्षा प्रगति विश्लेषण')}</h1>
          </div>
          <p className="text-muted text-sm">
            {t('How your class is doing this week, based on your class roster.', 'इस सप्ताह आपकी कक्षा कैसी चल रही है, आपकी कक्षा सूची के आधार पर।')}
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {summaryCards.map((c, i) => {
            const I = c.Icon;
            return (
              <div key={i} className="card-elevated p-4">
                <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
                  <I className={`w-5 h-5 ${c.color}`} />
                </div>
                <p className="text-2xl font-bold text-primary leading-none">{c.value}</p>
                <p className="text-xs text-muted mt-1 leading-tight">{c.label}</p>
              </div>
            );
          })}
        </div>

        {/* Where support is needed */}
        <section className="card-elevated p-5 mb-5">
          <h2 className={headingCls}>{t('Where support is needed', 'कहाँ सहायता चाहिए')}</h2>
          <div className="space-y-3">
            {areaDist.map(a => (
              <div key={a.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-primary font-medium">{supportAreaLabel(a.id, language)}</span>
                  <span className="text-muted">{a.total} {t('students', 'छात्र')}</span>
                </div>
                <div className="h-3 rounded-full bg-surface overflow-hidden flex">
                  <div className="h-full bg-warm" style={{ width: `${(a.high / maxArea) * 100}%` }} />
                  <div className="h-full bg-warm/40" style={{ width: `${(a.some / maxArea) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warm inline-block" />{t('higher support', 'अधिक सहायता')}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warm/40 inline-block" />{t('some support', 'कुछ सहायता')}</span>
          </div>
        </section>

        {/* Support tiers */}
        <section className="card-elevated p-5 mb-5">
          <h2 className={headingCls}>{t('Support tiers', 'सहायता स्तर')}</h2>
          <div className="space-y-2">
            {tierDist.map(td => (
              <div key={td.tier} className="flex items-center gap-3">
                <span className={`badge badge-tier-${td.tier}`}>{tierShort(td.tier, language)}</span>
                <div className="flex-1 h-3 rounded-full bg-surface overflow-hidden">
                  <div
                    className={`h-full ${td.tier === 1 ? 'bg-green-400' : td.tier === 2 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${total ? (td.count / total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-muted w-6 text-right">{td.count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            {t('Tier 1 classroom support · Tier 2 targeted intervention · Tier 3 specialist referral',
               'स्तर 1 कक्षा सहायता · स्तर 2 लक्षित हस्तक्षेप · स्तर 3 विशेषज्ञ रेफरल')}
          </p>
        </section>

        {/* Each student */}
        <section className="card-elevated p-5 mb-5">
          <h2 className={headingCls}>{t('Each student', 'प्रत्येक छात्र')}</h2>
          <div className="divide-y divide-gray-100">
            {students.map(s => (
              <div key={s.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-primary">{s.name}</p>
                    <span className={`badge badge-tier-${s.tier || 1}`}>{tierShort(s.tier, language)}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {supportAreaLabel(s.primarySupportArea, language)} · {s.weeklyStats?.activitiesCompleted ?? 0} {t('activities', 'गतिविधियाँ')} · {s.lastActive}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Sparkline data={s.progressHistory} stroke={statusStroke[s.status] || '#94a3b8'} />
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: statusStroke[s.status] || '#64748b' }}>
                    {statusLabel(s.status, language)}{isImproving(s) ? ` · ${t('improving', 'सुधार')}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3 italic">
            {t('The line is each student weekly tracked score, shown for context. The status comes from the dashboard status and error-pattern trends, not the line alone.',
               'रेखा प्रत्येक छात्र का साप्ताहिक स्कोर है, केवल संदर्भ के लिए। स्थिति डैशबोर्ड स्थिति और त्रुटि-रुझान पर आधारित है, केवल रेखा पर नहीं।')}
          </p>
        </section>

        {/* Who needs attention */}
        {needsAttention.length > 0 && (
          <section className="card-elevated p-5 mb-5 border-l-4 border-warm">
            <h2 className="font-bold text-primary flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-warm" />
              {t('Who needs attention', 'किसे ध्यान चाहिए')}
            </h2>
            <div className="space-y-2">
              {needsAttention.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate('/teacher')}
                  className="w-full text-left flex items-center justify-between bg-warm/5 rounded-xl p-3 hover:bg-warm/10 transition-colors"
                >
                  <div>
                    <p className="font-medium text-primary">{s.name}</p>
                    <p className="text-xs text-muted">{supportAreaLabel(s.primarySupportArea, language)} · {tierShort(s.tier, language)}</p>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: statusStroke[s.status] || '#64748b' }}>
                    {statusLabel(s.status, language)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default ProgressAnalytics;
