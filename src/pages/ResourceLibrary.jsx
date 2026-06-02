// src/pages/ResourceLibrary.jsx
// Route: /teacher/resources
// Purpose: Browsable, downloadable teaching materials. Filtered by SLD type and resource type.

import { useState } from 'react';
import { X } from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { RESOURCES, STRINGS } from '../data';

// ─── FILTER CONFIG ────────────────────────────────────────────────────────────

const SLD_FILTERS = [
  { id: 'all',         label: 'All',          labelHI: 'सभी' },
  { id: 'dyslexia',    label: 'Dyslexia',     labelHI: 'डिस्लेक्सिया' },
  { id: 'dyscalculia', label: 'Dyscalculia',  labelHI: 'डिस्कैल्कुलिया' },
  { id: 'dysgraphia',  label: 'Dysgraphia',   labelHI: 'डिस्ग्राफिया' },
];

const TYPE_FILTERS = [
  { id: 'all',          label: 'All Types',       labelHI: 'सभी प्रकार' },
  { id: 'Accommodation Guide', label: 'Guides',   labelHI: 'गाइड' },
  { id: 'Lesson Plan',  label: 'Lesson Plans',    labelHI: 'पाठ योजनाएं' },
  { id: 'Parent Template', label: 'Templates',    labelHI: 'टेम्पलेट' },
  { id: 'Activity Resource', label: 'Activities', labelHI: 'गतिविधियाँ' },
];

const sldBadge = {
  dyslexia:    'bg-blue-100 text-blue-700',
  dyscalculia: 'bg-purple-100 text-purple-700',
  dysgraphia:  'bg-orange-100 text-orange-700',
};

const typeIcon = {
  'Accommodation Guide': '📋',
  'Lesson Plan':         '📝',
  'Parent Template':     '✉️',
  'Activity Resource':   '🎯',
};

