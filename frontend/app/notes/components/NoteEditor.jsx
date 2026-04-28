"use client";
import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { fetchWithRetry } from "@/lib/api/http";

const API = process.env.NEXT_PUBLIC_API_URL;

// ── Starter template ──────────────────────────────────────────────────────────
const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', sans-serif;
    background: #0f0f1a;
    color: #e8e8f0;
    padding: 2rem;
    min-height: 100vh;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(99,179,237,0.4); }
    50%       { box-shadow: 0 0 0 12px rgba(99,179,237,0); }
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes grow { from { width: 0; } to { width: var(--pct); } }

  .note-card {
    background: #1a1a2e;
    border: 1px solid #2d2d4e;
    border-radius: 16px;
    padding: 2rem;
    max-width: 720px;
    margin: 0 auto;
    animation: fadeUp 0.6s ease both;
  }

  .note-title {
    font-size: 2rem;
    font-weight: 700;
    color: #63b3ed;
    margin-bottom: 1rem;
    border-bottom: 2px solid #2d2d4e;
    padding-bottom: 0.75rem;
  }

  .formula-box {
    background: #12122a;
    border-left: 4px solid #63b3ed;
    border-radius: 8px;
    padding: 1rem 1.5rem;
    margin: 1.5rem 0;
    font-family: 'Courier New', monospace;
    font-size: 1.1rem;
    color: #90cdf4;
    animation: pulse 2s ease infinite;
    cursor: pointer;
    transition: background 0.2s;
  }
  .formula-box:hover { background: #1a1a3e; }

  .tip {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background: linear-gradient(135deg, #1a2a1a, #1a1a2e);
    border: 1px solid #38a169;
    border-radius: 10px;
    padding: 0.9rem 1.2rem;
    margin: 1rem 0;
    animation: slideIn 0.5s ease both;
  }
  .tip-icon { font-size: 1.4rem; flex-shrink: 0; }
  .tip-body { font-size: 0.95rem; color: #c6f6d5; line-height: 1.6; }

  .reveal-btn {
    background: linear-gradient(135deg, #2b6cb0, #553c9a);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1.4rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    margin: 0.5rem 0;
  }
  .reveal-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(85,60,154,0.5); }

  .reveal-content {
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.5s ease, opacity 0.4s ease;
    opacity: 0;
  }
  .reveal-content.open { max-height: 400px; opacity: 1; }

  .reveal-inner {
    background: #12122a;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 0.5rem;
    color: #e9d8fd;
    font-size: 0.95rem;
    line-height: 1.7;
  }

  .kw {
    color: #fbd38d;
    font-weight: 600;
    position: relative;
    cursor: help;
  }
  .kw::after {
    content: attr(data-tip);
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    background: #2d3748;
    color: #fff;
    font-size: 0.78rem;
    padding: 4px 8px;
    border-radius: 6px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
  }
  .kw:hover::after { opacity: 1; }

  .progress-label { font-size: 0.85rem; color: #a0aec0; margin: 0.3rem 0 0.1rem; }
  .progress-track {
    background: #2d2d4e;
    border-radius: 99px;
    height: 10px;
    margin-bottom: 0.75rem;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, #63b3ed, #76e4f7);
    animation: grow 1.2s ease both;
  }

  .note-img {
    width: 100%;
    border-radius: 10px;
    margin: 1rem 0;
    border: 1px solid #2d2d4e;
    transition: transform 0.3s;
  }
  .note-img:hover { transform: scale(1.02); }

  p { line-height: 1.75; margin: 0.75rem 0; color: #cbd5e0; }
</style>
</head>
<body>

<div class="note-card">
  <div class="note-title">📐 Trigonometric Identities</div>

  <p>
    The <span class="kw" data-tip="ratio of opposite to hypotenuse">sine</span> and
    <span class="kw" data-tip="ratio of adjacent to hypotenuse">cosine</span>
    functions are fundamental to trigonometry. Their most important identity:
  </p>

  <div class="formula-box">sin²θ + cos²θ = 1</div>

  <div class="tip">
    <span class="tip-icon">💡</span>
    <div class="tip-body">
      Divide both sides by <strong>cos²θ</strong> to get
      <strong>tan²θ + 1 = sec²θ</strong> — a very common exam trick!
    </div>
  </div>

  <button class="reveal-btn" onclick="toggle(this)">▶ Show Derivation</button>
  <div class="reveal-content">
    <div class="reveal-inner">
      Draw a right triangle with hypotenuse 1. By Pythagoras,
      the opposite² + adjacent² = 1. Since sinθ = opposite and cosθ = adjacent,
      we directly get <strong>sin²θ + cos²θ = 1</strong>.
    </div>
  </div>

  <p style="margin-top:1.5rem; font-weight:600; color:#90cdf4;">Mastery Progress</p>
  <div class="progress-label">Pythagorean Identities</div>
  <div class="progress-track">
    <div class="progress-fill" style="--pct: 80%; animation-delay: 0.2s;"></div>
  </div>
  <div class="progress-label">Double Angle Formulas</div>
  <div class="progress-track">
    <div class="progress-fill" style="--pct: 55%; animation-delay: 0.5s;"></div>
  </div>
</div>

<script>
  function toggle(btn) {
    const panel = btn.nextElementSibling;
    const isOpen = panel.classList.toggle('open');
    btn.textContent = isOpen ? '▼ Hide Derivation' : '▶ Show Derivation';
  }
</script>

</body>
</html>`;

// ── Snippets ──────────────────────────────────────────────────────────────────
const SNIPPETS = [
  {
    label: "💡 Tip Block",
    code: `<div class="tip">\n  <span class="tip-icon">💡</span>\n  <div class="tip-body">Your tip here</div>\n</div>`,
  },
  {
    label: "📐 Formula Box",
    code: `<div class="formula-box">f(x) = ...</div>`,
  },
  {
    label: "▶ Reveal Toggle",
    code: `<button class="reveal-btn" onclick="toggle(this)">▶ Show More</button>\n<div class="reveal-content">\n  <div class="reveal-inner">Hidden content here</div>\n</div>`,
  },
  {
    label: "📊 Progress Bar",
    code: `<div class="progress-label">Topic Name</div>\n<div class="progress-track">\n  <div class="progress-fill" style="--pct: 70%;"></div>\n</div>`,
  },
  {
    label: "🔑 Keyword Tooltip",
    code: `<span class="kw" data-tip="definition here">keyword</span>`,
  },
  {
    label: "🖼 Image",
    code: `<img class="note-img" src="YOUR_BLOB_URL" alt="diagram" />`,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function NoteEditor({ initialNote = null, onSaved }) {
  const [title,     setTitle]     = useState(initialNote?.title            || "");
  const [topic,     setTopic]     = useState(initialNote?.topic            || "");
  const [type,      setType]      = useState(initialNote?.type             || "note");
  const [tags,      setTags]      = useState(initialNote?.tags?.join(", ") || "");
  const [code,      setCode]      = useState(initialNote?.body             || STARTER_HTML);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("split");
  const [theme,     setTheme]     = useState("vs-dark");

  const editorRef  = useRef(null);
  const fileRef    = useRef(null);
  const previewRef = useRef(null);

  // sync live preview
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.srcdoc = code;
    }
  }, [code, activeTab]);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  // insert snippet at cursor position
  const insertSnippet = (snippet) => {
    const editor = editorRef.current;
    if (!editor) return;
    const position = editor.getPosition();
    editor.executeEdits("", [{
      range: {
        startLineNumber: position.lineNumber,
        startColumn:     position.column,
        endLineNumber:   position.lineNumber,
        endColumn:       position.column,
      },
      text: "\n" + snippet + "\n",
    }]);
    editor.focus();
  };

  // upload image → Azure Blob → auto-insert <img> tag
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res     = await fetchWithRetry(`${API}/api/upload-note-image`, {
        method: "POST",
        body:   formData,
      });
      const { url } = await res.json();
      insertSnippet(`<img class="note-img" src="${url}" alt="${file.name}" />`);
    } catch {
      alert("Image upload failed. Check your backend console.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // save note to Cosmos DB
  const handleSave = async () => {
    if (!title.trim()) { alert("Please add a title."); return; }
    setSaving(true);
    try {
      const isEdit   = !!initialNote?.id;
      const endpoint = isEdit
        ? `${API}/api/notes/${initialNote.id}`
        : `${API}/api/notes`;

      const res = await fetchWithRetry(endpoint, {
        method:  isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title,
          topic,
          type,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          body: code,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>

      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <div style={s.metaRow}>
          <input
            style={s.titleInput}
            placeholder="Note title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select style={s.select} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="note">📝 Note</option>
            <option value="formula">📐 Formula</option>
            <option value="tip">💡 Tip & Trick</option>
          </select>
          <input
            style={{ ...s.input, width: 170 }}
            placeholder="Topic (e.g. Trigonometry)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <input
            style={{ ...s.input, width: 220 }}
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <div style={s.actionRow}>
          {/* View tabs */}
          <div style={s.tabGroup}>
            {["editor", "split", "preview"].map((t) => (
              <button
                key={t}
                style={{ ...s.tabBtn, ...(activeTab === t ? s.tabBtnActive : {}) }}
                onClick={() => setActiveTab(t)}
              >
                {t === "editor" ? "⌨ Editor" : t === "split" ? "⬛ Split" : "👁 Preview"}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            style={s.iconBtn}
            onClick={() => setTheme((t) => (t === "vs-dark" ? "light" : "vs-dark"))}
            title="Toggle editor theme"
          >
            {theme === "vs-dark" ? "☀️ Light" : "🌙 Dark"}
          </button>

          {/* Image upload */}
          <button
            style={s.iconBtn}
            onClick={() => fileRef.current.click()}
            title="Upload image to Azure Blob Storage"
          >
            {uploading ? "⏳ Uploading…" : "🖼 Image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageUpload}
          />

          {/* Save */}
          <button
            style={{ ...s.saveBtn, ...(saved ? s.saveBtnSuccess : {}) }}
            onClick={handleSave}
          >
            {saving ? "Saving…" : saved ? "✓ Saved!" : "💾 Save Note"}
          </button>
        </div>
      </div>

      {/* ── Snippet bar ── */}
      <div style={s.snippetBar}>
        <span style={s.snippetLabel}>Insert:</span>
        {SNIPPETS.map((sn) => (
          <button
            key={sn.label}
            style={s.snippetBtn}
            onClick={() => insertSnippet(sn.code)}
          >
            {sn.label}
          </button>
        ))}
      </div>

      {/* ── Workspace ── */}
      <div style={s.workspace}>

        {/* Monaco editor */}
        {(activeTab === "editor" || activeTab === "split") && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Editor
              height="100%"
              defaultLanguage="html"
              value={code}
              onChange={(v) => setCode(v || "")}
              onMount={handleEditorMount}
              theme={theme}
              options={{
                fontSize:             14,
                fontFamily:           "'Fira Code', 'Cascadia Code', monospace",
                fontLigatures:        true,
                minimap:              { enabled: activeTab !== "split" },
                wordWrap:             "on",
                lineNumbers:          "on",
                scrollBeyondLastLine: false,
                automaticLayout:      true,
                padding:              { top: 16 },
                tabSize:              2,
              }}
            />
          </div>
        )}

        {/* Split divider */}
        {activeTab === "split" && <div style={s.divider} />}

        {/* Live preview iframe */}
        {(activeTab === "preview" || activeTab === "split") && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={s.previewLabel}>⚡ Live Preview</div>
            <iframe
              ref={previewRef}
              style={s.preview}
              sandbox="allow-scripts"
              title="note-preview"
            />
          </div>
        )}

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  root: {
    display:        "flex",
    flexDirection:  "column",
    height:         "100vh",
    background:     "#0d1117",
    color:          "#e2e8f0",
    fontFamily:     "'Segoe UI', sans-serif",
    overflow:       "hidden",
  },
  topBar: {
    padding:        "10px 16px 6px",
    background:     "#161b22",
    borderBottom:   "1px solid #30363d",
    display:        "flex",
    flexDirection:  "column",
    gap:            8,
  },
  metaRow:   { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  actionRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  titleInput: {
    flex:         1,
    minWidth:     200,
    background:   "#0d1117",
    border:       "1px solid #30363d",
    borderRadius: 6,
    color:        "#e2e8f0",
    padding:      "6px 12px",
    fontSize:     15,
    fontWeight:   600,
    outline:      "none",
  },
  input: {
    background:   "#0d1117",
    border:       "1px solid #30363d",
    borderRadius: 6,
    color:        "#e2e8f0",
    padding:      "6px 10px",
    fontSize:     13,
    outline:      "none",
  },
  select: {
    background:   "#0d1117",
    border:       "1px solid #30363d",
    borderRadius: 6,
    color:        "#e2e8f0",
    padding:      "6px 10px",
    fontSize:     13,
    cursor:       "pointer",
  },
  tabGroup: {
    display:      "flex",
    background:   "#0d1117",
    border:       "1px solid #30363d",
    borderRadius: 6,
    overflow:     "hidden",
  },
  tabBtn: {
    background:  "transparent",
    border:      "none",
    color:       "#8b949e",
    padding:     "5px 12px",
    fontSize:    12,
    cursor:      "pointer",
    transition:  "background 0.15s, color 0.15s",
  },
  tabBtnActive: { background: "#1f6feb", color: "#fff" },
  iconBtn: {
    background:   "#21262d",
    border:       "1px solid #30363d",
    borderRadius: 6,
    color:        "#e2e8f0",
    padding:      "5px 12px",
    fontSize:     13,
    cursor:       "pointer",
    transition:   "background 0.15s",
  },
  saveBtn: {
    background:   "#238636",
    border:       "1px solid #2ea043",
    borderRadius: 6,
    color:        "#fff",
    padding:      "5px 16px",
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
    transition:   "background 0.2s",
  },
  saveBtnSuccess: {
    background: "#1a7f37",
    border:     "1px solid #3fb950",
  },
  snippetBar: {
    display:      "flex",
    gap:          6,
    padding:      "6px 16px",
    background:   "#161b22",
    borderBottom: "1px solid #30363d",
    overflowX:    "auto",
    alignItems:   "center",
    flexShrink:   0,
  },
  snippetLabel: { color: "#8b949e", fontSize: 12, whiteSpace: "nowrap" },
  snippetBtn: {
    background:   "#21262d",
    border:       "1px solid #30363d",
    borderRadius: 6,
    color:        "#c9d1d9",
    padding:      "3px 10px",
    fontSize:     12,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    transition:   "background 0.15s",
  },
  workspace: {
    flex:     1,
    display:  "flex",
    overflow: "hidden",
  },
  divider: {
    width:      4,
    background: "#30363d",
    flexShrink: 0,
  },
  previewLabel: {
    background:     "#161b22",
    color:          "#8b949e",
    fontSize:       11,
    padding:        "4px 12px",
    borderBottom:   "1px solid #30363d",
    textTransform:  "uppercase",
    letterSpacing:  1,
  },
  preview: {
    flex:       1,
    border:     "none",
    background: "#fff",
    width:      "100%",
  },
};