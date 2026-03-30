import Link from "next/link";

interface FeatureCardData {
  title: string;
  href: string;
  gradient: string;
  icon: React.ReactNode;
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

const featureCards: FeatureCardData[] = [
  {
    title: "Concept Drill",
    href: "/mathematics/arithmetic/percentages/quiz?mode=concept",
    gradient: "linear-gradient(135deg, #7f5af0 0%, #3a86ff 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10" />
        <path d="M12 4v16" />
        <circle cx="12" cy="16" r="4" />
      </svg>
    ),
  },
  {
    title: "Formula Bank",
    href: "/mathematics/arithmetic/percentages/quiz?mode=formula",
    gradient: "linear-gradient(135deg, #ff7eb3 0%, #ff9f1c 100%)",
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
    title: "Speed Test",
    href: "/mathematics/arithmetic/percentages/quiz?mode=mixed",
    gradient: "linear-gradient(135deg, #4f9cff 0%, #00d4ff 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a9 9 0 1 0 9 9" />
        <path d="M12 12l5-5" />
      </svg>
    ),
  },
  {
    title: "Challenge",
    href: "/mathematics/arithmetic/percentages/quiz?mode=ai-challenge",
    gradient: "linear-gradient(135deg, #ff5f6d 0%, #ff3d9a 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 4.86L20 8l-4 3.9.95 5.6L12 15l-4.95 2.5L8 11.9 4 8l5.6-1.14L12 2z" />
      </svg>
    ),
  },
  {
    title: "Topic Mix",
    href: "/mathematics/arithmetic/percentages/quiz?mode=mixed",
    gradient: "linear-gradient(135deg, #8961ff 0%, #3fa3ff 100%)",
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
    title: "Revision",
    href: "/mathematics/arithmetic/percentages/quiz?mode=concept",
    gradient: "linear-gradient(135deg, #ff7bbf 0%, #ff8d4d 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    ),
  },
];

export default function PercentagesPage() {
  return (
    <main className="algebra-page">
      <div className="algebra-container">
        <header className="algebra-header">
          <p className="algebra-eyebrow">Mathematics</p>
          <h1 className="algebra-title">Percentages</h1>
        </header>

        <section className="promo-banner">
          <div className="banner-content">
            <p className="banner-kicker">Percentages Sprint 2026</p>
            <h2>Sharpen your percent problem-solving</h2>
            <p className="banner-subtitle">
              Master increments, decrements, conversions and profit/loss with challenge drills.
            </p>
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
        .algebra-page {
          min-height: 100vh;
          background: #f6f7fb;
          padding: 16px 14px 32px;
          font-family: "Poppins", "Inter", "Segoe UI", sans-serif;
        }

        .algebra-container {
          max-width: 1040px;
          margin: 0 auto;
        }

        .algebra-header {
          margin: 4px 2px 12px;
          animation: fade-slide 420ms ease both;
        }

        .algebra-eyebrow {
          margin: 0;
          font-size: 0.76rem;
          color: #6a7493;
          letter-spacing: 0.08em;
          font-weight: 600;
          text-transform: uppercase;
        }

        .algebra-title {
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
          background: linear-gradient(135deg, #ff7eb3 0%, #ff9f66 100%);
          box-shadow: 0 14px 32px rgba(255, 126, 179, 0.24);
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
        }

        .feature-section {
          margin-top: 8px;
          animation: fade-slide 520ms ease both;
        }

        .feature-section h2 {
          margin: 0 0 6px;
          font-size: 1.2rem;
          font-weight: 700;
          color: #1f2937;
        }

        .feature-subtitle {
          margin: 0 0 14px;
          color: #475569;
          font-size: 0.95rem;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 12px;
        }

        .feature-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          border-radius: 16px;
          color: #ffffff;
          text-decoration: none;
          min-height: 110px;
          padding: 14px;
          overflow: hidden;
          position: relative;
        }

        .feature-card:hover { transform: translateY(-2px); }

        .feature-glow {
          position: absolute;
          top: -28px;
          right: -30px;
          width: 90px;
          height: 90px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          filter: blur(6px);
          z-index: 0;
        }

        .feature-icon-wrap { position: relative; z-index: 1; }

        .feature-icon { width: 22px; height: 22px; }

        .feature-title {
          margin: 8px 0 0;
          font-weight: 700;
          font-size: 0.94rem;
          z-index: 1;
          position: relative;
        }

        @keyframes fade-slide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
