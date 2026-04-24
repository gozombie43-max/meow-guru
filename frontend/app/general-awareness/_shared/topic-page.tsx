import Link from "next/link";

interface FeatureCardData {
  title: string;
  href: string;
  gradient: string;
  icon: React.ReactNode;
}

interface GeneralAwarenessTopicPageProps {
  title: string;
  slug: string;
  eyebrow?: string;
  bannerKicker?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
}

function FeatureCard({ title, href, gradient, icon }: FeatureCardData) {
  return (
    <Link href={href} className="feature-card" style={{ background: gradient }}>
      <div className="feature-glow" aria-hidden="true" />
      <div className="feature-icon-wrap" aria-hidden="true">
        {icon}
      </div>
      <p className="feature-title">{title}</p>
    </Link>
  );
}

const buildFeatureCards = (slug: string): FeatureCardData[] => [
  {
    title: "PYQ",
    href: `/general-awareness/${slug}/quiz?mode=concept`,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #fb7185 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10" />
        <path d="M12 4v16" />
        <circle cx="12" cy="16" r="4" />
      </svg>
    ),
  },
  {
    title: "Fact Bank",
    href: `/general-awareness/${slug}/quiz?mode=formula`,
    gradient: "linear-gradient(135deg, #38bdf8 0%, #22c55e 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </svg>
    ),
  },
  {
    title: "PW",
    href: `/general-awareness/${slug}/quiz?mode=mixed`,
    gradient: "linear-gradient(135deg, #60a5fa 0%, #6366f1 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a9 9 0 1 0 9 9" />
        <path d="M12 12l5-5" />
      </svg>
    ),
  },
  {
    title: "Selection Way",
    href: `/general-awareness/${slug}/quiz?mode=ai-challenge`,
    gradient: "linear-gradient(135deg, #f97316 0%, #f43f5e 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 4.86L20 8l-4 3.9.95 5.6L12 15l-4.95 2.5L8 11.9 4 8l5.6-1.14L12 2z" />
      </svg>
    ),
  },
  {
    title: "Topic Mix",
    href: `/general-awareness/${slug}/quiz?mode=mixed`,
    gradient: "linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
        <circle cx="8" cy="7" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="11" cy="17" r="1.5" />
      </svg>
    ),
  },
  {
    title: "Tier 2",
    href: `/general-awareness/${slug}/quiz?mode=concept`,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #facc15 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    ),
  },
];

