"use client";

import { type ReactNode, useEffect, useState, Fragment } from "react";
import styles from "./AdminTool.module.css";
import { QUIZ_TREE, SUBJECT_TOPICS } from "@/lib/quiz-constants";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const fields = ["questionImage", "optionAImage", "optionBImage", "optionCImage", "optionDImage", "solutionImage"] as const;
type ImageField = (typeof fields)[number];
type Images = Partial<Record<ImageField, File>>;

function renderMath(text: string) {
  if (!text) return <span style={{ color: "#86868b", fontSize: 13, fontStyle: "italic" }}>Awaiting input…</span>;
  const safeInput = text.replace(/\\\$/g, '__DOLLAR__');
  const regex = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^\n$]+?)\$/g;
  const parts = [];
  let lastIndex = 0, match = null;
  while ((match = regex.exec(safeInput)) !== null) {
    if (match.index > lastIndex) parts.push({ type: 'text', content: safeInput.slice(lastIndex, match.index) });
    if (match[1] !== undefined)      parts.push({ type: 'display', content: match[1].trim() });
    else if (match[2] !== undefined) parts.push({ type: 'inline',  content: match[2].trim() });
    else if (match[3] !== undefined) parts.push({ type: 'display', content: match[3].trim() });
    else if (match[4] !== undefined) parts.push({ type: 'inline',  content: match[4].trim() });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < safeInput.length) parts.push({ type: 'text', content: safeInput.slice(lastIndex) });

  return parts.map((part, i) => {
    const content = part.content.replace(/__DOLLAR__/g, '$');
    if (part.type === 'text') {
      return <Fragment key={i}>{content.split('\n').map((line, j) => <Fragment key={j}>{line}{j < content.split('\n').length - 1 && <br/>}</Fragment>)}</Fragment>;
    }
    const mathContent = content.replace(/(\d+)\s*\/\s*(\d+)/g, '\\tfrac{$1}{$2}');
    if (part.type === 'display') return <div key={i} style={{ margin: "10px 0", textAlign: "center" }}><BlockMath math={mathContent} errorColor="#dc2626" /></div>;
    return <InlineMath key={i} math={mathContent} errorColor="#dc2626" />;
  });
}

