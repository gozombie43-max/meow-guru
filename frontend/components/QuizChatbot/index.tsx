"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalSurface } from "@/components/ui/Dialog";
import TutorMarkdown from "./TutorMarkdown";
import { TutorComposer, type TutorComposerHandle } from "./TutorComposer";
import { MessageWindow } from "@/components/chat/MessageWindow";
import {
  Zap,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Sparkles,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { isAxiosError } from 'axios';
import { ChatMessage, QuizChatbotProps, buildQuestionContext } from './utils';
import { generateTutorReply } from "@/features/tutor/api/tutorGateway";
import { GEMINI_TUTOR_MODEL, GEMINI_FALLBACK_MODEL, geminiErrorMessage } from './gemini';
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/500.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import './quiz-chatbot.css';

type SupportedLang = "en" | "hi" | "bn";

const LOCALIZED_CONTENT: Record<
  SupportedLang,
  {
    placeholder: string;
    contextLoaded: string;
    contextSubtitle: string;
    landingTitle: string;
    quickPrompts: string;
    landingOptions: Array<{
      title: string;
      prompt: string;
      tone: string;
    }>;
    followUps: Array<{
      label: string;
      prompt: string;
    }>;
  }
> = {
  en: {
    placeholder: "Ask anything",
    contextLoaded: "Context loaded:",
    contextSubtitle: "Ask anything about this submitted question.",
    landingTitle: "What can I help with?",
    quickPrompts: "Quick Prompts",
    landingOptions: [
      {
        title: "Explain the step-by-step solution",
        prompt: "Explain the step-by-step solution",
        tone: "g",
      },
      {
        title: "Why is the correct option right?",
        prompt: "Why is the correct option right?",
        tone: "o",
      },
      {
        title: "Give me a similar practice question",
        prompt: "Give me a similar practice question",
        tone: "p",
      },
      {
        title: "What trap should I avoid?",
        prompt: "What trap should I avoid?",
        tone: "b",
      },
      {
        title: "What is the fastest shortcut?",
        prompt: "What is the fastest shortcut?",
        tone: "y",
      },
    ],
    followUps: [
      { label: "What is the fastest shortcut?", prompt: "What is the fastest shortcut?" },
      { label: "Give me a similar practice question", prompt: "Give me a similar practice question" },
      { label: "What trap should I avoid?", prompt: "What trap should I avoid?" },
    ],
  },
  hi: {
    placeholder: "कुछ भी पूछें",
    contextLoaded: "संदर्भ लोड हुआ:",
    contextSubtitle: "इस प्रश्न के बारे में कुछ भी पूछें।",
    landingTitle: "मैं आपकी क्या मदद कर सकता हूँ?",
    quickPrompts: "त्वरित प्रश्न (Quick Prompts)",
    landingOptions: [
      {
        title: "चरण-दर-चरण समाधान समझाएं",
        prompt: "इस प्रश्न का चरण-दर-चरण समाधान समझाएं",
        tone: "g",
      },
      {
        title: "सही विकल्प क्यों सही है?",
        prompt: "यह सही विकल्प क्यों सही है? कारण बताएं",
        tone: "o",
      },
      {
        title: "अभ्यास के लिए समान प्रश्न दें",
        prompt: "अभ्यास के लिए इसी तरह का एक समान प्रश्न दें",
        tone: "p",
      },
      {
        title: "मुझे किस गलती से बचना चाहिए?",
        prompt: "इस प्रश्न में किन सामान्य गलतियों से बचना चाहिए?",
        tone: "b",
      },
      {
        title: "सबसे तेज़ शॉर्टकट क्या है?",
        prompt: "इस प्रश्न को हल करने का सबसे तेज़ शॉर्टकट ट्रिक क्या है?",
        tone: "y",
      },
    ],
    followUps: [
      { label: "सबसे तेज़ शॉर्टकट क्या है?", prompt: "इस प्रश्न का सबसे तेज़ शॉर्टकट क्या है?" },
      { label: "अभ्यास के लिए समान प्रश्न दें", prompt: "अभ्यास के लिए एक समान प्रश्न दें" },
      { label: "मुझे किस गलती से बचना चाहिए?", prompt: "इस प्रश्न में किन गलतियों से बचना चाहिए?" },
    ],
  },
  bn: {
    placeholder: "যেকোনো প্রশ্ন জিজ্ঞাসা করুন",
    contextLoaded: "প্রশ্ন লোড হয়েছে:",
    contextSubtitle: "এই প্রশ্নটি সম্পর্কে যেকোনো কিছু জিজ্ঞাসা করুন।",
    landingTitle: "আমি কীভাবে সাহায্য করতে পারি?",
    quickPrompts: "দ্রুত প্রম্পট (Quick Prompts)",
    landingOptions: [
      {
        title: "ধাপে ধাপে সমাধানটি ব্যাখ্যা করুন",
        prompt: "এই প্রশ্নটির ধাপে ধাপে সমাধানটি বিস্তারিত ব্যাখ্যা করুন",
        tone: "g",
      },
      {
        title: "সঠিক বিকল্পটি কেন সঠিক?",
        prompt: "সঠিক উত্তরটি কেন সঠিক? এর পেছনের যুক্তি ব্যাখ্যা করুন",
        tone: "o",
      },
      {
        title: "অনুশীলনের জন্য অনুরূপ প্রশ্ন দিন",
        prompt: "অনুশীলনের জন্য এই ধরণের একটি অনুরূপ প্রশ্ন দিন",
        tone: "p",
      },
      {
        title: "কোন ভুল বা ফাঁদ এড়ানো উচিত?",
        prompt: "এই প্রশ্নে সাধারণত কী ধরণের ভুল হতে পারে এবং কীভাবে তা এড়ানো যায়?",
        tone: "b",
      },
      {
        title: "সবচেয়ে দ্রুত শর্টকাট কী?",
        prompt: "এই প্রশ্নটি দ্রুত সমাধান করার শর্টকাট পদ্ধতি কী?",
        tone: "y",
      },
    ],
    followUps: [
      { label: "সবচেয়ে দ্রুত শর্টকাট কী?", prompt: "সবচেয়ে দ্রুত শর্টকাট কী?" },
      { label: "অনুশীলনের জন্য অনুরূপ প্রশ্ন দিন", prompt: "অনুশীলনের জন্য অনুরূপ প্রশ্ন দিন" },
      { label: "কোন ভুল বা ফাঁদ এড়ানো উচিত?", prompt: "কোন ভুল বা ফাঁদ এড়ানো উচিত?" },
    ],
  },
};

const ICONS_BY_TONE: Record<string, React.ReactNode> = {
  g: <Zap className="w-5 h-5 shrink-0" />,
  o: <CheckCircle2 className="w-5 h-5 shrink-0" />,
  p: <FileText className="w-5 h-5 shrink-0" />,
  b: <AlertTriangle className="w-5 h-5 shrink-0" />,
  y: <Sparkles className="w-5 h-5 shrink-0" />,
};

const FOLLOWUP_ICONS = [
  <Sparkles key="f1" className="w-4 h-4 shrink-0" />,
  <FileText key="f2" className="w-4 h-4 shrink-0" />,
  <AlertTriangle key="f3" className="w-4 h-4 shrink-0" />,
];

export default function QuizChatbot({
  isVisible,
  questionNumber,
  topicTitle,
  question,
  theme,
  activeLang = "en",
  renderTrigger,
  open: controlledOpen,
  onOpenChange,
}: QuizChatbotProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = controlledOpen ?? localOpen;
  const setIsOpen = useCallback((open: boolean) => {
    if (controlledOpen === undefined) setLocalOpen(open);
    onOpenChange?.(open);
  }, [controlledOpen, onOpenChange]);
  const isDark = theme === "dark";
  const selectedLang: SupportedLang = activeLang === "hi" || activeLang === "bn" ? activeLang : "en";

  const [isChatView, setIsChatView] = useState(false);
  const composerRef = useRef<TutorComposerHandle>(null);
  const [savedDraft, setSavedDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState(GEMINI_TUTOR_MODEL);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const conversationRef = useRef<{ context: string; history: ChatMessage[] }>({ context: '', history: [] });

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setSavedDraft(composerRef.current?.getDraft() ?? '');
    setIsOpen(false);
  }, [setIsOpen]);
  useModalSurface(modalRef, isOpen, handleClose, { initialFocus: ":scope" });

  // Follow the visible viewport when the mobile keyboard reduces available space.
  useEffect(() => {
    if (!isOpen) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (!overlayRef.current || !viewport) return;
      overlayRef.current.style.height = `${viewport.height}px`;
      overlayRef.current.style.top = `${viewport.offsetTop}px`;
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    document.body.classList.add("tutor-modal-open");
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      document.body.classList.remove("tutor-modal-open");
    };
  }, [isOpen]);

  const currentContent = LOCALIZED_CONTENT[selectedLang] || LOCALIZED_CONTENT.en;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(target) &&
        !modelButtonRef.current?.contains(target)
      ) {
        setIsModelMenuOpen(false);
      }
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(target) &&
        !addButtonRef.current?.contains(target)
      ) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const context = useMemo(
    () => buildQuestionContext(questionNumber, topicTitle, question),
    [question, questionNumber, topicTitle]
  );

  useEffect(() => {
    if (!isChatView) return;
    const node = scrollRef.current;
    if (node) {
      const latest = node.querySelector<HTMLElement>('[data-latest-response="true"]');
      if (!isLoading && latest) node.scrollTop = latest.offsetTop - node.offsetTop;
      else node.scrollTop = node.scrollHeight;
    }
  }, [messages, isLoading, isChatView]);

  if (!isVisible || !question) return null;

  async function sendMessage(nextText?: string) {
    const text = (nextText ?? '').trim();
    if (!text || isLoading) return;

    composerRef.current?.clear();
    setIsChatView(true);
    setIsAddMenuOpen(false);
    setIsModelMenuOpen(false);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const history = conversationRef.current.context === context ? conversationRef.current.history : [];
      const reply = await generateTutorReply({ context, message: text, lang: selectedLang, history, model: selectedModel, onModelUsed: setSelectedModel });
      conversationRef.current = {
        context,
        history: [...history, { role: 'user' as const, content: text }, { role: 'bot' as const, content: reply }].slice(-16),
      };
      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
    } catch (err: unknown) {
      const errorMessage =
        (selectedModel === GEMINI_TUTOR_MODEL || selectedModel === GEMINI_FALLBACK_MODEL) ? geminiErrorMessage(err) :
        (isAxiosError<{ error?: string }>(err) ? err.response?.data?.error : undefined) ||
        (err instanceof Error ? err.message : '') ||
        "I could not reach the tutor service. Check the backend connection and try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: errorMessage,
          isError: true,
          retryText: text,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const modelOptions = [
    {
      name: GEMINI_TUTOR_MODEL,
      id: GEMINI_TUTOR_MODEL,
    },
    {
      name: GEMINI_FALLBACK_MODEL,
      id: GEMINI_FALLBACK_MODEL,
    },
    {
      name: "o4-mini",
      id: "o4-mini",
    },
  ];

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setCopiedIndex(null);
    }
  };



  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setIsOpen(true))
      ) : (
        <button data-ui-button="state"
          type="button"
          className="quiz-chatbot-fab"
          onClick={() => setIsOpen(true)}
          title="Ask AI Tutor"
          aria-label="Ask AI Tutor"
        >
          <svg className="fab-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              d="M12 2C6.48 2 2 6.48 2 12C2 14.05 2.63 15.96 3.7 17.54L2.29 21.71L6.46 20.3C8.04 21.37 9.95 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
              fill="white"
              fillOpacity="0.95"
            />
            <circle cx="8.5" cy="12" r="1.3" fill="#7c6df0" />
            <circle cx="12" cy="12" r="1.3" fill="#7c6df0" />
            <circle cx="15.5" cy="12" r="1.3" fill="#7c6df0" />
          </svg>
        </button>
      )}

      {isOpen && createPortal(
        <div ref={overlayRef} className="quiz-chatbot-overlay">
          <button data-ui-decoration="true" className="tutor-backdrop" type="button" aria-label="Dismiss AI tutor" onClick={handleClose} />
          <section ref={modalRef} className="quiz-chatbot-modal" role="dialog"
            aria-modal="true" aria-labelledby="quiz-chatbot-title" tabIndex={-1}>
            <div className={`quiz-chatbot-shell${isDark ? " dark" : ""}`} data-theme={isDark ? "dark" : "light"} lang={selectedLang}>
              {(isModelMenuOpen || isAddMenuOpen) && (
                <div
                  className="tutor-menu-scrim"
                  aria-hidden="true"
                  onClick={() => {
                    setIsModelMenuOpen(false);
                    setIsAddMenuOpen(false);
                  }}
                />
              )}
              <header className="tutor-header">
                <div className="topbar">
                  <div className="topbar-brand">
                    <svg
                      className="tutor-brand-icon"
                      viewBox="0 0 50 50"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M 39.009766 3 C 37.099766 3.011 35.747422 5.3946094 35.232422 6.4746094 C 35.072422 6.7856094 35 7 35 7 C 34.847 7.076 34.703359 7.1684844 34.568359 7.2714844 C 32.077359 8.8154844 30.455 11.429 28 15 C 25.937 18 21.234 18.625 17 21 C 12.766 23.375 8 27.5 8 35 L 8 39 C 8 40.668484 6.6684839 42 5 42 C 3.3315161 42 2 40.668484 2 39 C 2 34.685185 3.1844374 31.901077 4.3320312 30.179688 C 5.4796251 28.458297 6.5136719 27.857422 6.5136719 27.857422 A 1.0001 1.0001 0 0 0 6.0273438 25.992188 A 1.0001 1.0001 0 0 0 5.4863281 26.142578 C 5.4863281 26.142578 4.0203748 27.041704 2.6679688 29.070312 C 1.3155626 31.098923 -5.9211895e-16 34.314815 0 39 C 0 41.749516 2.2504839 44 5 44 C 6.3082421 44 7.495051 43.480714 8.3886719 42.650391 C 9.0171506 44.030141 10.386487 45 12 45 L 27 45 C 27.552 45 28 44.552 28 44 C 28 41 26 40 24 40 L 23 40 C 24.67 40 27.726406 38.6015 28.691406 35.8125 L 26.099609 30.435547 C 25.859609 29.937547 26.068406 29.338609 26.566406 29.099609 C 27.060406 28.861609 27.660391 29.068406 27.900391 29.566406 L 31.09375 36.1875 C 32.55175 39.1475 34.141656 42.246828 34.847656 43.173828 C 35.672656 44.256828 36.82 45 38.125 45 L 40.998047 45 C 41.563047 45 41.993 44.54 42 44 C 42.001 43.928 41.994469 43.85425 41.980469 43.78125 C 41.713469 42.44025 40.955 41.230844 39.125 40.714844 L 36.173828 31.248047 C 38.734828 28.738047 40 26.036 40 23 C 40 20.607 39.318 18.798 39 18 L 40 18 C 45.031 18 45.786703 14.978188 45.970703 14.242188 C 46.088703 13.771187 45.85025 13.282937 45.40625 13.085938 C 45.39925 13.082937 44.653031 12.717844 44.332031 11.839844 C 43.353031 8.5588437 41.565 6.7365938 40 6.1835938 L 40 4 C 40 3.456 39.553766 2.997 39.009766 3 z M 40.617188 11.001953 C 40.924813 11.001953 41.307734 11.077766 41.615234 11.384766 C 42.230234 11.999766 41.923828 12.923828 41.923828 12.923828 C 41.923828 12.923828 40.999766 13.229234 40.384766 12.615234 C 39.769766 12.000234 40.078125 11.078125 40.078125 11.078125 C 40.078125 11.078125 40.309562 11.001953 40.617188 11.001953 z M 45 21 C 43.676 21 42.750266 21.391172 41.947266 21.826172 C 41.978266 22.204172 42 22.592 42 23 C 42 24.804 41.599984 26.530828 40.833984 28.173828 C 43.488984 27.003828 45 25 45 25 L 47.996094 25 C 48.566094 25 49.002 24.534 49 24 C 49 23.906 48.985078 23.810844 48.955078 23.714844 C 48.599078 22.544844 47.485 21 45 21 z" />
                    </svg>
                    <div id="quiz-chatbot-title" className="logo">AI Tutor</div>
                  </div>

                  <div className="topbar-right">
                    <div className="tutor-header-dropdown-wrap">
                      <button data-ui-button="state"
                        data-custom-focus="true"
                        ref={modelButtonRef}
                        type="button"
                        className="tutor-header-pill tutor-model-pill"
                        onClick={() => setIsModelMenuOpen((prev) => !prev)}
                        aria-expanded={isModelMenuOpen}
                        aria-label={`Selected model: ${selectedModel}`}
                        title={`Active Model: ${selectedModel}`}
                        disabled={isLoading}
                      >
                        <span className="model-name">{selectedModel}</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" aria-hidden="true" />
                      </button>

                      {isModelMenuOpen && (
                        <div className="tutor-dropdown-modal tutor-model-menu" ref={modelMenuRef}>
                          <div className="tutor-dropdown-title">Active AI Model</div>
                          <div className="tutor-dropdown-list">
                            {modelOptions.map((item) => (
                              <button data-ui-button="state"
                                data-custom-focus="true"
                                key={item.id}
                                type="button"
                                className={`tutor-dropdown-item tutor-menu-item${selectedModel === item.id ? " active" : ""}`}
                                onClick={() => {
                                  setSelectedModel(item.id);
                                  setIsModelMenuOpen(false);
                                }}
                              >
                                <span className="model-name">{item.name}</span>
                                {selectedModel === item.id && <Check className="w-4 h-4 text-[var(--ios-system-blue)] shrink-0" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </header>

              <div className="views">
                {!isChatView ? <div className="land">
                  <div className="lscroll">
                    <div className="ctx">
                      <div className="ctxi">Q</div>
                      <div>
                        <div className="ctxl">
                          {currentContent.contextLoaded}{" "}
                          <span>
                            Q{questionNumber} · {question.concept || topicTitle}
                            {question.exam ? ` · ${question.exam}` : ""}
                          </span>
                        </div>
                        <div className="ctxs">
                          {currentContent.contextSubtitle}
                        </div>
                      </div>
                    </div>

                    <div className="ltitle">
                      <svg
                        className="ltitle-sparkle"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path d="M12 2C12.38 2 12.71 2.25 12.82 2.61L14.62 8.48C14.81 9.09 15.29 9.57 15.9 9.76L21.77 11.56C22.13 11.67 22.38 12 22.38 12.38C22.38 12.76 22.13 13.09 21.77 13.2L15.9 15C15.29 15.19 14.81 15.67 14.62 16.28L12.82 22.15C12.71 22.51 12.38 22.76 12 22.76C11.62 22.76 11.29 22.51 11.18 22.15L9.38 16.28C9.19 15.67 8.71 15.19 8.1 15L2.23 13.2C1.87 13.09 1.62 12.76 1.62 12.38C1.62 12 1.87 11.67 2.23 11.56L8.1 9.76C8.71 9.57 9.19 9.09 9.38 8.48L11.18 2.61C11.29 2.25 11.62 2 12 2Z" transform="translate(0 -0.38)" />
                      </svg>
                      <span>{currentContent.landingTitle}</span>
                    </div>
                    <div className="opts">
                      {currentContent.landingOptions.map((option) => (
                        <button data-ui-button="state"
                          key={option.title}
                          type="button"
                          className="opt"
                          onClick={() => {
                            if (!isChatView) setIsChatView(true);
                            sendMessage(option.prompt);
                          }}
                          disabled={isLoading}
                        >
                          <div className={`oi ${option.tone}`}>{ICONS_BY_TONE[option.tone] || <Sparkles className="w-5 h-5 shrink-0" />}</div>
                          <span className="ot">{option.title}</span>
                          <span className="oa" aria-hidden="true">
                            <ChevronRight />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                : <div className="chat">
                  <div className="ca" ref={scrollRef}>
                    <details className="tutor-question">
                      <summary>Q{questionNumber} · {question.concept || topicTitle}</summary>
                      <div className="sbody"><TutorMarkdown content={question.question} /></div>
                    </details>
                    {messages.length > 0 && <div className="chat-divider">Start of conversation</div>}
                    <MessageWindow messages={messages}>
                    {(message, index) => {
                      if (message.role === "user") {
                        return (
                          <div className="mu" key={`${message.role}-${index}`}>
                            {message.content}
                          </div>
                        );
                      }

                      return (
                        <div className="ma" data-latest-response={index === messages.length - 1} key={`${message.role}-${index}`}>
                          <div className="sb">
                            <div className="sh2">
                              <span className="slbl2">{message.isError ? 'Unable to respond' : 'Solution'}</span>
                              <button data-ui-button="state"
                                type="button"
                                className="cpb"
                                onClick={() => handleCopy(message.content, index)}
                              >
                                {copiedIndex === index ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <div className="sbody" role={message.isError ? 'alert' : undefined}>
                              <TutorMarkdown content={message.content} />
                              {message.isError && message.retryText && (
                                <button type="button" data-ui-button="secondary" disabled={isLoading}
                                  onClick={() => sendMessage(message.retryText)}>
                                  Try again
                                </button>
                              )}
                            </div>
                          </div>
                          {index === messages.length - 1 && <div className="swrap">
                            <div className="swlbl">
                              {selectedLang === "bn" ? "আরও জানুন" : selectedLang === "hi" ? "आगे जानें" : "Continue exploring"}
                            </div>
                            <div className="swlist">
                              {currentContent.followUps.map((followUp, fIndex) => (
                                <button data-ui-button="state"
                                  key={followUp.label}
                                  type="button"
                                  className="chip"
                                  onClick={() => sendMessage(followUp.prompt)}
                                  disabled={isLoading}
                                >
                                  <div className="chipl">
                                    <span>{FOLLOWUP_ICONS[fIndex % FOLLOWUP_ICONS.length]}</span>
                                    {followUp.label}
                                  </div>
                                  <span className="chipa">›</span>
                                </button>
                              ))}
                            </div>
                          </div>}
                        </div>
                      );
                    }}
                    </MessageWindow>

                    <div className={`typing${isLoading ? "" : " hidden"}`} role="status" aria-label="Tutor is thinking">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div style={{ height: 12 }} />
                  </div>
                </div>}
              </div>

              <footer className="bbar">
                <TutorComposer ref={composerRef} initialDraft={savedDraft} isLoading={isLoading} currentContent={currentContent}
                  isAddMenuOpen={isAddMenuOpen} setIsAddMenuOpen={setIsAddMenuOpen}
                  addMenuRef={addMenuRef} addButtonRef={addButtonRef} iconsByTone={ICONS_BY_TONE} onSend={sendMessage} />
              </footer>
            </div>
          </section>
        </div>, document.body
      )}
    </>
  );
}
