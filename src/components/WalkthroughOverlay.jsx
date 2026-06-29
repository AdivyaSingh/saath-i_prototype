// src/components/WalkthroughOverlay.jsx
// Spotlight walkthrough overlay for student and teacher portals.
// Uses framer-motion (already in dependencies) for smooth transitions.
// Fully bilingual: EN and HI, driven by the lang prop.
// Triggered once per portal via localStorage flags; re-triggerable via "Take a Tour" button.

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react';

// ─── STUDENT WALKTHROUGH STEPS ────────────────────────────────────────────────
// targetId: the HTML id of the element to spotlight.
// null targetId = full-screen welcome/farewell card (no spotlight).
const STUDENT_STEPS = [
  {
    targetId: null,
    emoji: '👋',
    titleEN: 'Welcome to Saath-i!',
    titleHI: 'साथी में आपका स्वागत है!',
    bodyEN:
      'Saath-i is your personal learning companion. It helps you practise reading, numbers, and more — at your own pace, with no pressure. Let us show you around in a few easy steps.',
    bodyHI:
      'साथी आपका निजी सीखने का साथी है। यह आपको पढ़ना, गणित और बहुत कुछ अभ्यास करने में मदद करता है — अपनी गति से, बिना किसी दबाव के। आइए हम आपको कुछ आसान कदमों में दिखाते हैं।',
    position: 'center',
  },
  {
    targetId: 'walkthrough-companion-banner',
    emoji: '🦉',
    titleEN: 'Your Learning Companion',
    titleHI: 'आपका सीखने का साथी',
    bodyEN:
      'This is your companion — they will cheer you on every day! You chose them during sign-up. Tap the companion character on the right side of the screen anytime to get a helpful hint or encouragement.',
    bodyHI:
      'यह आपका साथी है — वे हर दिन आपका उत्साह बढ़ाएंगे! आपने उन्हें साइन-अप के दौरान चुना था। स्क्रीन के दाईं ओर साथी के चरित्र पर कभी भी टैप करें, एक उपयोगी संकेत या प्रोत्साहन पाने के लिए।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-focus-zone',
    emoji: '🧠',
    titleEN: 'Start Here: Focus Zone',
    titleHI: 'यहाँ से शुरू करें: फोकस ज़ोन',
    bodyEN:
      'Always begin your day with Focus Zone! It has 4 short games to warm up your attention and memory — like stretching before exercise. It takes about 5 minutes and there are no wrong answers.',
    bodyHI:
      'हमेशा अपना दिन फोकस ज़ोन से शुरू करें! इसमें 4 छोटे खेल हैं जो आपकी एकाग्रता और याददाश्त को तैयार करते हैं — जैसे व्यायाम से पहले स्ट्रेचिंग। इसमें लगभग 5 मिनट लगते हैं और कोई गलत जवाब नहीं होते।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-reading-room',
    emoji: '📖',
    titleEN: 'Reading Room',
    titleHI: 'पठन कक्ष',
    bodyEN:
      'Reading Room shows you short NCERT stories with audio support. You can listen to the words as you read them. If a word is hard, just tap it — it will be read out loud for you. No time limit, ever.',
    bodyHI:
      'पठन कक्ष में आपको ऑडियो सहायता के साथ छोटी NCERT कहानियाँ मिलती हैं। पढ़ते समय शब्द सुन सकते हैं। अगर कोई शब्द कठिन है, तो बस उस पर टैप करें — वह आपके लिए ज़ोर से पढ़ा जाएगा। कोई समय सीमा नहीं।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-number-world',
    emoji: '🔢',
    titleEN: 'Number World',
    titleHI: 'संख्या जगत',
    bodyEN:
      'Number World helps you practise maths using pictures and objects — not just symbols. You will count apples, group stars, and solve puzzles. You will never see a red "X" here. Mistakes show you the answer gently.',
    bodyHI:
      'संख्या जगत आपको चित्रों और वस्तुओं का उपयोग करके गणित का अभ्यास कराता है — केवल संख्याओं से नहीं। आप सेब गिनेंगे, तारों को समूहित करेंगे, और पहेलियाँ सुलझाएंगे। यहाँ कभी लाल "X" नहीं दिखेगा। गलतियाँ धीरे से सही उत्तर दिखाती हैं।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-catchup',
    emoji: '✨',
    titleEN: 'Catch-Up Courses',
    titleHI: 'कैच-अप कोर्स',
    bodyEN:
      'Catch-Up Courses are step-by-step skill ladders built just for you, based on where you need the most practice. You move to the next level only when you are ready — no rushing, no pressure.',
    bodyHI:
      'कैच-अप कोर्स चरण-दर-चरण कौशल सीढ़ियाँ हैं, जो आपके लिए बनाई गई हैं — इस आधार पर कि आपको सबसे अधिक अभ्यास कहाँ चाहिए। आप अगले स्तर पर तभी जाते हैं जब आप तैयार हों — कोई जल्दी नहीं, कोई दबाव नहीं।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-achievements',
    emoji: '🏆',
    titleEN: 'Your Achievement Wall',
    titleHI: 'आपकी उपलब्धि दीवार',
    bodyEN:
      'Tap here anytime to see everything you have learned and accomplished. You earn points and streaks just for showing up and trying — not for getting everything right. This is YOUR personal progress wall.',
    bodyHI:
      'आपने जो कुछ सीखा और हासिल किया है, उसे देखने के लिए कभी भी यहाँ टैप करें। आपको केवल आने और कोशिश करने के लिए अंक और स्ट्रीक मिलते हैं — सब कुछ सही करने के लिए नहीं। यह आपकी निजी प्रगति दीवार है।',
    position: 'top',
  },
  {
    targetId: 'walkthrough-help-button',
    emoji: '💛',
    titleEN: '"I Need Help" Button',
    titleHI: '"मुझे मदद चाहिए" बटन',
    bodyEN:
      'If you ever feel stuck, frustrated, or overwhelmed — tap this button at the bottom of the screen. It will guide you through a short breathing exercise to help you feel calm. It is always there for you.',
    bodyHI:
      'अगर आप कभी भी अटका हुआ, निराश या परेशान महसूस करें — स्क्रीन के नीचे यह बटन दबाएं। यह आपको एक छोटे साँस लेने के व्यायाम के माध्यम से शांत महसूस करने में मदद करेगा। यह हमेशा आपके लिए यहाँ है।',
    position: 'top',
  },
  {
    targetId: null,
    emoji: '🎉',
    titleEN: "You're all set!",
    titleHI: 'आप तैयार हैं!',
    bodyEN:
      "Great job! You now know your way around Saath-i. Remember: there are no timers, no scores, and no wrong answers here. Just tap 'Start' on any activity when you are ready. Happy learning!",
    bodyHI:
      'बहुत अच्छा! अब आप साथी को समझ गए हैं। याद रखें: यहाँ कोई टाइमर, कोई स्कोर, और कोई गलत जवाब नहीं है। जब आप तैयार हों, किसी भी गतिविधि पर \'शुरू\' दबाएं। खुशी से सीखें!',
    position: 'center',
  },
];

