// src/pages/ResourceLibrary.jsx
// Route: /teacher/resources
// Purpose: Browsable, downloadable teaching materials. Filtered by SLD type and resource type.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, FileText, Download, Send, Star, Eye, Wifi,
  ClipboardList, BookOpen, MessageSquare, Target, Search,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { RESOURCES, STRINGS } from '../data';

// ─── FILTER CONFIG ────────────────────────────────────────────────────────────

const SLD_FILTERS = [
  { id: 'all',         labelEN: 'All',          labelHI: 'सभी' },
  { id: 'dyslexia',    labelEN: 'Dyslexia',     labelHI: 'डिस्लेक्सिया' },
  { id: 'dyscalculia', labelEN: 'Dyscalculia',  labelHI: 'डिस्कैल्कुलिया' },
  { id: 'dysgraphia',  labelEN: 'Dysgraphia',   labelHI: 'डिस्ग्राफिया' },
];

const TYPE_FILTERS = [
  { id: 'all',                  labelEN: 'All Types',      labelHI: 'सभी प्रकार' },
  { id: 'Accommodation Guide',  labelEN: 'Guides',         labelHI: 'गाइड' },
  { id: 'Lesson Plan',          labelEN: 'Lesson Plans',   labelHI: 'पाठ योजनाएं' },
  { id: 'Parent Template',      labelEN: 'Templates',      labelHI: 'टेम्पलेट' },
  { id: 'Activity Resource',    labelEN: 'Activities',     labelHI: 'गतिविधियाँ' },
];

// SLD badge CSS classes from index.css
const sldBadgeClass = {
  dyslexia:    'badge badge-dyslexia',
  dyscalculia: 'badge badge-dyscalculia',
  dysgraphia:  'badge badge-dysgraphia',
};

// Resource type → Lucide icon mapping
const typeIconMap = {
  'Accommodation Guide': ClipboardList,
  'Lesson Plan':         BookOpen,
  'Parent Template':     MessageSquare,
  'Activity Resource':   Target,
};

