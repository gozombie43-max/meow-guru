import Link from "next/link";

interface FeatureCardData {
  title: string;
  href: string;
  gradient: string;
  icon: React.ReactNode;
}

interface EnglishTopicPageProps {
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

const buildFeatureCards = (slug: string): FeatureCardData[] => {
  const cards: FeatureCardData[] = [
  {
    title: "PYQ",
    href: `/english/${slug}/quiz?mode=concept`,
    gradient: "linear-gradient(135deg, #5fcf80 0%, #2fb9a7 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4h10" />
        <path d="M12 4v16" />
        <circle cx="12" cy="16" r="4" />
      </svg>
    ),
  },
  {
    title: "Vocabulary Bank",
    href: `/english/${slug}/quiz?mode=formula`,
    gradient: "linear-gradient(135deg, #55b6ff 0%, #3f82f6 100%)",
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
    href: `/english/${slug}/quiz?mode=mixed`,
    gradient: "linear-gradient(135deg, #fbbf24 0%, #f97316 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a9 9 0 1 0 9 9" />
        <path d="M12 12l5-5" />
      </svg>
    ),
  },
  {
    title: "Selection Way",
    href: `/english/${slug}/quiz?mode=ai-challenge`,
    gradient: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 4.86L20 8l-4 3.9.95 5.6L12 15l-4.95 2.5L8 11.9 4 8l5.6-1.14L12 2z" />
      </svg>
    ),
  },
  {
    title: "Topic Mix",
    href: `/english/${slug}/quiz?mode=easy`,
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
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
    href: `/english/${slug}/quiz?mode=hard`,
    gradient: "linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)",
    icon: (
      <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    ),
  },
  ];

  if (slug === "synonyms-antonyms") {
    cards.splice(4, 0, {
      title: "Study Mode",
      href: `/english/${slug}/study-mode`,
      gradient: "linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)",
      icon: (
        <svg viewBox="0 0 24 24" className="feature-icon" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M7 9l5-4 5 4" />
          <path d="M7 15h10" />
        </svg>
      ),
    });
  }

  return cards;
};

