import MathematicsTopicPage from "../_shared/topic-page";

const featureCards = [
  {
    title: "PYQ",
    href: "/mathematics/mensuration/quiz?mode=all",
    gradient: "linear-gradient(135deg, #3f8cff 0%, #00c7ff 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <circle cx="8" cy="6" r="1.5" />
        <circle cx="14" cy="12" r="1.5" />
        <circle cx="10" cy="18" r="1.5" />
      </svg>
    ),
  },
  {
    title: "CareerWill",
    href: "/mathematics/mensuration/quiz?mode=concept",
    gradient: "linear-gradient(135deg, #7f5af0 0%, #3f8cff 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10" />
        <path d="M12 4v16" />
        <circle cx="12" cy="16" r="4" />
      </svg>
    ),
  },
  {
    title: "Selection Way",
    href: "/mathematics/mensuration/quiz?mode=selection",
    gradient: "linear-gradient(135deg, #00b894 0%, #20bf6b 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h10" />
        <path d="M4 12h8" />
        <path d="M4 18h12" />
        <circle cx="18" cy="12" r="3" />
      </svg>
    ),
  },
  {
    title: "Tier 2",
    href: "/mathematics/mensuration/quiz?mode=tier2",
    gradient: "linear-gradient(135deg, #ff7eb3 0%, #ff9f1c 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8" />
        <path d="M12 3v14" />
        <path d="M7 8H4a2 2 0 0 0-2 2v1a5 5 0 0 0 5 5h1" />
        <path d="M17 8h3a2 2 0 0 1 2 2v1a5 5 0 0 1-5 5h-1" />
      </svg>
    ),
  },
] as const;

function RulerIcon() {
  return (
    <svg viewBox="0 0 120 120" className="banner-svg" fill="none">
      <rect x="24" y="34" width="72" height="52" rx="8" stroke="rgba(255,255,255,0.38)" strokeWidth="2" />
      <path d="M34 44v8M42 44v5M50 44v8M58 44v5M66 44v8M74 44v5M82 44v8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 70h52" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function MensurationPage() {
  return (
    <MathematicsTopicPage
      title="Mensuration"
      slug="mensuration"
      bannerKicker=""
      bannerTitle="Notes Formula & Tricks"
      bannerSubtitle=""
      bannerHref="/mathematics/mensuration/formula-notes"
      bannerAriaLabel="Open mensuration notes, formulas, and tricks"
      bannerGradient="linear-gradient(135deg, #4f9cff 0%, #00d2ff 100%)"
      bannerIcon={<RulerIcon />}
      featureSubtitle="Pick your mensuration mode and start a focused practice session."
      featureCards={[...featureCards]}
    />
  );
}