// ─── STAR RATING component ────────────────────────────────────────────────────
const StarRating = ({ rating, onRate }) => (
  <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map(star => (
      <button
        key={star}
        onClick={() => onRate(star)}
        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        className={`min-h-[32px] min-w-[24px] transition-transform hover:scale-110 ${
          star <= rating ? 'text-warm' : 'text-gray-300'
        }`}
      >
        <Star size={16} className={star <= rating ? 'fill-warm' : ''} />
      </button>
    ))}
  </div>
);

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ResourceLibrary() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const { language } = appState;

  const [sldFilter, setSldFilter]   = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewResource, setPreviewResource] = useState(null);
  const [toastMsg, setToastMsg]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  // Local ratings state - starts from data.js values
  const [ratings, setRatings] = useState(
    Object.fromEntries(RESOURCES.map(r => [r.id, r.rating]))
  );

  // ── Close modal on Escape ──────────────────────────────────────────────
  const closeModal = useCallback(() => setPreviewResource(null), []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeModal]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const handleDownload = (resource) => {
    showToast(
      language === 'HI'
        ? `"${resource.title}" डाउनलोड हो गया!`
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

  // Count of saved resources (simulated)
  const savedCount = Math.min(filtered.length, 3);

  return (
    <Layout
      title={language === 'HI' ? 'संसाधन पुस्तकालय' : 'Resource Library'}
      showNav
      showBack={false}
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

      {/* ── Back button (explicit to /teacher) ─────────────────────────── */}
      <button
        onClick={() => navigate('/teacher')}
        aria-label="Back to dashboard"
        className="flex items-center gap-1.5 text-sm text-muted hover:text-primary font-medium mb-4 min-h-[48px] transition-colors"
      >
        ← {language === 'HI' ? 'डैशबोर्ड पर वापस' : 'Back to Dashboard'}
      </button>

      {/* ── Subtitle ───────────────────────────────────────────────────────── */}
      <p className="text-sm text-muted mb-5">
        {language === 'HI'
          ? 'SLD छात्रों के लिए पाठ योजनाएं, गाइड और टेम्पलेट'
          : 'Lesson plans, guides and templates for SLD students'}
      </p>

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
              aria-label={`Filter by ${f.labelEN}`}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold min-h-[40px] border-2 transition-all duration-200 ${
                sldFilter === f.id
                  ? 'bg-calm text-white border-calm'
                  : 'bg-card text-muted border-gray-200 hover:border-calm hover:text-calm'
              }`}
            >
              {language === 'HI' ? f.labelHI : f.labelEN}
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
              aria-label={`Filter by ${f.labelEN}`}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold min-h-[40px] border-2 transition-all duration-200 ${
                typeFilter === f.id
                  ? 'bg-calm text-white border-calm'
                  : 'bg-card text-muted border-gray-200 hover:border-calm hover:text-calm'
              }`}
            >
              {language === 'HI' ? f.labelHI : f.labelEN}
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
        <div className="text-center py-12 animate-fadeIn">
          <Search size={40} className="text-muted mx-auto mb-3 opacity-50" />
          <p className="text-muted text-sm">
            {language === 'HI'
              ? 'इस फ़िल्टर के लिए कोई संसाधन नहीं मिला।'
              : 'No resources match this filter.'}
          </p>
          <button
            onClick={() => { setSldFilter('all'); setTypeFilter('all'); }}
            aria-label="Clear filters"
            className="mt-3 text-calm text-sm font-semibold hover:underline min-h-[48px]"
          >
            {language === 'HI' ? 'फ़िल्टर हटाएं' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
          {filtered.map(resource => {
            const TypeIcon = typeIconMap[resource.type] || FileText;
            return (
              <div
                key={resource.id}
                className="bg-card rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-200 flex flex-col"
              >
                {/* Card header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-calm/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TypeIcon size={20} className="text-calm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-primary leading-snug mb-1">
                      {resource.title}
                    </h2>
                    {/* Metadata badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className={sldBadgeClass[resource.sldType] || 'badge bg-gray-100 text-gray-600'}>
                        {resource.sldType}
                      </span>
                      <span className="badge bg-gray-100 text-gray-600 border border-gray-200">
                        {language === 'HI' ? `कक्षा ${resource.classLevel}` : `Class ${resource.classLevel}`}
                      </span>
                      <span className="badge bg-surface text-muted border border-gray-200">
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
                    className="flex-1 bg-accent text-white text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Eye size={14} />
                    {language === 'HI' ? 'पूर्वावलोकन' : 'Preview'}
                  </button>
                  <button
                    onClick={() => handleDownload(resource)}
                    aria-label={`Download ${resource.title} as PDF`}
                    className="flex-1 bg-surface border border-gray-200 text-primary text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download size={14} />
                    {language === 'HI' ? 'PDF' : 'Download PDF'}
                  </button>
                  {(resource.type === 'Activity Resource') && (
                    <button
                      onClick={handleSendToStudent}
                      aria-label={`Send ${resource.title} to student`}
                      className="w-full bg-warm/10 text-warm border border-warm/20 text-xs font-semibold py-2 px-3 rounded-xl min-h-[48px] hover:bg-warm hover:text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Send size={14} />
                      {language === 'HI' ? 'छात्र को भेजें' : 'Send to Student'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Offline bottom bar ────────────────────────────────────────────── */}
      <div className="bg-primary/5 border border-primary/10 rounded-2xl px-4 py-3 flex items-center gap-2.5 mb-8">
        <Wifi size={16} className="text-calm flex-shrink-0" />
        <p className="text-xs text-primary font-medium">
          {language === 'HI'
            ? `${savedCount} संसाधन ऑफलाइन उपयोग के लिए सहेजे गए`
            : `${savedCount} resources saved for offline use`}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PREVIEW MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {previewResource && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
            onClick={closeModal}
            aria-label="Close preview"
          />

          {/* Modal */}
          <div
            className="fixed inset-x-4 top-[10%] bottom-[10%] z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-w-2xl mx-auto animate-scaleIn"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview: ${previewResource.title}`}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-calm/10 flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const Icon = typeIconMap[previewResource.type] || FileText;
                    return <Icon size={20} className="text-calm" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-primary leading-snug">
                    {previewResource.title}
                  </h2>
                  <span className={`mt-1 inline-block ${sldBadgeClass[previewResource.sldType] || 'badge'}`}>
                    {previewResource.sldType}
                  </span>
                </div>
              </div>
              <button
                onClick={closeModal}
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
                onClick={() => { handleDownload(previewResource); closeModal(); }}
                aria-label="Download PDF"
                className="flex-1 btn-calm text-sm"
              >
                <Download size={16} />
                {language === 'HI' ? 'PDF डाउनलोड करें' : 'Download PDF'}
              </button>
              <button
                onClick={closeModal}
                aria-label="Close preview"
                className="flex-1 btn-ghost text-sm"
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
