// src/pages/TeacherAssistant.jsx
// Route: /teacher/assistant
// Priority 5 — AI Teacher Assistant
// A chatbot that suggests accommodations, interventions, and classroom strategies.
// Human always stays in control: every AI response can be saved to a student's profile.
// Escalation flag: if the assistant detects a severe concern, it surfaces a referral prompt.

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Loader2, Bot, User, Lightbulb, AlertTriangle,
  ChevronDown, BookOpen, ArrowLeft, Sparkles, Copy, Check,
  UserCheck,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useApp } from '../App';
import { DEMO_STUDENTS } from '../data';
import { callGemini } from '../gemini';
import { subscribeToStudents } from '../firebase';

// ─── SUGGESTED PROMPTS ────────────────────────────────────────────────────────
// Shown as quick-tap chips before the first message. Grouped by intent.
const SUGGESTED_PROMPTS = [
  {
    label: 'Classroom accommodations',
    labelHI: 'कक्षा अनुकूलन',
    prompt: 'What classroom accommodations should I provide for this student during reading activities?',
  },
  {
    label: 'Assessment alternatives',
    labelHI: 'मूल्यांकन विकल्प',
    prompt: 'How can I assess this student\'s understanding without relying on written tests?',
  },
  {
    label: 'Parent communication',
    labelHI: 'अभिभावक संवाद',
    prompt: 'How should I communicate this student\'s learning support needs to their parents sensitively?',
  },
  {
    label: 'Peer support strategies',
    labelHI: 'साथी सहयोग',
    prompt: 'What peer support strategies can I use in the classroom to include this student without singling them out?',
  },
  {
    label: 'Weekly intervention plan',
    labelHI: 'साप्ताहिक हस्तक्षेप',
    prompt: 'Can you suggest a simple 3-day weekly intervention plan I can do in 10 minutes per session?',
  },
  {
    label: 'Signs of progress',
    labelHI: 'प्रगति के संकेत',
    prompt: 'What specific signs of progress should I look for to know the interventions are working?',
  },
];

// ─── ESCALATION KEYWORDS ──────────────────────────────────────────────────────
// If the AI response contains any of these phrases, show the referral prompt.
const ESCALATION_PHRASES = [
  'specialist', 'special educator', 'refer', 'referral',
  'beyond classroom', 'professional assessment', 'psychologist',
  'further evaluation', 'educational psychologist', 'clinical',
];

const needsEscalation = (text) =>
  ESCALATION_PHRASES.some(phrase => text.toLowerCase().includes(phrase));