// ─── STAR RATING component ────────────────────────────────────────────────────
function StarRating({ rating, onRate }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onRate(star)}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          className={`text-lg leading-none min-h-[32px] min-w-[24px] transition-transform hover:scale-110 ${
            star <= rating ? 'text-warm' : 'text-gray-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ResourceLibrary() {
  const { appState, updateState } = useApp();
  const { language } = appState;

  const [sldFilter, setSldFilter]   = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewResource, setPreviewResource] = useState(null); // resource being previewed in modal
  const [toastMsg, setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  // Local ratings state — starts from data.js values
  const [ratings, setRatings] = useState(
    Object.fromEntries(RESOURCES.map(r => [r.id, r.rating]))
  );

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const handleDownload = (resource) => {
    showToast(
      language === 'HI'
        ? `"${resource.title}" डाउनलोड हो गया! PDF पूर्ण ऐप में उपलब्ध होगी।`
        : `Downloaded! PDF generation available in full app.`
    );
  };

  const handleSendToStudent = () => {
    showToast(
      language === 'HI'
        ? 'गतिविधि छात्र के ऐप में भेजी गई!'
        : "Activity sent to student's app!"
    );
  };

  const handleRate = (resourceId, star) => {
    setRatings(prev => ({ ...prev, [resourceId]: star }));
    showToast(
      language === 'HI'
        ? 'रेटिंग सहेजी गई! धन्यवाद।'
        : 'Rating saved! Thank you.'
    );
  };

  // ── Filter resources ──────────────────────────────────────────────────────
  const filtered = RESOURCES.filter(r => {
    const sldOk  = sldFilter  === 'all' || r.sldType === sldFilter;
    const typeOk = typeFilter === 'all' || r.type === typeFilter;
    return sldOk && typeOk;
  });

  return (
    <Layout
      title={language === 'HI' ? 'संसाधन पुस्तकालय 📚' : 'Resource Library 📚'}
      showNav
      showBack
      showCompanion={false}
      isTeacherPage
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
    >
      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <div
        className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-primary text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg transition-all duration-300 whitespace-nowrap ${
          toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        role="status"
        aria-live="polite"
      >
        {toastMsg}
      </div>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-primary">
          {language === 'HI' ? 'संसाधन पुस्तकालय 📚' : 'Resource Library 📚'}
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {language === 'HI'
            ? 'SLD छात्रों के लिए पाठ योजनाएं, गाइड और टेम्पलेट'
            : 'Lesson plans, guides and templates for SLD students'}
        </p>
      </div>

      {/* ── Filter bar: SLD Type ───────────────────────────────────────────── */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          {language === 'HI' ? 'SLD प्रकार' : 'SLD Type'}
        </p>
        <div className="flex flex-wrap gap-2">
          {SLD_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setSldFilter(f.id)}
              aria-label={`Filter by ${f.label}`}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold min-h-[40px] border-2 transition-all duration-200 ${
                sldFilter === f.id
                  ? 'bg-calm text-white border-calm'
                  : 'bg-card text-muted border-gray-200 hover:border-calm hover:text-calm'
              }`}
            >
              {language === 'HI' ? f.labelHI : f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter bar: Resource Type ─────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          {language === 'HI' ? 'संसाधन प्रकार' : 'Resource Type'}
        </p>
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              aria-label={`Filter by ${f.label}`}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold min-h-[40px] border-2 transition-all duration-200 ${
                typeFilter === f.id
                  ? 'bg-calm text-white border-calm'
                  : 'bg-card text-muted border-gray-200 hover:border-calm hover:text-calm'
              }`}
            >
              {language === 'HI' ? f.labelHI : f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Result count ──────────────────────────────────────────────────── */}
      <p className="text-sm text-muted mb-4">
        {language === 'HI'
          ? `${filtered.length} संसाधन मिले`
          : `${filtered.length} resource${filtered.length !== 1 ? 's' : ''} found`}
      </p>

      {/* ── Resource Cards Grid ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl">🔍</span>
          <p className="text-muted text-sm mt-3">
            {language === 'HI'
              ? 'इस फ़िल्टर के लिए कोई संसाधन नहीं मिला।'
              : 'No resources match this filter.'}
          </p>
          <button
            onClick={() => { setSldFilter('all'); setTypeFilter('all'); }}
            className="mt-3 text-calm text-sm font-semibold hover:underline"
          >
            {language === 'HI' ? 'फ़िल्टर हटाएं' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
          {filtered.map(resource => (
            <div
              key={resource.id}
              className="bg-card rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200 flex flex-col"
            >
              {/* Card header */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">
                  {typeIcon[resource.type] || '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-primary leading-snug mb-1">
                    {resource.title}
                  </h2>
                  {/* Metadata badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${sldBadge[resource.sldType] || 'bg-gray-100 text-gray-600'}`}>
                      {resource.sldType}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {language === 'HI' ? `कक्षा ${resource.classLevel}` : `Class ${resource.classLevel}`}
                    </span>
                    <span className="text-xs bg-surface text-muted px-2 py-0.5 rounded-full border border-gray-200">
                      {resource.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted leading-relaxed mb-3 flex-1">
                {resource.description}
              </p>

              {/* Star rating */}
              <div className="flex items-center gap-2 mb-4">
                <StarRating
                  rating={ratings[resource.id]}
                  onRate={(star) => handleRate(resource.id, star)}
                />
                <span className="text-xs text-muted">
                  ({ratings[resource.id]}/5)
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setPreviewResource(resource)}
                  aria-label={`Preview ${resource.title}`}
                  className="flex-1 bg-accent text-white text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {language === 'HI' ? '👁 पूर्वावलोकन' : '👁 Preview'}
                </button>
                <button
                  onClick={() => handleDownload(resource)}
                  aria-label={`Download ${resource.title} as PDF`}
                  className="flex-1 bg-surface border border-gray-200 text-primary text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-gray-100 transition-colors"
                >
                  {language === 'HI' ? '⬇ PDF' : '⬇ Download PDF'}
                </button>
                {resource.sldType !== 'dyslexia' || resource.type === 'Activity Resource' ? (
                  <button
                    onClick={handleSendToStudent}
                    aria-label={`Send ${resource.title} to student`}
                    className="w-full bg-warm/10 text-warm border border-warm/20 text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-warm hover:text-white transition-colors"
                  >
                    {language === 'HI' ? '📤 छात्र को भेजें' : '📤 Send to Student'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Offline bottom bar ────────────────────────────────────────────── */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl px-4 py-3 flex items-center gap-2 mb-8">
        <span className="text-lg">📶</span>
        <p className="text-xs text-primary font-medium">
          {language === 'HI'
            ? '3 संसाधन ऑफलाइन उपयोग के लिए सहेजे गए'
            : '3 resources saved for offline use'}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PREVIEW MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {previewResource && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setPreviewResource(null)}
            aria-label="Close preview"
          />

          {/* Modal */}
          <div
            className="fixed inset-x-4 top-[10%] bottom-[10%] z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-w-2xl mx-auto"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview: ${previewResource.title}`}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-2xl flex-shrink-0">
                  {typeIcon[previewResource.type] || '📄'}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-primary leading-snug">
                    {previewResource.title}
                  </h2>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize mt-1 inline-block ${sldBadge[previewResource.sldType] || ''}`}>
                    {previewResource.sldType}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPreviewResource(null)}
                aria-label="Close preview"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center text-muted hover:text-primary flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="text-sm text-primary whitespace-pre-wrap leading-relaxed font-sans">
                {previewResource.preview}
              </pre>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { handleDownload(previewResource); setPreviewResource(null); }}
                aria-label="Download PDF"
                className="flex-1 bg-calm text-white font-semibold text-sm py-2.5 rounded-xl min-h-[48px] hover:bg-teal-600 transition-colors"
              >
                {language === 'HI' ? '⬇ PDF डाउनलोड करें' : '⬇ Download PDF'}
              </button>
              <button
                onClick={() => setPreviewResource(null)}
                aria-label="Close preview"
                className="flex-1 border-2 border-gray-200 text-muted font-semibold text-sm py-2.5 rounded-xl min-h-[48px] hover:border-accent hover:text-accent transition-all"
              >
                {language === 'HI' ? 'बंद करें' : 'Close'}
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