// ─── TEACHER WALKTHROUGH STEPS ────────────────────────────────────────────────
const TEACHER_STEPS = [
  {
    targetId: null,
    emoji: '🙏',
    titleEN: 'Welcome to Your Teacher Dashboard!',
    titleHI: 'आपके शिक्षक डैशबोर्ड में स्वागत है!',
    bodyEN:
      'This is your central command for supporting every student in your class. Saath-i does the heavy lifting — tracking each child\'s progress, flagging who needs attention, and drafting paperwork for you. Let us take a quick tour.',
    bodyHI:
      'यह आपकी कक्षा के हर छात्र को सहयोग देने का केंद्रीय स्थान है। साथी सारा भारी काम करता है — हर बच्चे की प्रगति ट्रैक करना, किसे ध्यान देने की जरूरत है यह बताना, और आपके लिए कागज़ी काम तैयार करना। आइए एक त्वरित दौरा करते हैं।',
    position: 'center',
  },
  {
    targetId: 'walkthrough-teacher-stats',
    emoji: '📊',
    titleEN: 'Your Class at a Glance',
    titleHI: 'एक नज़र में आपकी कक्षा',
    bodyEN:
      'These 4 boxes give you an instant summary of your class: how many students are active, how many need your attention today, the average activities completed per week, and how many students are showing improvement. Check these first every morning.',
    bodyHI:
      'ये 4 बॉक्स आपको अपनी कक्षा का तुरंत सारांश देते हैं: कितने छात्र सक्रिय हैं, आज कितनों को आपके ध्यान की जरूरत है, प्रति सप्ताह औसत गतिविधियाँ, और कितने छात्र सुधार दिखा रहे हैं। हर सुबह पहले इन्हें देखें।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-teacher-filters',
    emoji: '🔍',
    titleEN: 'Filter Your Students',
    titleHI: 'अपने छात्रों को फ़िल्टर करें',
    bodyEN:
      'Use these tabs to quickly find the students who need you most. "Needs Attention" shows children with red or yellow status. "By Tier" groups students by how much support they need (Tier 1 = some support, Tier 3 = urgent specialist referral needed).',
    bodyHI:
      'उन छात्रों को जल्दी खोजने के लिए इन टैब का उपयोग करें जिन्हें आपकी सबसे अधिक जरूरत है। "ध्यान चाहिए" लाल या पीले स्थिति वाले बच्चों को दिखाता है। "स्तर अनुसार" छात्रों को उनकी जरूरत के अनुसार समूहित करता है (स्तर 1 = थोड़ा सहयोग, स्तर 3 = तुरंत विशेषज्ञ रेफरल जरूरी)।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-student-card',
    emoji: '👤',
    titleEN: 'Reading a Student Card',
    titleHI: 'छात्र कार्ड पढ़ना',
    bodyEN:
      'Each card shows one student. The coloured dot on the left tells you their status: 🟢 Green = doing well, 🟡 Yellow = needs a check-in, 🔴 Red = needs your attention today. The badge (like "Reading Support") shows their main area of need. Tap "View Profile" to see their full details.',
    bodyHI:
      'प्रत्येक कार्ड एक छात्र दिखाता है। बाईं ओर रंगीन बिंदु उनकी स्थिति बताता है: 🟢 हरा = अच्छा कर रहे हैं, 🟡 पीला = जाँच करने की जरूरत, 🔴 लाल = आज आपके ध्यान की जरूरत। बैज (जैसे "पठन सहायता") उनकी मुख्य जरूरत का क्षेत्र दिखाता है। पूरी जानकारी के लिए "प्रोफाइल देखें" टैप करें।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-iep-button',
    emoji: '📋',
    titleEN: 'Generate an IEP in Minutes',
    titleHI: 'मिनटों में IEP बनाएं',
    bodyEN:
      'Tap "Generate IEP" on any student card to create an Individualized Education Plan for that child. Saath-i automatically fills it using the child\'s screening results, your own observations, weeks of activity data, and specialist notes — so what used to take 3–4 hours now takes minutes. You review and approve every word before it is saved.',
    bodyHI:
      'किसी भी छात्र कार्ड पर "IEP बनाएं" टैप करें ताकि उस बच्चे के लिए व्यक्तिगत शिक्षा योजना बनाई जा सके। साथी इसे स्वचालित रूप से बच्चे के स्क्रीनिंग परिणाम, आपकी अपनी टिप्पणियों, हफ्तों के गतिविधि डेटा, और विशेषज्ञ नोट्स का उपयोग करके भरता है — जो पहले 3-4 घंटे लेता था वह अब मिनटों में होता है। सहेजने से पहले आप हर शब्द की समीक्षा और अनुमोदन करते हैं।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-ai-assistant',
    emoji: '🤖',
    titleEN: 'AI Teacher Assistant',
    titleHI: 'AI शिक्षक सहायक',
    bodyEN:
      'Tap "AI Assistant" in the top bar to get personalised advice for any student. Unlike a general internet search, this assistant knows each child\'s actual support profile, error patterns, and weekly progress. Ask it things like: "What can I do in class to help Arjun with reading?" and get a specific, practical answer in seconds.',
    bodyHI:
      'किसी भी छात्र के लिए व्यक्तिगत सलाह पाने के लिए शीर्ष बार में "AI सहायक" टैप करें। एक सामान्य इंटरनेट खोज के विपरीत, यह सहायक प्रत्येक बच्चे की वास्तविक सहायता प्रोफ़ाइल, त्रुटि पैटर्न और साप्ताहिक प्रगति जानता है। इससे ऐसी बातें पूछें: "पठन में अर्जुन की मदद के लिए मैं कक्षा में क्या कर सकती हूँ?" और सेकंड में एक विशिष्ट, व्यावहारिक उत्तर पाएं।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-analytics',
    emoji: '📈',
    titleEN: 'Progress Analytics',
    titleHI: 'प्रगति विश्लेषण',
    bodyEN:
      'Tap "Analytics" to see a full picture of how your entire class is doing — which support areas have the most students struggling, who has improved this week, and individual trend graphs for each child. This replaces the notebook you used to track everything by hand.',
    bodyHI:
      '"विश्लेषण" टैप करें ताकि देख सकें आपकी पूरी कक्षा कैसा कर रही है — किस सहायता क्षेत्र में सबसे अधिक छात्र संघर्ष कर रहे हैं, इस सप्ताह कौन सुधरा, और प्रत्येक बच्चे के लिए व्यक्तिगत रुझान ग्राफ। यह उस नोटबुक की जगह लेता है जिससे आप पहले हाथ से सब कुछ ट्रैक करते थे।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-specialist-queue',
    emoji: '🩺',
    titleEN: 'Specialist Referral Queue',
    titleHI: 'विशेषज्ञ रेफरल कतार',
    bodyEN:
      'When a child\'s needs are beyond what classroom support can address, tap "Refer to Special Educator" on their card. The "Specialist Queue" button here shows you the status of all referrals — Submitted, Under Review, or Complete. You are always in control: the app never refers a child without your action.',
    bodyHI:
      'जब किसी बच्चे की जरूरतें कक्षा सहयोग से परे हों, तो उनके कार्ड पर "विशेष शिक्षक को रेफर करें" टैप करें। यहाँ "विशेषज्ञ कतार" बटन आपको सभी रेफरल की स्थिति दिखाता है — सबमिट किया, समीक्षा में, या पूर्ण। आप हमेशा नियंत्रण में हैं: ऐप आपकी कार्रवाई के बिना कभी किसी बच्चे को रेफर नहीं करता।',
    position: 'bottom',
  },
  {
    targetId: 'walkthrough-resources',
    emoji: '📚',
    titleEN: 'Resource Library',
    titleHI: 'संसाधन पुस्तकालय',
    bodyEN:
      'Tap "Resources" to find NCERT-aligned worksheets, lesson adaptation guides, and parent communication scripts — all filtered by support area, grade, and subject. These are ready to print or share, so you spend less time searching and more time teaching.',
    bodyHI:
      '"संसाधन" टैप करें ताकि NCERT-अनुरूप वर्कशीट, पाठ अनुकूलन गाइड, और अभिभावक संचार स्क्रिप्ट मिल सकें — सभी सहायता क्षेत्र, ग्रेड और विषय द्वारा फ़िल्टर की गई। ये प्रिंट करने या शेयर करने के लिए तैयार हैं, इसलिए आप कम समय खोजने में और अधिक समय पढ़ाने में लगाएं।',
    position: 'bottom',
  },
  {
    targetId: null,
    emoji: '✅',
    titleEN: "You're ready to go!",
    titleHI: 'आप जाने के लिए तैयार हैं!',
    bodyEN:
      "That's everything you need to get started. Your class data is already loaded. You can retake this tour anytime by tapping the \"?\" help button in the top bar. If you ever have questions, the AI Assistant is always there to help. Good luck!",
    bodyHI:
      'शुरू करने के लिए आपको यही सब चाहिए। आपका कक्षा डेटा पहले से लोड है। आप शीर्ष बार में "?" सहायता बटन टैप करके यह दौरा कभी भी फिर से ले सकते हैं। अगर आपके कोई प्रश्न हों, तो AI सहायक हमेशा मदद के लिए मौजूद है। शुभकामनाएं!',
    position: 'center',
  },
];

