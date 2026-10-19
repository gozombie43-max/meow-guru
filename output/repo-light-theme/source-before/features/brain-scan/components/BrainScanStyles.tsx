export function BrainScanStyles() {
  return (<style>{`
        .coach-shell {
          color: #102033;
          background:
            radial-gradient(circle at top left, rgba(251, 146, 60, 0.14), transparent 28%),
            radial-gradient(circle at top right, rgba(34, 197, 94, 0.12), transparent 24%),
            linear-gradient(180deg, #fffaf4 0%, #f5efe7 100%);
          border-radius: 24px;
          padding: 18px;
        }

        .coach-loading,
        .coach-empty {
          min-height: 220px;
          display: grid;
          place-items: center;
          text-align: center;
        }

        .scan-orb {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.8);
          font-size: 2rem;
          animation: floaty 1.8s ease-in-out infinite;
          margin-bottom: 0.75rem;
        }

        @keyframes floaty {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-6px);
          }
        }

        .empty-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 800;
        }

        .empty-copy {
          margin: 0.4rem 0 0;
          color: #617286;
          max-width: 48ch;
          line-height: 1.55;
        }

        .coach-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.9fr);
          gap: 14px;
          margin-bottom: 14px;
        }

        .hero-copy,
        .hero-card,
        .coach-panel,
        .reason-card,
        .heat-card,
        .target-card {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 16px 40px rgba(16, 32, 51, 0.07);
        }

        .hero-copy {
          border-radius: 24px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 220px;
        }

        .hero-eyebrow,
        .panel-kicker,
        .section-kicker {
          margin: 0 0 6px;
          color: #8b5e34;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .hero-copy h2 {
          margin: 0;
          max-width: 16ch;
          font-size: clamp(1.7rem, 4vw, 3rem);
          line-height: 0.98;
          letter-spacing: -0.04em;
        }

        .hero-detail {
          margin: 0.9rem 0 0;
          color: #617286;
          max-width: 54ch;
          font-size: 0.98rem;
          line-height: 1.6;
        }

        .hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }

        .hero-meta span,
        .scan-chip,
        .panel-pill,
        .target-badge,
        .hero-badge,
        .target-meta span,
        .reason-head span,
        .list-top span,
        .heat-head span,
        .topic-top span,
        .share-top strong,
        .signal-row span,
        .hero-subtle {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 0.75rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .hero-meta span {
          background: rgba(255, 255, 255, 0.82);
          color: #334155;
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .hero-card {
          border-radius: 24px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 220px;
        }

        .hero-card-top,
        .panel-head,
        .section-head,
        .reason-head,
        .heat-head,
        .topic-top,
        .target-head,
        .target-meta,
        .list-top,
        .share-top,
        .signal-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .hero-concept {
          font-size: 1.2rem;
          line-height: 1.2;
          letter-spacing: -0.03em;
        }

        .hero-copy-text,
        .hero-action p,
        .panel-copy,
        .panel-note,
        .reason-copy,
        .reason-fix,
        .list-item p,
        .target-prescription,
        .empty-panel {
          margin: 0;
          color: #617286;
          line-height: 1.55;
          font-size: 0.92rem;
        }

        .hero-action {
          padding-top: 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .hero-action span,
        .panel-kicker,
        .section-kicker {
          display: block;
        }

        .hero-action p {
          color: #102033;
          margin-top: 6px;
          font-weight: 700;
        }

        .scan-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .scan-chip {
          text-decoration: none;
          color: #334155;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 8px 24px rgba(16, 32, 51, 0.04);
        }

        .coach-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 14px;
        }

        .coach-grid-tight {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .coach-panel {
          border-radius: 22px;
          padding: 18px;
        }

        .coach-panel-accent {
          background: linear-gradient(180deg, rgba(255, 248, 239, 0.92), rgba(255, 255, 255, 0.9));
        }

        .panel-head {
          margin-bottom: 12px;
        }

        .panel-head h3,
        .section-head h3 {
          margin: 0;
          font-size: 1.05rem;
          letter-spacing: -0.03em;
        }

        .panel-note {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #102033;
          font-weight: 600;
        }

        .step-list,
        .metric-stack,
        .stack-list,
        .stack-grid,
        .target-grid,
        .topic-grid {
          display: grid;
          gap: 10px;
        }

        .step-list span {
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #102033;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .metric-row,
        .signal-row {
          padding: 10px 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
        }

        .metric-row:last-child,
        .signal-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .metric-row span,
        .signal-row span {
          color: #64748b;
          background: transparent;
          border: 0;
          padding: 0;
        }

        .metric-row strong,
        .signal-row strong {
          color: #102033;
          background: transparent;
          border: 0;
          padding: 0;
          white-space: normal;
          text-align: right;
        }

        .coaching-section {
          margin-bottom: 14px;
        }

        .section-head {
          margin-bottom: 10px;
        }

        .section-head span {
          color: #8a94a7;
          font-size: 0.78rem;
          font-weight: 700;
          align-self: center;
        }

        .reason-card,
        .heat-card,
        .target-card {
          border-radius: 20px;
          padding: 16px;
        }

        .reason-head strong,
        .heat-head strong,
        .topic-top strong,
        .target-head h4,
        .list-top strong {
          color: #102033;
          font-size: 0.94rem;
          font-weight: 800;
        }

        .reason-head span,
        .target-badge {
          color: #334155;
        }

        .reason-copy {
          margin-top: 10px;
        }

        .reason-fix,
        .list-note,
        .target-prescription {
          margin-top: 10px;
          padding: 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #102033;
          font-weight: 700;
        }

        .topic-grid {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          margin-top: 12px;
        }

        .topic-card {
          padding: 12px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.74);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }

        .topic-card p {
          margin: 6px 0 10px;
          color: #617286;
          font-size: 0.82rem;
        }

        .topic-track,
        .share-track {
          height: 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.18);
          overflow: hidden;
        }

        .topic-fill,
        .share-fill {
          height: 100%;
          border-radius: 999px;
        }

        .target-grid {
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        }

        .target-card h4 {
          margin: 4px 0 0;
          line-height: 1.25;
        }

        .target-topic {
          margin: 0;
          color: #7c2d12;
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .target-meta {
          margin-top: 12px;
        }

        .target-meta span {
          border-color: rgba(148, 163, 184, 0.18);
          background: rgba(255, 255, 255, 0.78);
        }

        .share-wrap {
          margin-top: 12px;
        }

        .share-top {
          margin-bottom: 6px;
        }

        .share-top span {
          color: #64748b;
          background: transparent;
          border: 0;
          padding: 0;
        }

        .share-top strong {
          color: #102033;
          background: transparent;
          border: 0;
          padding: 0;
        }

        .empty-panel {
          padding: 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px dashed rgba(148, 163, 184, 0.18);
        }

        @media (max-width: 960px) {
          .coach-hero,
          .coach-grid,
          .coach-grid-tight {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .coach-shell {
            padding: 14px;
            border-radius: 18px;
          }

          .hero-copy,
          .hero-card,
          .coach-panel,
          .reason-card,
          .heat-card,
          .target-card {
            border-radius: 18px;
            padding: 14px;
          }

          .hero-copy h2 {
            max-width: none;
          }

          .hero-meta,
          .scan-nav {
            gap: 6px;
          }

          .hero-meta span,
          .scan-chip {
            width: 100%;
            justify-content: center;
          }

          .section-head,
          .panel-head,
          .reason-head,
          .heat-head,
          .topic-top,
          .target-head,
          .list-top,
          .share-top,
          .signal-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .reason-head span,
          .panel-pill,
          .hero-subtle,
          .target-badge,
          .target-meta span,
          .list-top span,
          .heat-head span,
          .topic-top span {
            align-self: flex-start;
          }
        }
      `}</style>);
}