export default function QuestionUploadForm({ backLink }: { backLink?: ReactNode }) {
  const [secret, setSecret] = useState("");
  const [form, setForm] = useState({ subject: "", tier: "", exam: "", chapter: "", concept: "", formula: "", trapType: "", tags: "", difficulty: "medium", question: "", options: ["", "", "", ""], correctIndex: "0", solution: "", quizSubject: "", quizTopic: "", quizName: "" });
  const [images, setImages] = useState<Images>({});
  const [imageUrls, setImageUrls] = useState<Partial<Record<ImageField, string>>>({});
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setSecret(localStorage.getItem("adminSecret") || ""), []);
  const change = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const updateOption = (index: number, value: string) => setForm((old) => ({ ...old, options: old.options.map((option, i) => i === index ? value : option) }));

  const availableQuizTopics = form.quizSubject && QUIZ_TREE[form.quizSubject] ? Object.keys(QUIZ_TREE[form.quizSubject].topics) : [];
  const availableQuizNames = form.quizSubject && form.quizTopic && QUIZ_TREE[form.quizSubject]?.topics[form.quizTopic] ? QUIZ_TREE[form.quizSubject].topics[form.quizTopic].quizzes : [];
  const availableChapters = form.subject && SUBJECT_TOPICS[form.subject] ? SUBJECT_TOPICS[form.subject] : [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!secret.trim()) return setStatus({ text: "Enter the admin secret key first.", error: true });
    if (!form.quizSubject || !form.quizTopic || !form.quizName) return setStatus({ text: "Please select a target quiz category.", error: true });
    if (!form.question.trim() && !images.questionImage && !imageUrls.questionImage?.trim()) return setStatus({ text: "Add question text or attach a question image.", error: true });
    if (form.options.some((option, index) => !option.trim() && !images[fields[index + 1] as ImageField] && !imageUrls[fields[index + 1]]?.trim())) return setStatus({ text: "Provide all four options as text or images.", error: true });
    setSaving(true); setStatus(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key !== "options" && key !== "question" && key !== "solution") {
           body.append(key, typeof value === "string" ? value : JSON.stringify(value));
        }
      });
      const withUrl = (text: string, field: ImageField) => imageUrls[field]?.trim() ? `${text.trim()}${text.trim() ? "\n\n" : ""}![image](${imageUrls[field].trim()})` : text;
      
      body.set("questionText", withUrl(form.question, "questionImage"));
      body.set("optionAText", withUrl(form.options[0], "optionAImage"));
      body.set("optionBText", withUrl(form.options[1], "optionBImage"));
      body.set("optionCText", withUrl(form.options[2], "optionCImage"));
      body.set("optionDText", withUrl(form.options[3], "optionDImage"));
      body.set("solutionText", withUrl(form.solution, "solutionImage"));
      
      Object.entries(images).forEach(([key, file]) => file && body.append(key, file));
      
      const response = await fetch(`${API}/api/questions`, { method: "POST", headers: { "x-admin-secret": secret.trim() }, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);
      localStorage.setItem("adminSecret", secret.trim());
      setStatus({ text: `Question created successfully${data.question?.id ? `: #${data.question.id}` : ""}.` });
      setForm((old) => ({ ...old, question: "", options: ["", "", "", ""], solution: "" }));
      setImages({}); setImageUrls({});
    } catch (error) { setStatus({ text: error instanceof Error ? error.message : "Upload failed.", error: true }); }
    finally { setSaving(false); }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Single Question Creator</h1>
          <p className={styles.pageSubtitle}>Author individual MCQs with real-time KaTeX math rendering, image attachments, and taxonomy.</p>
        </div>
      </header>

      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        {/* Admin Secret Section */}
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>🔒 Authentication</h2>
          </div>
          <div style={{ maxWidth: 360 }}>
            <label className={styles.fieldLabel}>
              Admin Secret Key
              <input 
                value={secret} 
                onChange={(e) => setSecret(e.target.value)} 
                type="password" 
                autoComplete="off" 
                placeholder="Enter ADMIN_SECRET" 
                className={styles.macInput} 
              />
            </label>
          </div>
        </section>
        
        {/* Quiz Target Section */}
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>📂 Quiz Taxonomy &amp; Placement</h2>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              Quiz Subject
              <select 
                value={form.quizSubject} 
                onChange={(e) => { change("quizSubject", e.target.value); change("quizTopic", ""); change("quizName", ""); }} 
                className={styles.macSelect}
              >
                <option value="">Select subject</option>
                {Object.keys(QUIZ_TREE).map(k => <option key={k} value={k}>{QUIZ_TREE[k].label}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Quiz Topic
              <select 
                value={form.quizTopic} 
                onChange={(e) => { change("quizTopic", e.target.value); change("quizName", ""); }} 
                disabled={!form.quizSubject} 
                className={styles.macSelect}
              >
                <option value="">Select topic</option>
                {availableQuizTopics.map(k => <option key={k} value={k}>{QUIZ_TREE[form.quizSubject!].topics[k].label}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Target Quiz
              <select 
                value={form.quizName} 
                onChange={(e) => change("quizName", e.target.value)} 
                disabled={!form.quizTopic} 
                className={styles.macSelect}
              >
                <option value="">Select quiz</option>
                {availableQuizNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>
        </section>

        {/* Study Mode Blueprint Prototype Notice */}
        <section className={styles.macGroup} style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <div className={styles.macGroupHeader} style={{ borderColor: "#dcfce7" }}>
            <h2 className={styles.macGroupTitle} style={{ color: "#15803d" }}>📖 Study Mode Schema Blueprint</h2>
          </div>
          <p style={{ fontSize: 12.5, color: "#166534", margin: "0 0 10px", lineHeight: 1.4 }}>
            For vocabulary pairs (Synonyms &amp; Antonyms), ingest via <strong>Mass Upload</strong> with this schema:
          </p>
          <pre style={{ margin: 0, padding: 12, background: "#ffffff", borderRadius: 8, fontSize: 11.5, color: "#14532d", overflowX: "auto", border: "1px solid #bbf7d0", fontFamily: "SF Mono, Menlo, monospace" }}>{`{
  "id": "vocab_0001",
  "topic": "anto-syno",
  "subject": "english",
  "word": "abandon",
  "meanings": [
    { "pos": "v.", "definition": "To leave completely.", "translation": "সম্পূর্ণভাবে ত্যাগ করা" }
  ],
  "synonyms": [{ "word": "forsake", "translation": "ত্যাগ করা" }],
  "antonyms": [{ "word": "retain", "translation": "ধরে রাখা" }]
}`}</pre>
        </section>

        {/* Question Statement */}
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>✍️ Question Statement</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            <div>
              <textarea 
                value={form.question} 
                onChange={(e) => change("question", e.target.value)} 
                className={styles.macTextarea} 
                style={{ minHeight: 120 }} 
                placeholder="Type question statement… LaTeX syntax \( ... \) for inline and \[ ... \] for display math is supported." 
              />
              <ImagePicker label="Attach Question Illustration" field="questionImage" images={images} setImages={setImages} imageUrls={imageUrls} setImageUrls={setImageUrls} />
            </div>
            <div className={styles.previewBox}>
              <div className={styles.previewHeader}>
                <span>👁️</span>
                <span>Live QuickLook Preview</span>
              </div>
              <div className={styles.previewBody}>{renderMath(form.question)}</div>
            </div>
          </div>
        </section>

        {/* Options */}
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>🔠 Options &amp; Answer Key</h2>
          </div>
          {form.options.map((option, index) => 
            <div key={index} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) minmax(0, 1fr)", gap: 12, alignItems: "start", marginBottom: 14 }}>
              <div className={styles.optionBadge} style={{ 
                background: form.correctIndex === String(index) ? "#e0f2fe" : "#f5f5f7",
                borderColor: form.correctIndex === String(index) ? "#0071e3" : "rgba(0, 0, 0, 0.1)",
                color: form.correctIndex === String(index) ? "#0071e3" : "#48484a"
              }}>
                {"ABCD"[index]}
              </div>
              <div>
                <input 
                  value={option} 
                  onChange={(e) => updateOption(index, e.target.value)} 
                  className={styles.macInput} 
                  placeholder={`Option ${"ABCD"[index]} content (LaTeX ok)`} 
                />
                <ImagePicker label={`Option ${"ABCD"[index]} Image`} field={fields[index + 1]} images={images} setImages={setImages} imageUrls={imageUrls} setImageUrls={setImageUrls} />
              </div>
              <div className={styles.previewBox} style={{ height: "100%" }}>
                <div className={styles.previewBody} style={{ fontSize: 13 }}>{renderMath(option)}</div>
              </div>
            </div>
          )}
        </section>

        {/* Answer & Metadata */}
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>🏷️ Metadata &amp; Solution Explanation</h2>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              Correct Key
              <select value={form.correctIndex} onChange={(e) => change("correctIndex", e.target.value)} className={styles.macSelect}>
                {[0, 1, 2, 3].map((i) => <option value={i} key={i}>Option {"ABCD"[i]}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Difficulty
              <select value={form.difficulty} onChange={(e) => change("difficulty", e.target.value)} className={styles.macSelect}>
                {["easy", "medium", "hard"].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Subject (Meta)
              <select value={form.subject} onChange={(e) => { change("subject", e.target.value); change("chapter", ""); }} className={styles.macSelect}>
                <option value="">Select subject</option>
                {Object.keys(SUBJECT_TOPICS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Chapter
              <select value={form.chapter} onChange={(e) => change("chapter", e.target.value)} disabled={!form.subject} className={styles.macSelect}>
                <option value="">Select chapter</option>
                {availableChapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              Tier
              <input value={form.tier} onChange={(e) => change("tier", e.target.value)} placeholder="e.g. Tier 1" className={styles.macInput} />
            </label>
            <label className={styles.fieldLabel}>
              Exam
              <input value={form.exam} onChange={(e) => change("exam", e.target.value)} placeholder="e.g. SSC CGL" className={styles.macInput} />
            </label>
            <label className={styles.fieldLabel}>
              Concept
              <input value={form.concept} onChange={(e) => change("concept", e.target.value)} placeholder="e.g. Quadratic Equations" className={styles.macInput} />
            </label>
            <label className={styles.fieldLabel}>
              Formula
              <input value={form.formula} onChange={(e) => change("formula", e.target.value)} placeholder="e.g. a² - b² = (a+b)(a-b)" className={styles.macInput} />
            </label>
            <label className={styles.fieldLabel}>
              Trap Type
              <input value={form.trapType} onChange={(e) => change("trapType", e.target.value)} placeholder="e.g. Sign Error" className={styles.macInput} />
            </label>
            <label className={styles.fieldLabel}>
              Tags
              <input value={form.tags} onChange={(e) => change("tags", e.target.value)} placeholder="Comma-separated" className={styles.macInput} />
            </label>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginTop: 16 }}>
            <div>
              <label className={styles.fieldLabel}>
                Solution Explanation
                <textarea 
                  value={form.solution} 
                  onChange={(e) => change("solution", e.target.value)} 
                  className={styles.macTextarea} 
                  style={{ minHeight: 110 }} 
                  placeholder="Explain step-by-step logic, theorems or shortcuts…"
                />
              </label>
              <ImagePicker label="Attach Solution Image" field="solutionImage" images={images} setImages={setImages} imageUrls={imageUrls} setImageUrls={setImageUrls} />
            </div>
            <div className={styles.previewBox} style={{ height: "100%" }}>
              <div className={styles.previewHeader}>
                <span>💡</span>
                <span>Solution QuickLook</span>
              </div>
              <div className={styles.previewBody}>{renderMath(form.solution)}</div>
            </div>
          </div>
        </section>

        {status && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            background: status.error ? "#fee2e2" : "#dcfce7",
            border: `1px solid ${status.error ? "#fecaca" : "#bbf7d0"}`,
            color: status.error ? "#dc2626" : "#15803d",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <span>{status.error ? "⚠️" : "✓"}</span>
            <span>{status.text}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button disabled={saving} type="submit" className={styles.btnPrimary}>
            {saving ? "Deploying Question…" : "Deploy Question →"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ImagePicker({ label, field, images, setImages, imageUrls, setImageUrls }: { label: string; field: ImageField; images: Images; setImages: React.Dispatch<React.SetStateAction<Images>>; imageUrls: Partial<Record<ImageField, string>>; setImageUrls: React.Dispatch<React.SetStateAction<Partial<Record<ImageField, string>>>> }) { 
  return (
    <div style={{ marginTop: 8, background: "#fbfbfd", padding: 8, borderRadius: 7, border: "1px solid rgba(0,0,0,0.08)" }}>
      <span style={{ fontSize: 11, color: "#6e6e73", display: "block", marginBottom: 4, fontWeight: 500 }}>{label}</span>
      <input 
        value={imageUrls[field] || ""} 
        placeholder="Paste CDN image URL…" 
        onChange={(e) => setImageUrls((old) => ({ ...old, [field]: e.target.value }))} 
        className={styles.macInput} 
        style={{ fontSize: 12, padding: "5px 8px" }} 
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => setImages((old) => ({ ...old, [field]: e.target.files?.[0] }))} 
          style={{ fontSize: 11, color: "#6e6e73" }} 
        />
        {images[field] && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>✓ Attached: {images[field]?.name}</span>}
      </div>
    </div>
  ); 
}