// ─── SPOTLIGHT CALCULATION ─────────────────────────────────────────────────────
// Returns { top, left, width, height } of the target element relative to the viewport.
function getElementRect(id) {
  if (!id) return null;
  const el = document.getElementById(id);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - 8,
    left: rect.left - 8,
    width: rect.width + 16,
    height: rect.height + 16,
  };
}

// ─── TOOLTIP POSITION CALCULATOR ──────────────────────────────────────────────
// Positions the card above or below the spotlight, keeping it within viewport.
function getCardStyle(rect, position, cardHeight = 280) {
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: '360px' };

  const vpW = window.innerWidth;
  const CARD_W = Math.min(360, vpW - 32);
  const PADDING = 16;

  let top, left;

  if (position === 'bottom') {
    top = rect.top + rect.height + 16;
    // If card would overflow bottom, flip to above
    if (top + cardHeight > window.innerHeight - PADDING) {
      top = rect.top - cardHeight - 16;
    }
  } else if (position === 'top') {
    top = rect.top - cardHeight - 16;
    if (top < PADDING) {
      top = rect.top + rect.height + 16;
    }
  } else {
    // center
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: `${CARD_W}px` };
  }

  // Horizontal centering on target element, clamped to viewport
  left = rect.left + rect.width / 2 - CARD_W / 2;
  left = Math.max(PADDING, Math.min(left, vpW - CARD_W - PADDING));

  return { top: `${top}px`, left: `${left}px`, maxWidth: `${CARD_W}px` };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
