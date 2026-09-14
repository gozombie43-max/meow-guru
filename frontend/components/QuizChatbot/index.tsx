"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackLayer } from "@/hooks/useAppNavigation";
import TutorMarkdown from "./TutorMarkdown";
import {
  Sun,
  Moon,
  X,
  Plus,
  Zap,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Sparkles,
  ArrowUp,
  ArrowLeft,
  Check,
  ChevronDown,
} from "lucide-react";
import api from '@/lib/axios';
import { isAxiosError } from 'axios';
import { ChatMessage, QuizChatbotProps, buildQuestionContext } from './utils';
import './quiz-chatbot.css';

type SupportedLang = "en" | "hi" | "bn";

const LANG_OPTIONS: { code: SupportedLang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "bn", label: "বাংলা" },
];

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
      subtitle: string;
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
        subtitle: "Get a clear, detailed solution in steps.",
        prompt: "Explain the step-by-step solution",
        tone: "g",
      },
      {
        title: "Why is the correct option right?",
        subtitle: "Understand the logic and reasoning.",
        prompt: "Why is the correct option right?",
        tone: "o",
      },
      {
        title: "Give me a similar practice question",
        subtitle: "Practice with a similar type of question.",
        prompt: "Give me a similar practice question",
        tone: "p",
      },
      {
        title: "What trap should I avoid?",
        subtitle: "Learn common mistakes and how to avoid them.",
        prompt: "What trap should I avoid?",
        tone: "b",
      },
      {
        title: "What is the fastest shortcut?",
        subtitle: "Get quick tricks to solve faster.",
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
        subtitle: "सरल चरणों में स्पष्ट समाधान प्राप्त करें।",
        prompt: "इस प्रश्न का चरण-दर-चरण समाधान समझाएं",
        tone: "g",
      },
      {
        title: "सही विकल्प क्यों सही है?",
        subtitle: "तर्क और कारण को गहराई से समझें।",
        prompt: "यह सही विकल्प क्यों सही है? कारण बताएं",
        tone: "o",
      },
      {
        title: "अभ्यास के लिए समान प्रश्न दें",
        subtitle: "इसी तरह के नए प्रश्न के साथ अभ्यास करें।",
        prompt: "अभ्यास के लिए इसी तरह का एक समान प्रश्न दें",
        tone: "p",
      },
      {
        title: "मुझे किस गलती से बचना चाहिए?",
        subtitle: "सामान्य गलतियों और ट्रैप्स को समझें।",
        prompt: "इस प्रश्न में किन सामान्य गलतियों से बचना चाहिए?",
        tone: "b",
      },
      {
        title: "सबसे तेज़ शॉर्टकट क्या है?",
        subtitle: "तेज़ी से हल करने के शॉर्टकट ट्रिक्स सीखें।",
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
        subtitle: "সহজ ধাপে স্পষ্ট ও বিস্তারিত সমাধান পান।",
        prompt: "এই প্রশ্নটির ধাপে ধাপে সমাধানটি বিস্তারিত ব্যাখ্যা করুন",
        tone: "g",
      },
      {
        title: "সঠিক বিকল্পটি কেন সঠিক?",
        subtitle: "যুক্তি ও কারণটি পরিষ্কারভাবে বুঝুন।",
        prompt: "সঠিক উত্তরটি কেন সঠিক? এর পেছনের যুক্তি ব্যাখ্যা করুন",
        tone: "o",
      },
      {
        title: "অনুশীলনের জন্য অনুরূপ প্রশ্ন দিন",
        subtitle: "একই ধরণের নতুন প্রশ্ন দিয়ে প্র্যাকটিস করুন।",
        prompt: "অনুশীলনের জন্য এই ধরণের একটি অনুরূপ প্রশ্ন দিন",
        tone: "p",
      },
      {
        title: "কোন ভুল বা ফাঁদ এড়ানো উচিত?",
        subtitle: "সাধারণ ভুল এবং ট্র্যাপ সম্পর্কে জানুন।",
        prompt: "এই প্রশ্নে সাধারণত কী ধরণের ভুল হতে পারে এবং কীভাবে তা এড়ানো যায়?",
        tone: "b",
      },
      {
        title: "সবচেয়ে দ্রুত শর্টকাট কী?",
        subtitle: "কম সময়ে সমাধান করার সহজ ট্রিক জানুন।",
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
}: QuizChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(theme === "dark");

  const initialLang: SupportedLang = activeLang === "hi" || activeLang === "bn" ? activeLang : "en";
  const [languageChoice, setLanguageChoice] = useState({ source: activeLang, value: initialLang });
  const selectedLang = languageChoice.source === activeLang ? languageChoice.value : initialLang;
  const setSelectedLang = (value: SupportedLang) => setLanguageChoice({ source: activeLang, value });

  useEffect(() => {
    if (theme) {
      const timer = window.setTimeout(() => setIsDark(theme === "dark"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [theme]);

  const [isChatView, setIsChatView] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState("o4-mini");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => setIsOpen(false), []);
  useBackLayer(isOpen, handleClose);

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
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
    };
  }, [isOpen]);

  const currentContent = LOCALIZED_CONTENT[selectedLang] || LOCALIZED_CONTENT.en;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 26), 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (modelMenuRef.current && !modelMenuRef.current.contains(target)) {
        setIsModelMenuOpen(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(target)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    const focusable = () => Array.from(modal?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]'
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlayRef.current)
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });
    modal?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      previousFocus?.focus();
    };
  }, [isOpen]);

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
    const text = (nextText ?? input).trim();
    if (!text || isLoading) return;

    setInput("");
    setIsAddMenuOpen(false);
    setIsModelMenuOpen(false);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const response = await api.post(
        '/api/ai/tutor-chat',
        {
          context,
          message: text,
          mode: "chat",
          model: selectedModel,
          lang: selectedLang,
        },
        {
          timeout: 60000,
        }
      );

      const reply =
        response.data?.reply ||
        response.data?.explanation ||
        "I could not generate a response. Please try again.";
      setMessages((prev) => [...prev, { role: "bot", content: reply }]);
    } catch (err: unknown) {
      const errorMessage =
        (isAxiosError<{ error?: string }>(err) ? err.response?.data?.error : undefined) ||
        (err instanceof Error ? err.message : '') ||
        "I could not reach the tutor service. Check the backend connection and try again.";
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const modelOptions = [
    {
      name: "o4-mini",
      tier: "Azure AI",
      id: "o4-mini",
      description: "Active reasoning engine for SSC & CAT solutions",
    },
  ];

  const hasInput = input.trim().length > 0;

  const handleSend = () => {
    if (!hasInput || isLoading) return;
    if (!isChatView) setIsChatView(true);
    sendMessage();
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setCopiedIndex(null);
    }
  };

  const renderInputCard = () => (
    <div className="tutor-composer-card">
      {isAddMenuOpen && (
        <div className="tutor-quick-menu" ref={addMenuRef}>
          <div className="tutor-menu-header">{currentContent.quickPrompts}</div>
          {currentContent.landingOptions.map((option) => (
            <button data-ui-button="state"
              key={option.title}
              type="button"
              className="tutor-menu-item"
              onClick={() => {
                setIsAddMenuOpen(false);
                if (!isChatView) setIsChatView(true);
                sendMessage(option.prompt);
              }}
              disabled={isLoading}
            >
              <span className="tutor-menu-icon">{ICONS_BY_TONE[option.tone] || <Sparkles className="w-5 h-5 shrink-0" />}</span>
              <span className="tutor-menu-text">{option.title}</span>
            </button>
          ))}
        </div>
      )}

      {isModelMenuOpen && (
        <div className="tutor-model-menu" ref={modelMenuRef}>
          <div className="tutor-menu-heading">
            <div className="tutor-menu-header">Active AI Model</div>
            <button
              type="button"
              data-ui-button="state"
              className="closebtn"
              aria-label="Close model menu"
              onClick={() => setIsModelMenuOpen(false)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {modelOptions.map((item) => (
            <button data-ui-button="state"
              key={item.id}
              type="button"
              className={`tutor-menu-item${selectedModel === item.id ? " active" : ""}`}
              onClick={() => {
                setSelectedModel(item.id);
                setIsModelMenuOpen(false);
              }}
            >
              <div className="tutor-model-item-text">
                <div className="model-title-row">
                  <span className="model-name">{item.name}</span>
                  <span className="model-badge">{item.tier}</span>
                </div>
                <span className="model-desc">{item.description}</span>
              </div>
              {selectedModel === item.id && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      <button data-ui-button="state"
        type="button"
        className={`tutor-plus-btn${isAddMenuOpen ? " active" : ""}`}
        onClick={() => setIsAddMenuOpen((prev) => !prev)}
        aria-expanded={isAddMenuOpen}
        aria-label="Quick prompts"
        title="Quick prompts"
      >
        <Plus className="w-4.5 h-4.5" />
      </button>
      <span className="tutor-input-divider" aria-hidden="true" />
      <textarea
        ref={textareaRef}
        className="tutor-textarea"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            handleSend();
          }
        }}
        placeholder={currentContent.placeholder}
        rows={1}
        disabled={isLoading}
        aria-label={currentContent.placeholder}
      />

      <button data-ui-button="state"
        type="button"
        className="tutor-model-pill"
        onClick={() => setIsModelMenuOpen((prev) => !prev)}
        aria-expanded={isModelMenuOpen}
        aria-label={`Selected model: ${selectedModel}`}
        title="Active Model: o4-mini (Azure AI)"
      >
        <span className="model-name">o4-mini</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <button data-ui-button="state"
        type="button"
        className={`tutor-send-btn${hasInput && !isLoading ? " ready" : ""}`}
        onClick={handleSend}
        aria-label="Send message"
        disabled={isLoading || !hasInput}
      >
        <ArrowUp className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );

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
            <div className={`quiz-chatbot-shell${isDark ? " dark" : ""}`} data-theme={isDark ? "dark" : "light"}>
              <header className="tutor-header">
                <div className="topbar">
                  <div id="quiz-chatbot-title" className="logo">AI Tutor</div>
                  <div className="topbar-left">
                    <select
                      className="tutor-language-select"
                      aria-label="Response language"
                      value={selectedLang}
                      onChange={(event) => setSelectedLang(event.target.value as SupportedLang)}
                    >
                      {LANG_OPTIONS.map((item) => (
                        <option key={item.code} value={item.code}>{item.label}</option>
                      ))}
                    </select>
                    <div className="tutor-lang-toggle" role="group" aria-label="Response language">
                      {LANG_OPTIONS.map((item) => (
                        <button data-ui-button="state"
                          key={item.code}
                          type="button"
                          className={`tutor-lang-btn${selectedLang === item.code ? " active" : ""}`}
                          onClick={() => setSelectedLang(item.code)}
                          aria-label={item.label}
                          aria-pressed={selectedLang === item.code}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="top-actions">
                    <button data-ui-button="state"
                      type="button"
                      className="dmbtn"
                      onClick={() => setIsDark((prev) => !prev)}
                      title="Toggle dark mode"
                      aria-label="Toggle dark mode"
                    >
                      {isDark ? (
                        <Sun className="w-4 h-4 text-sky-500 shrink-0" />
                      ) : (
                        <Moon className="w-4 h-4 text-sky-500 shrink-0" />
                      )}
                    </button>
                    <button data-ui-button="state"
                      type="button"
                      className="closebtn"
                      onClick={handleClose}
                      title="Back to quiz"
                      aria-label="Back to quiz"
                    >
                      <ArrowLeft className="w-4.5 h-4.5 shrink-0" />
                    </button>
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

                    <div className="ltitle">{currentContent.landingTitle}</div>
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
                          <div>
                            <span className="ot">{option.title}</span>
                            <span className="os">{option.subtitle}</span>
                          </div>
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
                    {messages.map((message, index) => {
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
                              <span className="slbl2">Solution</span>
                              <button data-ui-button="state"
                                type="button"
                                className="cpb"
                                onClick={() => handleCopy(message.content, index)}
                              >
                                {copiedIndex === index ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <div className="sbody">
                              <TutorMarkdown content={message.content} />
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
                    })}

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
                {renderInputCard()}
              </footer>
            </div>
          </section>
        </div>, document.body
      )}
    </>
  );
}
