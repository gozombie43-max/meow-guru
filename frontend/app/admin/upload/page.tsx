import Link from "next/link";
import styles from "./upload.module.css";

const tools = [
  { 
    href: "/admin/upload/question", 
    title: "Single MCQ Creator", 
    detail: "Upload single questions with KaTeX math rendering, image attachments, cascading quiz taxonomy, and answer metadata.",
    icon: "✍️",
    gradient: "linear-gradient(135deg, #0a84ff, #5e5ce6)",
    badge: "Interactive"
  },
  { 
    href: "/admin/upload/bulk", 
    title: "Mass NDJSON Uploader", 
    detail: "High-throughput batch parser for JSON/JSONL with pre-upload DB duplication checking, data table filters, and live logs.",
    icon: "📑",
    gradient: "linear-gradient(135deg, #30d158, #0a84ff)",
    badge: "Batch Engine"
  },
  { 
    href: "/admin/upload/mock-tests", 
    title: "Mock Tests & PYQs", 
    detail: "Deploy fixed exam papers or dynamic generator slots to Cosmos DB with live section analytics and slot management.",
    icon: "🎯",
    gradient: "linear-gradient(135deg, #bf5af2, #ff375f)",
    badge: "Cosmos DB"
  },
  { 
    href: "/admin/upload/assets", 
    title: "ZIP Asset Manager", 
    detail: "Mass-upload question & solution illustrations in ZIP bundles, automatically patched by filename ID or metadata manifest.",
    icon: "🗂️",
    gradient: "linear-gradient(135deg, #ff9f0a, #ff453a)",
    badge: "Media Pipeline"
  },
];

const systemSpecs = [
  { icon: "⚡", title: "Instant KaTeX Renderer", desc: "Real-time LaTeX parsing with inline and block math support" },
  { icon: "🔍", title: "Conflict Intelligence", desc: "Identifies ID collisions and text duplicates before database writes" },
  { icon: "🚀", title: "50-Chunk Batching", desc: "Zero-timeout progressive uploads with live telemetry logging" },
  { icon: "🛡️", title: "Schema Guard", desc: "Enforces study-mode vocabulary and competitive MCQ type boundaries" },
];

export default function AdminUploadHome() {
  return (
    <div className={styles.hubContainer}>
      <header className={styles.heroHeader}>
        <div className={styles.heroContent}>
          <h1>Upload Studio</h1>
          <p>Native macOS interface for managing questions, mock test papers, and multimedia assets.</p>
        </div>
        <div className={styles.versionBadge}>
          <span>●</span>
          <span>v2.4 Production Suite</span>
        </div>
      </header>

      <section className={styles.grid} aria-label="Upload Tools">
        {tools.map((tool) => (
          <Link className={styles.card} href={tool.href} key={tool.href}>
            <div>
              <div className={styles.cardIcon} style={{ background: tool.gradient }}>
                {tool.icon}
              </div>
              <h2 className={styles.cardTitle}>{tool.title}</h2>
              <p className={styles.cardDesc}>{tool.detail}</p>
            </div>
            <div className={styles.cardFooter}>
              <span>{tool.badge}</span>
              <span className={styles.cardArrow}>Open Tool →</span>
            </div>
          </Link>
        ))}
      </section>

      <section className={styles.specPanel}>
        <div className={styles.specTitle}>System Capabilities & Engine Architecture</div>
        <div className={styles.specGrid}>
          {systemSpecs.map((spec, i) => (
            <div key={i} className={styles.specItem}>
              <span className={styles.specItemIcon}>{spec.icon}</span>
              <div>
                <h3 className={styles.specItemHeading}>{spec.title}</h3>
                <p className={styles.specItemDesc}>{spec.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