export default function EnglishTopicPage({
  title,
  slug,
  eyebrow = "English",
  bannerKicker,
  bannerSubtitle,
}: EnglishTopicPageProps) {
  const featureCards = buildFeatureCards(slug);
  const kickerText = bannerKicker ?? `${title} Sprint 2026`;
  const headlineText = "Notes Formula & Tricks";
  const subtitleText =
    bannerSubtitle ??
    "Smart drills, quick recall, and exam-ready accuracy for stronger English scores.";

  return (
    <main className="english-topic-page">
      <div className="english-container">
        <header className="english-header">
          <p className="english-eyebrow">{eyebrow}</p>
          <h1 className="english-title">{title}</h1>
        </header>

        <Link
          href={`/english/${slug}/formula-notes`}
          className="promo-banner promo-banner-link"
          aria-label={`Open ${title} notes, formulas, and tricks`}
        >
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
        </Link>

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
        .english-topic-page {
          min-height: 100vh;
          background: #f6f7fb;
          padding: 16px 14px 32px;
          font-family: "Poppins", "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        .english-container {
          max-width: 1040px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
          min-width: 0;
        }

        .english-header {
          margin: 4px 2px 12px;
          animation: fade-slide 420ms ease both;
        }

        .english-eyebrow {
          margin: 0;
          font-size: 0.76rem;
          color: #6a7493;
          letter-spacing: 0.08em;
          font-weight: 600;
          text-transform: uppercase;
        }

        .english-title {
          margin: 4px 0 0;
          color: #202846;
          font-size: clamp(1.4rem, 1.2rem + 1vw, 2rem);
          line-height: 1.15;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .promo-banner {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          padding: 22px 18px;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          box-shadow: 0 14px 32px rgba(99, 102, 241, 0.25);
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 14px;
          margin-bottom: 22px;
          animation: fade-slide 520ms ease both;
        }

        .promo-banner-link {
          color: inherit;
          text-decoration: none;
        }

        .promo-banner-link:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.9);
          outline-offset: 3px;
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
          min-width: 0;
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
          overflow-wrap: anywhere;
        }

        .banner-subtitle {
          font-size: 0.92rem;
          line-height: 1.45;
          opacity: 0.92;
          max-width: 40ch;
          margin: 0;
          overflow-wrap: anywhere;
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
          padding: 16px 10px;
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
          max-width: calc(100% - 16px);
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

        body.theme-dark {
          background: #050713;
        }

        body.theme-dark .english-topic-page {
          color: #f8fbff;
          background:
            radial-gradient(ellipse at 16% 8%, rgba(118, 92, 255, 0.34) 0%, transparent 36%),
            radial-gradient(ellipse at 88% 28%, rgba(224, 73, 161, 0.18) 0%, transparent 34%),
            radial-gradient(ellipse at 38% 84%, rgba(42, 179, 198, 0.14) 0%, transparent 34%),
            linear-gradient(155deg, #08091b 0%, #16133a 38%, #28215d 68%, #111229 100%);
          padding: 20px 20px 40px;
          position: relative;
          overflow: hidden;
        }

        body.theme-dark .english-topic-page::before,
        body.theme-dark .english-topic-page::after {
          content: "";
          position: fixed;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(18px);
          opacity: 0.8;
        }

        body.theme-dark .english-topic-page::before {
          width: 220px;
          height: 220px;
          left: -90px;
          top: 130px;
          background: rgba(59, 130, 246, 0.18);
        }

        body.theme-dark .english-topic-page::after {
          width: 260px;
          height: 260px;
          right: -120px;
          bottom: 10%;
          background: rgba(168, 85, 247, 0.18);
        }

        body.theme-dark .english-eyebrow {
          color: rgba(199, 210, 254, 0.72);
          font-size: 0.9rem;
          letter-spacing: 0.32em;
          font-weight: 500;
        }

        body.theme-dark .english-title,
        body.theme-dark .feature-section h2 {
          color: #f8fbff;
          text-shadow: 0 1px 18px rgba(129, 140, 248, 0.18);
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        body.theme-dark .english-title {
          margin-top: 14px;
          font-size: clamp(2.35rem, 8vw, 4.6rem);
          line-height: 0.98;
        }

        body.theme-dark .english-header {
          margin: 0 0 72px;
        }

        body.theme-dark .feature-section h2 {
          font-size: clamp(1.85rem, 5.8vw, 3rem);
          line-height: 1.02;
        }

        body.theme-dark .feature-subtitle {
          color: rgba(214, 220, 255, 0.78);
          font-size: clamp(1.05rem, 3.5vw, 1.55rem);
          line-height: 1.45;
          margin: 18px 0 28px;
        }

        body.theme-dark .promo-banner {
          margin-bottom: 76px;
          padding: clamp(30px, 7vw, 70px) clamp(26px, 6vw, 68px);
          min-height: clamp(190px, 38vw, 310px);
          border-radius: clamp(34px, 7vw, 72px);
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%) !important;
          border: 1px solid rgba(205, 210, 255, 0.18);
          box-shadow:
            0 24px 60px rgba(5, 5, 24, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
          backdrop-filter: blur(22px) saturate(150%);
          -webkit-backdrop-filter: blur(22px) saturate(150%);
        }

        body.theme-dark .promo-banner::before,
        body.theme-dark .promo-banner::after {
          display: none;
        }

        body.theme-dark .banner-kicker {
          color: rgba(201, 210, 255, 0.86);
          font-size: clamp(0.82rem, 2.6vw, 1.45rem);
          letter-spacing: 0.32em;
          font-weight: 600;
          margin-bottom: 28px;
        }

        body.theme-dark .banner-content h2 {
          font-size: clamp(2rem, 5vw, 4.1rem);
          line-height: 1.02;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 26px;
        }

        body.theme-dark .banner-subtitle {
          color: rgba(238, 241, 255, 0.72);
          font-size: clamp(1.15rem, 3.8vw, 2.2rem);
          line-height: 1.45;
          max-width: 22ch;
        }

        body.theme-dark .feature-card {
          aspect-ratio: 1.08 / 1;
          min-height: 174px;
          border-radius: clamp(28px, 6vw, 58px);
          border: 1px solid rgba(150, 157, 255, 0.16);
          box-shadow:
            0 28px 58px rgba(4, 5, 22, 0.48),
            0 10px 24px rgba(87, 76, 178, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.16),
            inset 0 -1px 0 rgba(5, 7, 24, 0.26);
          gap: 28px;
        }

        body.theme-dark .feature-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 44%);
          opacity: 0.78;
          pointer-events: none;
          z-index: 0;
        }

        body.theme-dark .feature-card::after,
        body.theme-dark .feature-glow {
          display: none;
        }

        body.theme-dark .feature-card:nth-child(1) {
          background: linear-gradient(135deg, rgba(166, 48, 127, 0.74), rgba(99, 42, 119, 0.76)) !important;
        }

        body.theme-dark .feature-card:nth-child(2) {
          background: linear-gradient(135deg, rgba(82, 83, 178, 0.78), rgba(45, 51, 133, 0.82)) !important;
        }

        body.theme-dark .feature-card:nth-child(3) {
          background: linear-gradient(135deg, rgba(39, 131, 155, 0.78), rgba(27, 62, 112, 0.86)) !important;
        }

        body.theme-dark .feature-card:nth-child(4) {
          background: linear-gradient(135deg, rgba(179, 132, 57, 0.72), rgba(81, 53, 57, 0.84)) !important;
        }

        body.theme-dark .feature-card:nth-child(5) {
          background: linear-gradient(135deg, rgba(41, 145, 105, 0.72), rgba(37, 96, 102, 0.82)) !important;
        }

        body.theme-dark .feature-card:nth-child(6) {
          background: linear-gradient(135deg, rgba(172, 80, 134, 0.72), rgba(110, 66, 129, 0.82)) !important;
        }

        body.theme-dark .feature-card:hover {
          box-shadow:
            0 24px 46px rgba(2, 6, 23, 0.58),
            0 0 0 1px rgba(255, 255, 255, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        body.theme-dark .feature-icon-wrap,
        body.theme-dark .banner-illustration {
          background: linear-gradient(180deg, rgba(210, 216, 255, 0.22), rgba(184, 190, 246, 0.09));
          border-color: rgba(219, 224, 255, 0.2);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            0 14px 32px rgba(8, 8, 28, 0.18);
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }

        body.theme-dark .feature-icon-wrap {
          width: clamp(76px, 17vw, 150px);
          height: clamp(76px, 17vw, 150px);
          border-radius: clamp(24px, 5vw, 42px);
        }

        body.theme-dark .feature-icon {
          width: clamp(34px, 7vw, 62px);
          height: clamp(34px, 7vw, 62px);
        }

        body.theme-dark .feature-title {
          font-size: clamp(1.25rem, 4.2vw, 2.3rem);
          line-height: 1.05;
          font-weight: 800;
        }

        body.theme-dark .banner-illustration {
          width: clamp(76px, 15vw, 142px);
          height: clamp(76px, 15vw, 142px);
          border-radius: clamp(24px, 5vw, 42px);
        }

        body.theme-dark .rocket-svg {
          width: clamp(42px, 8vw, 80px);
          height: clamp(42px, 8vw, 80px);
        }

        body.theme-dark .feature-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(20px, 4vw, 38px);
        }

        @media (max-width: 540px) {
          body.theme-dark .english-topic-page {
            padding: 14px 14px 24px;
          }

          body.theme-dark .english-header {
            margin-bottom: 22px;
          }

          body.theme-dark .english-title {
            font-size: clamp(1.8rem, 8vw, 2.2rem);
            margin-top: 8px;
          }

          body.theme-dark .promo-banner {
            min-height: 164px;
            margin-bottom: 26px;
            padding: 20px 18px;
            border-radius: 24px;
            gap: 10px;
          }

          body.theme-dark .banner-kicker {
            font-size: 0.66rem;
            margin-bottom: 12px;
            letter-spacing: 0.24em;
          }

          body.theme-dark .banner-content h2 {
            font-size: clamp(1.35rem, 6.6vw, 1.75rem);
            margin-bottom: 12px;
          }

          body.theme-dark .banner-subtitle {
            font-size: 0.84rem;
            line-height: 1.32;
            max-width: 20ch;
          }

          body.theme-dark .banner-illustration {
            width: 58px;
            height: 58px;
            border-radius: 18px;
          }

          body.theme-dark .rocket-svg {
            width: 34px;
            height: 34px;
          }

          body.theme-dark .feature-section h2 {
            font-size: 1.35rem;
          }

          body.theme-dark .feature-subtitle {
            font-size: 0.84rem;
            line-height: 1.32;
            margin: 8px 0 14px;
          }

          body.theme-dark .feature-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          body.theme-dark .feature-card {
            aspect-ratio: auto;
            min-height: 88px;
            flex-direction: row;
            justify-content: flex-start;
            border-radius: 22px;
            gap: 14px;
            padding: 16px 18px;
            box-shadow:
              0 16px 30px rgba(4, 5, 22, 0.46),
              0 8px 18px rgba(87, 76, 178, 0.18),
              inset 0 1px 0 rgba(255, 255, 255, 0.18),
              inset 0 -1px 0 rgba(5, 7, 24, 0.28);
          }

          body.theme-dark .feature-icon-wrap {
            flex: 0 0 50px;
            width: 50px;
            height: 50px;
            border-radius: 16px;
          }

          body.theme-dark .feature-icon {
            width: 25px;
            height: 25px;
          }

          body.theme-dark .feature-title {
            font-size: 0.9rem;
            line-height: 1.15;
            max-width: none;
            text-align: left;
          }
        }

        @media (max-width: 340px) {
          body.theme-dark .english-topic-page {
            padding-left: 10px;
            padding-right: 10px;
          }

          body.theme-dark .feature-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          body.theme-dark .feature-card {
            min-height: 88px;
            padding: 16px 18px;
          }

          body.theme-dark .feature-icon-wrap {
            flex: 0 0 48px;
            width: 48px;
            height: 48px;
          }

          body.theme-dark .feature-title {
            max-width: none;
            text-align: left;
          }
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
          .english-topic-page {
            padding: 26px 20px 44px;
          }

          .english-header {
            margin-bottom: 16px;
          }

          .promo-banner {
            padding: 26px 24px;
          }

          .feature-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          body.theme-dark .english-topic-page {
            padding: 28px 28px 48px;
          }

          body.theme-dark .english-container {
            max-width: 1160px;
          }

          body.theme-dark .english-header {
            margin-bottom: 20px;
          }

          body.theme-dark .english-title {
            font-size: clamp(2.2rem, 4.2vw, 3.4rem);
            line-height: 1.02;
            max-width: 12ch;
          }

          body.theme-dark .promo-banner {
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            min-height: 220px;
            margin-bottom: 34px;
            padding: 34px 34px 34px 38px;
            border-radius: 34px;
          }

          body.theme-dark .banner-content {
            max-width: 64ch;
          }

          body.theme-dark .banner-kicker {
            font-size: 0.8rem;
            margin-bottom: 18px;
          }

          body.theme-dark .banner-content h2 {
            font-size: clamp(1.8rem, 3.4vw, 2.8rem);
            margin-bottom: 16px;
            max-width: 16ch;
          }

          body.theme-dark .banner-subtitle {
            font-size: 1rem;
            max-width: 34ch;
          }

          body.theme-dark .banner-illustration {
            width: 108px;
            height: 108px;
          }

          body.theme-dark .rocket-svg {
            width: 60px;
            height: 60px;
          }

          body.theme-dark .feature-section h2 {
            font-size: clamp(1.5rem, 2vw, 2rem);
          }

          body.theme-dark .feature-subtitle {
            font-size: 1rem;
            margin: 10px 0 18px;
            max-width: 44ch;
          }

          body.theme-dark .feature-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
          }

          body.theme-dark .feature-card {
            min-height: 132px;
            aspect-ratio: 1 / 1;
            border-radius: 24px;
            gap: 14px;
            padding: 18px 14px;
          }

          body.theme-dark .feature-icon-wrap {
            width: 56px;
            height: 56px;
            border-radius: 18px;
          }

          body.theme-dark .feature-icon {
            width: 30px;
            height: 30px;
          }

          body.theme-dark .feature-title {
            font-size: 0.94rem;
            line-height: 1.15;
          }
        }

        @media (min-width: 1320px) {
          body.theme-dark .feature-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
          }

          body.theme-dark .feature-card {
            min-height: 124px;
          }
        }
      `}</style>
    </main>
  );
}
