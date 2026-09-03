"use client";

import { type ReactNode, useEffect, useState, useMemo, useRef } from "react";
import styles from "./AdminTool.module.css";
import { QUIZ_TREE } from "@/lib/quiz-constants";
import { getGeneralAwarenessTopicGroup } from "@/lib/general-awareness-topic-groups";

const API = process.env.NEXT_PUBLIC_API_URL || "";
type RecordItem = Record<string, any>;

interface RowData extends RecordItem {
  _idx: number;
  _status: "valid" | "error" | "db-duplicate" | "id-conflict";
  _issue?: string;
  _existingText?: string;
  _incomingText?: string;
}

function muIsStudyModeRecord(q: any) {
  return Boolean(q && typeof q === 'object' && !Array.isArray(q) && (q.questionType === 'study-mode' || (typeof q.word === 'string' && q.word.trim() && Array.isArray(q.meanings))));
}

function muValidateRecordShape(q: any): string[] {
  if (muIsStudyModeRecord(q)) {
    const issues = [];
    if (!String(q.id || '').trim()) issues.push('missing id');
    if (!String(q.topic || '').trim()) issues.push('missing topic');
    if (!String(q.subject || '').trim()) issues.push('missing subject');
    if (!String(q.word || '').trim()) issues.push('missing word');
    return issues;
  }
  const issues = [];
  if (!q.question && !q.questionText && !q.q) issues.push('missing question text');
  if (!q.options && !q.choices && !q.answers && !(q.optionA || q.optionAText)) issues.push('missing options');
  if (!q.answer && !q.correctAnswer && !q.correct && q.correctIndex === undefined) issues.push('missing answer');
  return issues;
}

function muGetDisplayText(q: any) {
  if (muIsStudyModeRecord(q)) return String(q.word || '').trim();
  return String(q.question || q.questionText || q.q || q.word || '').trim();
}

