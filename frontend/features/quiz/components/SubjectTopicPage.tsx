import { SubjectTopicStyles } from "@/features/quiz/components/SubjectTopicStyles";
import Link from "next/link";
import Image from "next/image";
import TopicPracticeModes from "@/features/quiz/components/TopicPracticeModes.client";

export interface SubjectTopicPageProps {
  subject: "mathematics" | "reasoning" | "english" | "general-awareness" | "iit-jam-physics";
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
const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const SUBJECT_DEFAULTS = {
  "iit-jam-physics": { eyebrow: "IIT JAM Physics", formulaSubtitle: "Physics formulas & methods", headline: "Formula Notes", notesSubtitle: "Revision PDF", mixedSubtitle: "Mixed Physics practice" },
  mathematics: {
    eyebrow: "Mathematics",
    formulaSubtitle: "Core formulas & shortcuts",
    headline: "Formula Notes",
    notesSubtitle: "Revision PDF",
    mixedSubtitle: "Comprehensive mixture",
  },
  reasoning: {
    eyebrow: "Reasoning",
    formulaSubtitle: "Core formulas & patterns",
    headline: "Formula Notes",
    notesSubtitle: "Revision PDF",
    mixedSubtitle: "Comprehensive mixture",
  },
  english: {
    eyebrow: "English",
    formulaSubtitle: "Words & vocabulary",
    headline: "Formula Notes",
    notesSubtitle: "Revision PDF",
    mixedSubtitle: "Mixed practice",
  },
  "general-awareness": {
    eyebrow: "General Awareness",
    formulaSubtitle: "Important facts & dates",
    headline: "Fact Notes",
    notesSubtitle: "Revision PDF",
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
                <div className="sg-banner-icon"><Image src="/icons/practice/fact-notes.svg" alt="" width={28} height={28} aria-hidden="true" /></div>
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
            <div className="sg-section">Practice modes</div>

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