// ─── BUILD THE AI PROMPT ──────────────────────────────────────────────────────
// Constructs the Gemini prompt with full student context.
function buildAssistantPrompt(userMessage, student, conversationHistory, language) {
  const lang = language === 'HI' ? 'Hindi' : 'English';

  // Build support context from student data
  const mastered = student
    ? Object.entries(student.masteryMap || {})
        .filter(([, v]) => v === 'mastered').map(([k]) => k).join(', ') || 'None yet'
    : 'Not available';

  const struggling = student
    ? Object.entries(student.masteryMap || {})
        .filter(([, v]) => v === 'struggling').map(([k]) => k).join(', ') || 'None identified'
    : 'Not available';

  const errorPatterns = student
    ? (student.errorPatterns || []).map(ep => `${ep.pattern} (${ep.trend})`).join('; ') || 'None recorded'
    : 'Not available';

  const sldContext = student
    ? `The student is ${student.name}, Class ${student.class}, at ${student.school}. Their support profile shows: ${student.sldType} (${student.severity}). Mastered: ${mastered}. Currently struggling with: ${struggling}. Key error patterns: ${errorPatterns}. This week: ${student.weeklyStats?.timeSpent || 'N/A'} spent, ${student.weeklyStats?.activitiesCompleted || 0} activities completed.`
    : 'No specific student selected. Provide general classroom strategies.';

  // Build conversation history string
  const historyStr = conversationHistory.length > 0
    ? '\n\nConversation so far:\n' + conversationHistory
        .map(m => `${m.role === 'user' ? 'Teacher' : 'Assistant'}: ${m.text}`)
        .join('\n')
    : '';

  return `You are an expert educational assistant supporting Indian school teachers with students who may benefit from learning support. You work within a Tier 1 (classroom) to Tier 2 (targeted intervention) to Tier 3 (specialist referral) framework.

IMPORTANT PRINCIPLES:
- Never diagnose. Use support-based language: "Reading Support", "Writing Support", "Numeracy Support", "Attention Support". Never say "has dyslexia/dysgraphia/dyscalculia" — say "may benefit from reading support" or "shows signs that may benefit from further assessment".
- Accommodations should be practical for a single teacher in a class of 30-40 Indian government or low-resource school students.
- If the concern appears severe or beyond classroom support (Tier 3), briefly mention that a referral to a special educator may be appropriate — but phrase it as a suggestion, not a diagnosis.
- Respond in ${lang}.
- Keep responses concise and structured: 2-4 short paragraphs or a numbered list. No long walls of text.
- Always end with one concrete next step the teacher can take TODAY.

Student context:
${sldContext}
${historyStr}

Teacher's question: ${userMessage}

Respond as a supportive, knowledgeable colleague. Be warm, practical, and specific to this student's data where possible.`;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function TeacherAssistant() {
  const navigate = useNavigate();
  const { appState, updateState } = useApp();
  const { language, teacherName } = appState;

  // ── Student selector ───────────────────────────────────────────────────────
  const [firebaseStudents, setFirebaseStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('general');
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToStudents(setFirebaseStudents);
    return unsub;
  }, []);

  const demoIds = new Set(DEMO_STUDENTS.map(s => s.id));
  const allStudents = [
    ...DEMO_STUDENTS,
    ...firebaseStudents.filter(s => !demoIds.has(s.id)),
  ];

  const selectedStudent = selectedStudentId === 'general'
    ? null
    : allStudents.find(s => s.id === selectedStudentId);

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', text, escalate?, copied? }
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Reset chat when student changes
  useEffect(() => {
    setMessages([]);
    setShowSuggestions(true);
    setInputValue('');
  }, [selectedStudentId]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setShowSuggestions(false);
    setInputValue('');

    const userMsg = { role: 'user', text: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    const prompt = buildAssistantPrompt(
      trimmed,
      selectedStudent,
      messages, // pass history before this new message
      language
    );

    const raw = await callGemini(prompt, 20000);

    const responseText = raw || (language === 'HI'
      ? 'माफ़ करें, अभी AI उपलब्ध नहीं है। कृपया दोबारा कोशिश करें।'
      : 'Sorry, the AI assistant is temporarily unavailable. Please try again in a moment.');

    const assistantMsg = {
      role: 'assistant',
      text: responseText,
      escalate: raw ? needsEscalation(responseText) : false,
    };

    setMessages([...newMessages, assistantMsg]);
    setIsLoading(false);
  };

  const handleSend = () => sendMessage(inputValue);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedPrompt = (prompt) => {
    sendMessage(prompt);
  };

  // ── Copy response ──────────────────────────────────────────────────────────
  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  // ── Student selector ───────────────────────────────────────────────────────
  const StudentSelector = () => (
    <div className="relative">
      <button
        onClick={() => setSelectorOpen(prev => !prev)}
        aria-label="Select student"
        className="flex items-center gap-2 bg-card border-2 border-gray-200 hover:border-calm text-primary text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[48px] transition-all w-full max-w-xs"
      >
        <User size={15} className="text-calm flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {selectedStudent
            ? `${selectedStudent.name} — Class ${selectedStudent.class}`
            : (language === 'HI' ? 'सामान्य सलाह' : 'General advice')}
        </span>
        <ChevronDown
          size={14}
          className={`text-muted transition-transform flex-shrink-0 ${selectorOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {selectorOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-card rounded-2xl shadow-xl border border-gray-100 z-20 overflow-hidden animate-scaleIn origin-top-left">
          {/* General option */}
          <button
            onClick={() => { setSelectedStudentId('general'); setSelectorOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface transition-colors text-left ${
              selectedStudentId === 'general' ? 'bg-calm/5 text-calm font-semibold' : 'text-primary'
            }`}
          >
            <BookOpen size={15} className="text-calm flex-shrink-0" />
            <div>
              <p className="font-semibold">{language === 'HI' ? 'सामान्य सलाह' : 'General advice'}</p>
              <p className="text-xs text-muted">{language === 'HI' ? 'किसी विशेष छात्र के बिना' : 'Without a specific student'}</p>
            </div>
          </button>

          <div className="border-t border-gray-100 px-4 py-2">
            <p className="text-xs text-muted font-semibold uppercase tracking-wide">
              {language === 'HI' ? 'छात्र चुनें' : 'Select student'}
            </p>
          </div>

          {allStudents.map(student => (
            <button
              key={student.id}
              onClick={() => { setSelectedStudentId(student.id); setSelectorOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface transition-colors text-left ${
                selectedStudentId === student.id ? 'bg-calm/5 text-calm font-semibold' : 'text-primary'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <span className="text-accent text-xs font-bold">{student.name[0]}</span>
              </div>
              <div>
                <p className="font-semibold">{student.name}</p>
                <p className="text-xs text-muted">
                  {language === 'HI' ? `कक्षा ${student.class}` : `Class ${student.class}`}
                  {student.sldType ? ` · ${student.sldType}` : ''}
                </p>
              </div>
              {selectedStudentId === student.id && (
                <Check size={14} className="ml-auto text-calm flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Layout
      title=""
      showNav={false}
      showCompanion={false}
      isTeacherPage
      lang={language}
      setLanguage={(lang) => updateState({ language: lang })}
    >
      {/* ── Custom Top Bar ──────────────────────────────────────────────── */}
      <div className="bg-card border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-8 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/teacher')}
            aria-label="Back to dashboard"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-primary" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-calm/15 rounded-lg flex items-center justify-center">
                <Bot size={14} className="text-calm" />
              </div>
              <h1 className="text-base font-bold text-primary">
                {language === 'HI' ? 'AI शिक्षक सहायक' : 'AI Teacher Assistant'}
              </h1>
            </div>
            <p className="text-xs text-muted ml-8">
              {language === 'HI'
                ? 'अनुकूलन, रणनीतियाँ, हस्तक्षेप'
                : 'Accommodations · Strategies · Interventions'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateState({ language: language === 'EN' ? 'HI' : 'EN' })}
            aria-label="Toggle language"
            className="bg-white border border-gray-200 text-primary font-semibold text-sm px-3 py-1 rounded-lg min-h-[44px] hover:bg-gray-50 transition-colors"
          >
            {language === 'EN' ? 'हिंदी' : 'EN'}
          </button>
        </div>
      </div>

      <div className="py-4 flex flex-col" style={{ minHeight: 'calc(100vh - 180px)' }}>

        {/* ── Student Context Selector ────────────────────────────────── */}
        <div className="mb-4">
          <p className="text-xs text-muted font-semibold mb-2 uppercase tracking-wide">
            {language === 'HI' ? 'किस छात्र के बारे में?' : 'Asking about:'}
          </p>
          <StudentSelector />
          {selectedStudent && (
            <div className="mt-2 bg-calm/5 border border-calm/20 rounded-xl px-3 py-2 flex flex-wrap gap-3 text-xs text-muted animate-fadeIn">
              <span>
                {language === 'HI' ? 'सहायता क्षेत्र: ' : 'Support need: '}
                <span className="text-primary font-semibold capitalize">{selectedStudent.sldType}</span>
              </span>
              <span>·</span>
              <span>
                {language === 'HI' ? 'स्तर: ' : 'Severity: '}
                <span className="text-primary font-semibold capitalize">{selectedStudent.severity}</span>
              </span>
              <span>·</span>
              <span>
                {language === 'HI' ? 'इस सप्ताह: ' : 'This week: '}
                <span className="text-primary font-semibold">
                  {selectedStudent.weeklyStats?.activitiesCompleted || 0}
                  {language === 'HI' ? ' गतिविधियाँ' : ' activities'}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ── Disclaimer ──────────────────────────────────────────────── */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2 mb-4 text-xs text-amber-800">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <span>
            {language === 'HI'
              ? 'AI सुझाव हैं, निदान नहीं। सभी सिफारिशें आपके निर्णय के बाद ही लागू करें।'
              : 'AI suggestions only — not a diagnosis. Review all recommendations before acting.'}
          </span>
        </div>

        {/* ── Chat Messages ────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4 mb-4">

          {/* Empty state with suggested prompts */}
          {messages.length === 0 && showSuggestions && (
            <div className="animate-fadeIn">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-calm/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-calm/20">
                  <Sparkles size={24} className="text-calm" />
                </div>
                <h2 className="text-base font-bold text-primary mb-1">
                  {language === 'HI'
                    ? `नमस्ते ${teacherName || 'शिक्षक'}!`
                    : `Hi ${teacherName || 'Teacher'}!`}
                </h2>
                <p className="text-sm text-muted max-w-xs mx-auto">
                  {language === 'HI'
                    ? selectedStudent
                      ? `${selectedStudent.name} के लिए कैसे मदद करूँ?`
                      : 'मैं आपकी कक्षा में कैसे मदद कर सकता हूँ?'
                    : selectedStudent
                    ? `How can I help you support ${selectedStudent.name}?`
                    : 'How can I help you support your students today?'}
                </p>
              </div>

              <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-3">
                {language === 'HI' ? 'सामान्य प्रश्न' : 'Common questions'}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((sp, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedPrompt(sp.prompt)}
                    className="flex items-start gap-3 text-left bg-card border border-gray-200 hover:border-calm hover:bg-calm/5 rounded-xl p-3 transition-all duration-200 min-h-[56px] group"
                    aria-label={sp.label}
                  >
                    <Lightbulb
                      size={15}
                      className="text-muted group-hover:text-calm mt-0.5 flex-shrink-0 transition-colors"
                    />
                    <span className="text-sm text-primary font-medium leading-snug">
                      {language === 'HI' ? sp.labelHI : sp.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message thread */}
          {messages.map((msg, i) => (
            <div key={i} className="animate-fadeIn">
              {msg.role === 'user' ? (
                /* ── User bubble ── */
                <div className="flex justify-end">
                  <div className="flex items-end gap-2 max-w-[85%]">
                    <div className="bg-accent text-white text-sm px-4 py-3 rounded-2xl rounded-br-md shadow-sm leading-relaxed">
                      {msg.text}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 mb-0.5">
                      <User size={13} className="text-accent" />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Assistant bubble ── */
                <div className="flex justify-start">
                  <div className="flex items-start gap-2 max-w-[92%]">
                    <div className="w-7 h-7 rounded-full bg-calm/15 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot size={13} className="text-calm" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-card border border-gray-100 text-sm text-primary px-4 py-3 rounded-2xl rounded-tl-md shadow-sm leading-relaxed whitespace-pre-line">
                        {msg.text}
                      </div>

                      {/* Action row below assistant bubble */}
                      <div className="flex items-center gap-2 mt-1.5 ml-1 flex-wrap">
                        {/* Copy button */}
                        <button
                          onClick={() => handleCopy(msg.text, i)}
                          aria-label="Copy response"
                          className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors py-1"
                        >
                          {copiedIndex === i
                            ? <><Check size={11} className="text-success" /> {language === 'HI' ? 'कॉपी हुआ' : 'Copied'}</>
                            : <><Copy size={11} /> {language === 'HI' ? 'कॉपी करें' : 'Copy'}</>
                          }
                        </button>

                        {/* Escalation / Referral prompt */}
                        {msg.escalate && (
                          <button
                            onClick={() => navigate('/teacher')}
                            aria-label="Refer to specialist"
                            className="flex items-center gap-1.5 text-xs text-warm font-semibold bg-warm/10 hover:bg-warm/20 border border-warm/20 px-2.5 py-1 rounded-lg transition-colors min-h-[28px]"
                          >
                            <UserCheck size={12} />
                            {language === 'HI' ? 'विशेषज्ञ को रेफर करें' : 'Refer to specialist'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start animate-fadeIn">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-calm/15 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={13} className="text-calm" />
                </div>
                <div className="bg-card border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-md shadow-sm">
                  <div className="flex items-center gap-2 text-muted text-sm">
                    <Loader2 size={14} className="animate-spin text-calm" />
                    <span>
                      {language === 'HI' ? 'सोच रहा हूँ...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ── Input Bar ───────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-surface pt-2 pb-2">
          {/* Suggested follow-ups after first exchange */}
          {messages.length > 0 && !isLoading && showSuggestions === false && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
              {SUGGESTED_PROMPTS.slice(0, 3).map((sp, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedPrompt(sp.prompt)}
                  className="flex-shrink-0 text-xs bg-card border border-gray-200 hover:border-calm text-primary px-3 py-2 rounded-xl transition-colors min-h-[36px] whitespace-nowrap"
                >
                  {language === 'HI' ? sp.labelHI : sp.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-card border-2 border-gray-200 focus-within:border-calm rounded-2xl px-3 py-2 transition-all shadow-sm">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                language === 'HI'
                  ? (selectedStudent
                    ? `${selectedStudent.name} के बारे में कुछ पूछें...`
                    : 'कुछ पूछें... (Enter भेजें, Shift+Enter नई लाइन)')
                  : (selectedStudent
                    ? `Ask about ${selectedStudent.name}...`
                    : 'Ask anything... (Enter to send, Shift+Enter for new line)')
              }
              aria-label="Message input"
              disabled={isLoading}
              style={{ resize: 'none', minHeight: '40px', maxHeight: '120px', overflow: 'auto' }}
              className="flex-1 text-sm text-primary bg-transparent focus:outline-none placeholder:text-muted leading-relaxed pt-1"
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send message"
              className="w-9 h-9 rounded-xl bg-calm text-white flex items-center justify-center flex-shrink-0 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isLoading
                ? <Loader2 size={16} className="animate-spin" />
                : <Send size={15} />
              }
            </button>
          </div>

          <p className="text-[10px] text-muted text-center mt-2">
            {language === 'HI'
              ? 'AI-जनित सुझाव। कृपया अपने निर्णय से उपयोग करें।'
              : 'AI-generated suggestions. Always apply your professional judgement.'}
          </p>
        </div>
      </div>
    </Layout>
  );
}