export default function BulkQuestionUpload({ backLink }: { backLink?: ReactNode }) {
  const [secret, setSecret] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("adminSecret") || "";
    }
    return "";
  });
  const [fileName, setFileName] = useState("");
  const [quiz, setQuiz] = useState({ subject: "", topic: "", chapter: "", name: "" });
  const [rows, setRows] = useState<RowData[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState({ subject: "", difficulty: "", status: "", chapter: "" });
  const [logs, setLogs] = useState<{ text: string, type: "ok" | "err" | "info" }[]>([]);
  const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const addLog = (text: string, type: "ok" | "err" | "info" = "info") => setLogs(old => [...old, { text, type }]);

  async function onFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setLogs([]);
    setProgress(null);
    const text = await file.text();
    const trimmed = text.trim();
    if (!trimmed) { setRows([]); return; }
    
    let parsedArray: any[] = [];
    try {
      if (trimmed.startsWith("[")) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) parsedArray = parsed;
      } else {
        parsedArray = trimmed.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      }
    } catch (e) {
      addLog("Failed to parse file as JSON or NDJSON. Ensure proper syntax.", "err");
      return;
    }

    const initialRows: RowData[] = parsedArray.map((q, i) => {
      if (!q || typeof q !== "object" || Array.isArray(q)) return { _idx: i, _status: "error", _issue: "Invalid JSON object" };
      const issues = muValidateRecordShape(q);
      return { ...q, _idx: i, _status: issues.length ? "error" : "valid", _issue: issues.join(", ") };
    });

    setRows(initialRows);
    setSelected(new Set(initialRows.filter(r => r._status === "valid").map(r => r._idx)));
    checkDuplicates(initialRows);
  }

  async function checkDuplicates(initialRows: RowData[]) {
    const toCheck = initialRows.filter(q => q.id || q._id || q.questionId || q.question || q.questionText || q.q || q.word);
    if (!toCheck.length) return;
    addLog(`Checking ${toCheck.length} questions against the database...`, "info");
    try {
      const res = await fetch(`${API}/api/questions/check-duplicates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret.trim(),
        },
        body: JSON.stringify({ questions: toCheck })
      });
      if (res.ok) {
        const data = await res.json();
        const byId = new Map(data.results.filter((r: any) => r.id).map((r: any) => [String(r.id), r]));
        const byText = new Map(data.results.filter((r: any) => r.textKey).map((r: any) => [String(r.textKey), r]));
        
        let exactDupes = 0, textDupes = 0, idConflicts = 0;
        const newRows = initialRows.map(q => {
          const id = String(q.id || q._id || q.questionId || '');
          const textKey = String(q.question || q.questionText || q.q || q.word || '').trim();
          const result: any = (id && byId.get(id)) || (textKey && byText.get(textKey));
          if (!result) return q;
          if (result.status === 'exact-duplicate') { exactDupes++; return { ...q, _status: "db-duplicate", _issue: 'Exact duplicate — identical ID and text' } as RowData; }
          if (result.status === 'text-duplicate') { textDupes++; return { ...q, _status: "db-duplicate", _issue: `Text match in DB (ID: ${result.existingId})` } as RowData; }
          if (result.status === 'id-conflict') { idConflicts++; return { ...q, _status: "id-conflict", _issue: 'ID Conflict — identical ID with different question text', _existingText: result.existingText, _incomingText: result.incomingText } as RowData; }
          return q;
        });

        setRows(newRows);
        setSelected(old => {
          const next = new Set(old);
          newRows.filter(r => r._status === 'db-duplicate').forEach(r => next.delete(r._idx));
          return next;
        });

        if (exactDupes) addLog(`${exactDupes} exact duplicates found (auto-deselected)`, "err");
        if (textDupes) addLog(`${textDupes} text duplicates found (auto-deselected)`, "err");
        if (idConflicts) addLog(`⚠️ ${idConflicts} ID conflicts identified`, "err");
        if (!exactDupes && !textDupes && !idConflicts) addLog("Database validation passed: 0 collisions detected ✓", "ok");
      } else {
        addLog(`Could not query database for duplicates (HTTP ${res.status})`, "err");
      }
    } catch (err) {
      addLog(`Duplicate inspection failed: ${err instanceof Error ? err.message : String(err)}`, "err");
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter(q => {
      const qSubj = (q.subject || q.topic || q.category || '').toLowerCase();
      const qDiff = (q.difficulty || q.level || '').toLowerCase();
      if (filters.subject && !qSubj.includes(filters.subject.toLowerCase())) return false;
      if (filters.difficulty && qDiff !== filters.difficulty.toLowerCase()) return false;
      if (filters.status === 'error' && q._status !== 'error' && q._status !== 'id-conflict') return false;
      if (filters.status === 'duplicate' && q._status !== 'db-duplicate') return false;
      if (filters.status && filters.status !== 'error' && filters.status !== 'duplicate' && q._status !== filters.status) return false;
      if (filters.chapter) {
        const qChap = (q.chapter || q.quizChapter || q.topic || '').toLowerCase();
        if (!qChap.includes(filters.chapter.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const toggleRow = (idx: number) => {
    setSelected(old => {
      const next = new Set(old);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const removeDupes = () => {
    const next = rows.filter(r => r._status !== "db-duplicate");
    setRows(next);
    setSelected(old => new Set([...old].filter(idx => next.some(r => r._idx === idx))));
  };

  const removeConflicts = () => {
    const next = rows.filter(r => r._status !== "id-conflict");
    setRows(next);
    setSelected(old => new Set([...old].filter(idx => next.some(r => r._idx === idx))));
  };

  const availableTopics = quiz.subject && QUIZ_TREE[quiz.subject] ? Object.keys(QUIZ_TREE[quiz.subject].topics) : [];
  const availableNames = quiz.subject && quiz.topic && QUIZ_TREE[quiz.subject]?.topics[quiz.topic] ? QUIZ_TREE[quiz.subject].topics[quiz.topic].quizzes : [];

  const isGeneralAwareness = quiz.subject === "general-awareness";
  const gaGroup = isGeneralAwareness && quiz.topic ? getGeneralAwarenessTopicGroup(quiz.topic) : null;
  const availableChapters = gaGroup ? gaGroup.topics : [];

  async function upload() {
    if (!secret.trim() || !quiz.subject || !quiz.topic || !quiz.name) return alert("Please provide the admin secret key and designate a target quiz.");
    
    const toUploadRaw = rows.filter(q => selected.has(q._idx));
    if (!toUploadRaw.length) return alert("No valid rows selected for deployment.");

    if (isGeneralAwareness && availableChapters.length > 0 && !quiz.chapter) {
      const allHaveChapters = toUploadRaw.every(q => q.chapter || q.quizChapter || q.topic);
      if (!allHaveChapters) {
        return alert("Please choose a chapter for the selected General Awareness topic.");
      }
    }

    const isStudyModeTarget = /study\s*mode/i.test(quiz.name);
    
    const hasStudyModeRows = toUploadRaw.some(muIsStudyModeRecord);
    const hasNonStudyRows = toUploadRaw.some(q => !muIsStudyModeRecord(q));

    if (hasStudyModeRows && !isStudyModeTarget) return alert("Study-mode records can only be assigned to a Study Mode designated quiz.");
    if (isStudyModeTarget && hasNonStudyRows) return alert("Study Mode quiz targets only accept study-mode shaped JSON structures.");

    const selectedChapter = availableChapters.find(c => c.slug === quiz.chapter || c.title === quiz.chapter);

    const toUpload = toUploadRaw.map(({ _idx, _status, _issue, _existingText, _incomingText, ...clean }) => {
      const itemChapter = clean.chapter || clean.quizChapter;
      const matchedChapter = selectedChapter || (isGeneralAwareness && itemChapter ? availableChapters.find(c => c.slug === itemChapter || c.title.toLowerCase() === String(itemChapter).toLowerCase()) : null);

      return {
        ...clean,
        quizSubject: quiz.subject,
        quizTopic: matchedChapter ? matchedChapter.title : (clean.quizTopic || quiz.topic),
        quizName: quiz.name,
        ...(matchedChapter ? {
          chapter: matchedChapter.title,
          chapterSlug: matchedChapter.slug,
          topic: matchedChapter.title,
          topicGroup: quiz.topic,
        } : (isGeneralAwareness ? { topicGroup: quiz.topic } : {})),
      };
    });

    if (!toUpload.length) return alert("No valid rows selected for deployment.");

    setSaving(true);
    setLogs([]);
    const total = toUpload.length;
    setProgress({ current: 0, total });
    let uploaded = 0, failed = 0;

    const BATCH = 50;
    for (let i = 0; i < total; i += BATCH) {
      const batch = toUpload.slice(i, i + BATCH);
      const batchNum = Math.floor(i / BATCH) + 1;
      try {
        const res = await fetch(`${API}/api/questions/bulk`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret.trim() },
          body: JSON.stringify(batch)
        });
        if (res.ok) {
          uploaded += batch.length;
          addLog(`Batch ${batchNum} → ${batch.length} items uploaded (HTTP 200)`, "ok");
        } else {
          failed += batch.length;
          const responseText = await res.text();
          let detail = responseText.trim();
          try {
            const parsed = JSON.parse(responseText);
            detail = String(parsed?.error || parsed?.message || detail).trim();
          } catch {
            // Keep the plain-text response when the backend did not return JSON.
          }
          const suffix = detail ? `: ${detail}` : "";
          addLog(`Batch ${batchNum} → Failed with HTTP ${res.status} ${res.statusText}${suffix}`, "err");

          if (res.status === 401 || res.status === 403) {
            const remaining = total - Math.min(i + BATCH, total);
            failed += remaining;
            setProgress({ current: total, total });
            addLog("Deployment stopped because the admin secret was rejected.", "err");
            break;
          }
        }
      } catch (err) {
        failed += batch.length;
        addLog(`Batch ${batchNum} → Network failure: ${err instanceof Error ? err.message : String(err)}`, "err");
      }
      setProgress({ current: Math.min(i + BATCH, total), total });
    }

    addLog(`Upload complete: ${uploaded} successfully stored, ${failed} failed`, failed === 0 ? "ok" : "err");
    localStorage.setItem("adminSecret", secret.trim());
    setSaving(false);
  }

  const badgeColors = (subj: string) => {
    const s = subj.toLowerCase();
    if (s.includes("geo")) return { background: "#e0f2fe", color: "#0369a1", border: "0.5px solid #bae6fd" };
    if (s.includes("math") || s.includes("alg") || s.includes("numb")) return { background: "#dcfce7", color: "#15803d", border: "0.5px solid #bbf7d0" };
    if (s.includes("trig")) return { background: "#f3e8ff", color: "#7e22ce", border: "0.5px solid #e9d5ff" };
    return { background: "#f5f5f7", color: "#48484a", border: "0.5px solid rgba(0, 0, 0, 0.1)" };
  };

  return (
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Mass NDJSON / JSON Uploader</h1>
          <p className={styles.pageSubtitle}>Batch ingest large question sets with automated schema validation, pre-flight DB duplicate checking, and progressive chunking.</p>
        </div>
      </header>
      
      {/* Target & Config Section */}
      <section className={styles.macGroup}>
        <div className={styles.macGroupHeader}>
          <h2 className={styles.macGroupTitle}>⚙️ Target Quiz &amp; Secret</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <label className={styles.fieldLabel}>
            Admin Secret
            <input 
              value={secret} 
              onChange={(e) => setSecret(e.target.value)} 
              type="password" 
              placeholder="Enter ADMIN_SECRET"
              className={styles.macInput} 
            />
          </label>
          <label className={styles.fieldLabel}>
            Quiz Subject
            <select 
              value={quiz.subject} 
              onChange={(e) => setQuiz({ subject: e.target.value, topic: "", chapter: "", name: "" })} 
              className={styles.macSelect}
            >
              <option value="">Select subject</option>
              {Object.keys(QUIZ_TREE).map(k => <option key={k} value={k}>{QUIZ_TREE[k].label}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            Quiz Topic
            <select 
              value={quiz.topic} 
              onChange={(e) => setQuiz({ ...quiz, topic: e.target.value, chapter: "", name: "" })} 
              disabled={!quiz.subject} 
              className={styles.macSelect}
            >
              <option value="">Select topic</option>
              {availableTopics.map(k => <option key={k} value={k}>{QUIZ_TREE[quiz.subject!].topics[k].label}</option>)}
            </select>
          </label>
          {isGeneralAwareness && (
            <label className={styles.fieldLabel}>
              Choose Chapter
              <select 
                value={quiz.chapter} 
                onChange={(e) => setQuiz({ ...quiz, chapter: e.target.value })} 
                disabled={!quiz.topic || availableChapters.length === 0} 
                className={styles.macSelect}
              >
                <option value="">
                  {!quiz.topic
                    ? "Select topic first"
                    : availableChapters.length === 0
                    ? "No sub-chapters"
                    : "Select chapter"}
                </option>
                {availableChapters.map((ch) => (
                  <option key={ch.slug} value={ch.slug}>
                    {ch.rank}. {ch.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={styles.fieldLabel}>
            Quiz Name
            <select 
              value={quiz.name} 
              onChange={(e) => setQuiz({ ...quiz, name: e.target.value })} 
              disabled={!quiz.topic} 
              className={styles.macSelect}
            >
              <option value="">Select quiz</option>
              {availableNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>

        {/* macOS File Dropzone */}
        <label className={styles.dropzone} style={{ display: "block", marginTop: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
          <div style={{ fontWeight: 600, color: "#1d1d1f", fontSize: 14 }}>
            {fileName ? `File Attached: ${fileName}` : "Drag & Drop .ndjson, .jsonl, or .json file here"}
          </div>
          <div style={{ fontSize: 12, color: "#6e6e73", marginTop: 4 }}>
            {rows.length > 0 ? `${rows.length} rows parsed and structured` : "Click anywhere to browse or drag file into this window"}
          </div>
          <input type="file" accept=".json,.jsonl,.ndjson" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "none" }} />
        </label>
      </section>

      {/* Interactive Data Table */}
      {rows.length > 0 && (
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>📊 Inspection &amp; Filter Controls</h2>
            <div style={{ fontSize: 12, color: "#0071e3", fontWeight: 600 }}>
              {selected.size} of {rows.length} selected
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <select value={filters.subject} onChange={e => setFilters(old => ({ ...old, subject: e.target.value }))} className={styles.macSelect} style={{ width: "auto" }}>
              <option value="">All Subjects</option>
              <option value="math">Mathematics</option>
              <option value="reasoning">Reasoning</option>
              <option value="english">English</option>
              <option value="general-awareness">General Awareness</option>
            </select>
            {isGeneralAwareness && availableChapters.length > 0 && (
              <select
                value={filters.chapter || ""}
                onChange={(e) => setFilters((old) => ({ ...old, chapter: e.target.value }))}
                className={styles.macSelect}
                style={{ width: "auto" }}
              >
                <option value="">All Chapters</option>
                {availableChapters.map((ch) => (
                  <option key={ch.slug} value={ch.slug}>
                    {ch.rank}. {ch.title}
                  </option>
                ))}
              </select>
            )}
            <select value={filters.difficulty} onChange={e => setFilters(old => ({ ...old, difficulty: e.target.value }))} className={styles.macSelect} style={{ width: "auto" }}>
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <select value={filters.status} onChange={e => setFilters(old => ({ ...old, status: e.target.value }))} className={styles.macSelect} style={{ width: "auto" }}>
              <option value="">All Statuses</option>
              <option value="valid">Valid only</option>
              <option value="error">Errors &amp; Conflicts</option>
              <option value="duplicate">In DB Dupes</option>
            </select>
            
            <button onClick={() => { setFilters({ subject: "", difficulty: "", status: "", chapter: "" }); setSelected(new Set(rows.map(r => r._idx))); }} className={styles.btnSecondary}>
              Reset &amp; Select All
            </button>
            <button onClick={removeDupes} className={styles.btnDanger}>
              Remove DB Dupes
            </button>
            <button onClick={removeConflicts} className={styles.btnWarning}>
              Remove Conflicts
            </button>
          </div>
          
          <div className={styles.tableWrap}>
            <div style={{ maxHeight: 380, overflowY: "auto", fontSize: 12.5 }}>
              {filteredRows.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#86868b" }}>No rows matching active filters.</div>
              ) : (
                filteredRows.map(q => {
                  const text = muGetDisplayText(q) || "(no text)";
                  const subj = q.subject || q.topic || q.category || "—";
                  const diff = q.difficulty || q.level || "—";
                  const isSel = selected.has(q._idx);
                  const colors = badgeColors(subj);
                  
                  return (
                    <div 
                      key={q._idx} 
                      onClick={() => toggleRow(q._idx)} 
                      style={{ 
                        display: "grid", 
                        gridTemplateColumns: "24px 36px 1fr 110px 75px 95px", 
                        gap: 10, 
                        padding: "9px 12px", 
                        borderBottom: "1px solid #f2f2f7", 
                        alignItems: "center", 
                        cursor: "pointer", 
                        background: isSel ? "#e0f2fe" : "transparent",
                        transition: "background 0.1s ease"
                      }}
                    >
                      <input type="checkbox" checked={isSel} readOnly style={{ cursor: "pointer" }} />
                      <div style={{ color: "#86868b", fontFamily: "SF Mono, monospace", fontSize: 11 }}>{q._idx + 1}</div>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1d1d1f" }} title={text}>
                        {text}
                      </div>
                      <div>
                        <span style={{ ...colors, padding: "2px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>
                          {subj.substring(0, 12)}
                        </span>
                      </div>
                      <div style={{ 
                        color: diff === "easy" ? "#15803d" : diff === "hard" ? "#dc2626" : "#a16207", 
                        fontWeight: 600, 
                        fontSize: 11.5 
                      }}>
                        {diff}
                      </div>
                      <div>
                        {q._status === "valid" && <span className={styles.badgeValid}>Valid</span>}
                        {q._status === "db-duplicate" && <span className={styles.badgeDupe} title="Already exists in database">In DB</span>}
                        {q._status === "id-conflict" && <span className={styles.badgeConflict} title={`ID Collision: ${q._existingText}`}>⚠️ Conflict</span>}
                        {q._status === "error" && <span className={styles.badgeError} title={q._issue}>Error</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}

      {/* macOS Terminal Console & Telemetry */}
      {(logs.length > 0 || progress) && (
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>💻 Deployment Terminal</h2>
          </div>
          
          {progress && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 6, background: "rgba(0, 0, 0, 0.08)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: "100%", background: "#0071e3", transition: "width 0.2s" }} />
              </div>
              <div style={{ color: "#6e6e73", fontSize: 11.5 }}>
                Progress: {progress.current} of {progress.total} questions ({Math.round((progress.current / progress.total) * 100)}%)
              </div>
            </div>
          )}

          <div ref={logRef} className={styles.terminal} style={{ maxHeight: 160, overflowY: "auto" }}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: log.type === "ok" ? "#34c759" : log.type === "err" ? "#ff453a" : "#e5e5ea", marginBottom: 3 }}>
                <span style={{ color: "#86868b", marginRight: 6 }}>$</span>
                {log.text}
              </div>
            ))}
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button 
            onClick={upload} 
            disabled={saving || selected.size === 0} 
            className={styles.btnPrimary}
          >
            {saving ? "Batch Deploying to Cloud…" : `Deploy ${selected.size} Questions →`}
          </button>
        </div>
      )}
    </div>
  );
}