/**
 * WalkthroughOverlay
 *
 * Props:
 *   mode       - 'student' | 'teacher'
 *   lang       - 'EN' | 'HI'
 *   onComplete - called when the user finishes or skips the tour
 */
export default function WalkthroughOverlay({ mode, lang, onComplete }) {
  const steps = mode === 'teacher' ? TEACHER_STEPS : STUDENT_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const cardRef = useRef(null);

  const currentStep = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  // ── Scroll target into view + measure rect ──────────────────────────────
  useEffect(() => {
    const id = currentStep.targetId;
    if (!id) {
      setSpotRect(null);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Wait for scroll to settle before measuring
    const timer = setTimeout(() => {
      setSpotRect(getElementRect(id));
    }, 350);
    return () => clearTimeout(timer);
  }, [stepIndex, currentStep.targetId]);

  // ── Recalculate on resize ────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      if (currentStep.targetId) setSpotRect(getElementRect(currentStep.targetId));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentStep.targetId]);

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex(i => i + 1);
    }
  }, [isLast, onComplete]);

  const handlePrev = useCallback(() => {
    if (!isFirst) setStepIndex(i => i - 1);
  }, [isFirst]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // ── Card position ─────────────────────────────────────────────────────────
  const cardStyle = getCardStyle(spotRect, currentStep.position);

  // ── Spotlight SVG clip path ───────────────────────────────────────────────
  // Renders a full-screen dark overlay with a rounded-rect "hole" over the target.
  const SpotlightOverlay = () => {
    if (!spotRect) {
      return (
        <div
          className="fixed inset-0 bg-black/60 z-[9998]"
          aria-hidden="true"
        />
      );
    }
    const { top, left, width, height } = spotRect;
    const rx = 16; // border-radius of the cutout
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return (
      <svg
        className="fixed inset-0 z-[9998] pointer-events-none"
        width={vw}
        height={vh}
        style={{ position: 'fixed', top: 0, left: 0 }}
        aria-hidden="true"
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White = show overlay (dark) */}
            <rect width={vw} height={vh} fill="white" />
            {/* Black = cut out (transparent) — the spotlight */}
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              rx={rx}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width={vw}
          height={vh}
          fill="rgba(0,0,0,0.65)"
          mask="url(#spotlight-mask)"
        />
        {/* Glowing border around the spotlight */}
        <rect
          x={left}
          y={top}
          width={width}
          height={height}
          rx={rx}
          fill="none"
          stroke="#E87722"
          strokeWidth="2.5"
          opacity="0.9"
        />
      </svg>
    );
  };

  const title = lang === 'HI' ? currentStep.titleHI : currentStep.titleEN;
  const body  = lang === 'HI' ? currentStep.bodyHI  : currentStep.bodyEN;

  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'HI' ? 'ऐप का दौरा' : 'App walkthrough'}
    >
      {/* ── Spotlight overlay ─────────────────────────────────────────────── */}
      <SpotlightOverlay />

      {/* ── Step card ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          ref={cardRef}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed z-[10000] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 flex flex-col gap-3"
          style={{ ...cardStyle, width: cardStyle.maxWidth }}
        >
          {/* Progress bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-warm to-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Step counter + skip */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">
              {lang === 'HI'
                ? `चरण ${stepIndex + 1} / ${steps.length}`
                : `Step ${stepIndex + 1} of ${steps.length}`}
            </span>
            <button
              onClick={handleSkip}
              className="text-xs text-muted hover:text-primary transition-colors flex items-center gap-1 min-h-[32px] px-2"
              aria-label={lang === 'HI' ? 'दौरा छोड़ें' : 'Skip tour'}
            >
              <X size={12} />
              {lang === 'HI' ? 'छोड़ें' : 'Skip'}
            </button>
          </div>

          {/* Emoji + Title */}
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none flex-shrink-0" aria-hidden="true">
              {currentStep.emoji}
            </span>
            <h2 className="text-base font-bold text-primary leading-snug">{title}</h2>
          </div>

          {/* Body text */}
          <p className="text-sm text-gray-700 leading-relaxed">{body}</p>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2 mt-1">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted border-2 border-gray-200 px-4 py-2.5 rounded-xl min-h-[48px] hover:border-gray-300 hover:text-primary transition-all duration-200 flex-shrink-0"
                aria-label={lang === 'HI' ? 'पिछला' : 'Previous'}
              >
                <ChevronLeft size={16} />
                {lang === 'HI' ? 'पिछला' : 'Back'}
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 bg-warm text-white text-sm font-semibold px-4 py-2.5 rounded-xl min-h-[48px] hover:bg-orange-600 shadow-sm hover:shadow-md transition-all duration-200"
              aria-label={
                isLast
                  ? lang === 'HI' ? 'शुरू करें' : "Let's go!"
                  : lang === 'HI' ? 'अगला' : 'Next'
              }
            >
              {isLast ? (
                <>
                  <CheckCircle size={16} />
                  {lang === 'HI' ? 'शुरू करें!' : "Let's go!"}
                </>
              ) : (
                <>
                  {lang === 'HI' ? 'अगला' : 'Next'}
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`rounded-full transition-all duration-200 ${
                  i === stepIndex
                    ? 'w-5 h-2 bg-warm'
                    : i < stepIndex
                    ? 'w-2 h-2 bg-accent/50'
                    : 'w-2 h-2 bg-gray-200'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