export default function GeneralAwarenessTopicPage({
  title,
  slug,
  eyebrow = "General Awareness",
  bannerKicker,
  bannerTitle,
  bannerSubtitle,
}: GeneralAwarenessTopicPageProps) {
  const featureCards = buildFeatureCards(slug);
  const kickerText = bannerKicker ?? `${title} Sprint 2026`;
  const headlineText = bannerTitle ?? `Explore ${title} with daily missions`;
  const subtitleText =
    bannerSubtitle ??
    "Quick facts, smart recall, and exam-ready insight for higher GA scores.";

  return (
    <main className="ga-topic-page">
      <div className="ga-container">
        <header className="ga-header">
          <p className="ga-eyebrow">{eyebrow}</p>
          <h1 className="ga-title">{title}</h1>
        </header>

        <section className="promo-banner">
          <div className="banner-content">
            <p className="banner-kicker">{kickerText}</p>
            <h2>{headlineText}</h2>
            <p className="banner-subtitle">{subtitleText}</p>
          </div>

          <div className="banner-illustration" aria-hidden="true">
            <svg viewBox="0 0 120 120" className="rocket-svg" fill="none">
              <circle cx="60" cy="60" r="38" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
              <path d="M60 28l10 26h22l-18 14 7 23-21-14-21 14 7-23-18-14h22L60 28z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        <section className="feature-section">
          <h2>Explore Features</h2>
          <p className="feature-subtitle">Pick a mode and begin your personalized practice flow.</p>

          <div className="feature-grid">
            {featureCards.map((card) => (
              <FeatureCard key={card.title} {...card} />
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .ga-topic-page {
          min-height: 100vh;
          background: #f6f7fb;
          padding: 16px 14px 32px;
          font-family: "Poppins", "Segoe UI", sans-serif;
        }

        .ga-container {
          max-width: 1040px;
          margin: 0 auto;
        }

        .ga-header {
          margin: 4px 2px 12px;
          animation: fade-slide 420ms ease both;
        }

        .ga-eyebrow {
          margin: 0;
          font-size: 0.76rem;
          color: #6a7493;
          letter-spacing: 0.08em;
          font-weight: 600;
          text-transform: uppercase;
        }

        .ga-title {
          margin: 4px 0 0;
          color: #202846;
          font-size: clamp(1.4rem, 1.2rem + 1vw, 2rem);
          line-height: 1.15;
          font-weight: 700;
        }

        .promo-banner {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          padding: 22px 18px;
          background: linear-gradient(135deg, #f59e0b 0%, #f97316 55%, #f43f5e 100%);
          box-shadow: 0 14px 32px rgba(249, 115, 22, 0.25);
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          margin-bottom: 22px;
          animation: fade-slide 520ms ease both;
        }

        .promo-banner::before,
        .promo-banner::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          background: rgba(255, 255, 255, 0.22);
          filter: blur(0.4px);
        }

        .promo-banner::before {
          width: 130px;
          height: 130px;
          top: -48px;
          right: -26px;
        }

        .promo-banner::after {
          width: 90px;
          height: 90px;
          bottom: -34px;
          left: -22px;
        }

        .banner-content {
          position: relative;
          z-index: 1;
          color: #fff;
        }

        .banner-kicker {
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.9;
          margin-bottom: 6px;
        }

        .banner-content h2 {
          font-size: clamp(1.2rem, 2vw + 0.9rem, 2rem);
          line-height: 1.2;
          margin: 0 0 8px;
          font-weight: 700;
        }

        .banner-subtitle {
          font-size: 0.92rem;
          line-height: 1.45;
          opacity: 0.92;
          max-width: 40ch;
          margin: 0;
        }

        .banner-illustration {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          align-self: center;
          position: relative;
          z-index: 1;
          backdrop-filter: blur(3px);
        }

        .rocket-svg {
          width: 44px;
          height: 44px;
        }

        .feature-section h2 {
          margin: 0;
          color: #1f2a44;
          font-weight: 650;
          font-size: 1.1rem;
          letter-spacing: 0.01em;
          animation: fade-slide 620ms ease both;
        }

        .feature-subtitle {
          margin: 6px 0 14px;
          color: #68738f;
          font-size: 0.9rem;
          line-height: 1.4;
          animation: fade-slide 680ms ease both;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .feature-card {
          position: relative;
          border-radius: 18px;
          aspect-ratio: 1 / 1;
          min-height: 140px;
          text-decoration: none;
          color: #fff;
          box-shadow: 0 12px 22px rgba(76, 95, 179, 0.24);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          overflow: hidden;
          transition: transform 0.26s ease, box-shadow 0.26s ease, filter 0.26s ease;
          isolation: isolate;
          animation: card-in 540ms ease both;
        }

        .feature-card:nth-child(1) { animation-delay: 80ms; }
        .feature-card:nth-child(2) { animation-delay: 130ms; }
        .feature-card:nth-child(3) { animation-delay: 180ms; }
        .feature-card:nth-child(4) { animation-delay: 230ms; }
        .feature-card:nth-child(5) { animation-delay: 280ms; }
        .feature-card:nth-child(6) { animation-delay: 330ms; }

        .feature-card::after {
          content: "";
          position: absolute;
          width: 90px;
          height: 90px;
          border-radius: 999px;
          top: -22px;
          right: -22px;
          background: rgba(255, 255, 255, 0.18);
          z-index: 0;
        }

        .feature-glow {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 999px;
          left: -24px;
          bottom: -30px;
          background: rgba(255, 255, 255, 0.15);
          filter: blur(2px);
          z-index: 0;
        }

        .feature-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        .feature-icon {
          width: 30px;
          height: 30px;
          color: #ffffff;
        }

        .feature-title {
          margin: 0;
          font-size: 0.94rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .feature-card:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 18px 30px rgba(70, 88, 166, 0.34);
          filter: saturate(1.05);
        }

        .feature-card:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.8);
          outline-offset: 2px;
        }

        @keyframes fade-slide {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes card-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (min-width: 640px) {
          .ga-topic-page {
            padding: 26px 20px 44px;
          }

          .ga-header {
            margin-bottom: 16px;
          }

          .promo-banner {
            padding: 26px 24px;
          }

          .feature-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      `}</style>
    </main>
  );
}
