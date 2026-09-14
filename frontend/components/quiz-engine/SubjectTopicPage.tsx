import { SubjectTopicStyles } from "@/features/quiz/components/SubjectTopicStyles";
import Link from "next/link";
import TopicPracticeModes from "@/components/quiz-engine/TopicPracticeModes.client";

export interface SubjectTopicPageProps {
  subject: "mathematics" | "reasoning" | "english" | "general-awareness";
  title: string;
  slug: string;
  questionTopic?: string;
  routeBase?: string;
  backHref?: string;
  eyebrow?: string;
  bannerKicker?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerHref?: string;
  bannerActionLabel?: string;
  bannerAriaLabel?: string;
}

/* ── SVG Icons ───────────────────────────────── */
const IconBanner = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="42"
    height="42"
    style={{ filter: "drop-shadow(0 2px 5px rgba(0, 0, 0, 0.2))" }}
  >
    <path fill="#ffadc8" d="M39,16v25c0,1.105-0.895,2-2,2H11c-1.105,0-2-0.895-2-2V7c0-1.105,0.895-2,2-2h17L39,16z" />
    <path fill="#e72636" d="M28,5v9c0,1.105,0.895,2,2,2h9L28,5z" />
    <path fill="#e72636" d="M16.738,26.99v2.531h-1.655v-7.348h2.592c1.852,0,2.777,0.781,2.777,2.342 c0,0.738-0.265,1.335-0.797,1.791c-0.531,0.456-1.241,0.684-2.129,0.684H16.738z M16.738,23.445v2.29h0.651 c0.882,0,1.322-0.386,1.322-1.159c0-0.754-0.44-1.132-1.322-1.132L16.738,23.445L16.738,23.445z" />
    <path fill="#e72636" d="M21.528,29.521v-7.348h2.603c2.61,0,3.914,1.194,3.914,3.581c0,1.145-0.356,2.058-1.068,2.741 c-0.712,0.684-1.661,1.025-2.846,1.025h-2.603V29.521z M23.183,23.521v4.657h0.82c0.717,0,1.279-0.215,1.688-0.645 c0.408-0.43,0.612-1.016,0.612-1.758c0-0.7-0.202-1.251-0.606-1.652c-0.405-0.402-0.973-0.602-1.704-0.602H23.183z" />
    <path fill="#e72636" d="M33.514,23.521h-2.593v1.803h2.383v1.343h-2.383v2.854h-1.655v-7.348h4.248V23.521z" />
  </svg>
);

const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const SUBJECT_DEFAULTS = {
  mathematics: {
    eyebrow: "Mathematics",
    formulaSubtitle: "Core formulas & shortcuts",
    headline: "Formula & Notes",
    notesSubtitle: "Shortcuts & revision sheets",
    mixedSubtitle: "Comprehensive mixture",
  },
  reasoning: {
    eyebrow: "Reasoning",
    formulaSubtitle: "Core formulas & patterns",
    headline: "Formula & Notes",
    notesSubtitle: "Shortcuts & revision sheets",
    mixedSubtitle: "Comprehensive mixture",
  },
  english: {
    eyebrow: "English",
    formulaSubtitle: "Words & vocabulary",
    headline: "Formula & Notes",
    notesSubtitle: "Shortcuts & revision sheets",
    mixedSubtitle: "Mixed practice",
  },
  "general-awareness": {
    eyebrow: "General Awareness",
    formulaSubtitle: "Important facts & dates",
    headline: "Facts & Summary Notes",
    notesSubtitle: "Quick revision & key points",
    mixedSubtitle: "Comprehensive mixture",
  },
} as const;

const STUDY_MODE_TOPICS = new Set([
  "synonyms-antonyms",
  "one-word-substitution",
  "idioms-phrases",
  "spelling-misspelled-words",
  "homonyms-homophones",
]);

export default function SubjectTopicPage({
  subject,
  title,
  slug,
  questionTopic,
  routeBase,
  backHref,
  eyebrow,
  bannerKicker,
  bannerTitle,
  bannerSubtitle,
  bannerHref,
  bannerActionLabel,
  bannerAriaLabel,
}: SubjectTopicPageProps) {
  const defaults = SUBJECT_DEFAULTS[subject];
  const hasStudyMode = subject === "english" && STUDY_MODE_TOPICS.has(slug);

  const base = routeBase ?? `/${subject}/${slug}`;
  const resolvedBackHref =
    backHref ??
    (routeBase && routeBase.includes("/") && routeBase.lastIndexOf("/") > 0
      ? routeBase.substring(0, routeBase.lastIndexOf("/"))
      : `/${subject}`);

  const headlineText = bannerTitle ?? defaults.headline;
  const subtitleText = bannerSubtitle ?? defaults.notesSubtitle;
  const notesHref = bannerHref ?? `${base}/formula-notes`;

  return (
    <>
      <SubjectTopicStyles />

      <div className="sg-page page">
        <header data-ui-chrome="header"
          className="sg-navbar"
          aria-label={`${eyebrow ?? defaults.eyebrow}: ${title}`}
        >
          <div className="sg-nav-inline">
            <Link replace href={resolvedBackHref} className="sg-back" aria-label={`Back to ${eyebrow ?? defaults.eyebrow}`}>
              <IconBack />
            </Link>
            <h1 className="sg-nav-title">{title}</h1>
          </div>
        </header>

        <div className="sg-desktop-container">
          <div className="sg-left-pane">
            {/* BANNER */}
            <div className="sg-banner-wrap">
              <Link href={notesHref} className="sg-banner" aria-label={bannerAriaLabel || bannerActionLabel || "Open formula notes"}>
                <div className="sg-banner-icon"><IconBanner /></div>
                <div className="sg-banner-body">
                  {bannerKicker ? <div className="sg-banner-kicker">{bannerKicker}</div> : null}
                  <div className="sg-banner-title">{headlineText}</div>
                  <div className="sg-banner-sub">{subtitleText}</div>
                </div>
                <div className="sg-banner-action">
                  <span className="sg-banner-open-btn">Open</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="sg-right-pane">
            {/* SECTION LABEL */}
            <div className="sg-section">Practice Modes</div>

            <TopicPracticeModes
              subject={subject}
              questionTopic={questionTopic ?? slug}
              base={base}
              formulaSubtitle={defaults.formulaSubtitle}
              mixedSubtitle={defaults.mixedSubtitle}
              hasStudyMode={hasStudyMode}
            />
          </div>
          
        </div>
      </div>
    </>
  );
}
