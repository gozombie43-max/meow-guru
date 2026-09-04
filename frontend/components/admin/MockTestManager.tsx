"use client";

import { type ReactNode, useMemo, useState } from "react";
import styles from "./AdminTool.module.css";
import { API_BASE } from "@/lib/api-base";

const API = API_BASE;
const EXAMS: Record<string, { name: string; tiers: { tier: string; configKey: string }[] }> = {
  "ssc-cgl": { name: "SSC CGL", tiers: [{ tier: "Tier I", configKey: "ssc-cgl-tier1" }, { tier: "Tier II", configKey: "ssc-cgl-tier2" }] },
  "ssc-chsl": { name: "SSC CHSL", tiers: [{ tier: "Tier I", configKey: "ssc-chsl-tier1" }, { tier: "Tier II", configKey: "ssc-chsl-tier2" }] },
  "ssc-mts": { name: "SSC MTS", tiers: [{ tier: "Tier I", configKey: "ssc-mts" }] }, 
  "ssc-gd": { name: "SSC GD Constable", tiers: [{ tier: "CBT", configKey: "ssc-gd" }] },
  "rrb-ntpc": { name: "RRB NTPC", tiers: [{ tier: "CBT 1", configKey: "rrb-ntpc-cbt1" }, { tier: "CBT 2", configKey: "rrb-ntpc-cbt2" }] }, 
  "rrb-group-d": { name: "RRB Group D", tiers: [{ tier: "CBT", configKey: "rrb-group-d" }] }, 
  "rrb-je": { name: "RRB JE", tiers: [{ tier: "CBT 1", configKey: "rrb-je-cbt1" }, { tier: "CBT 2", configKey: "rrb-je-cbt2" }] },
  "ibps-po": { name: "IBPS PO", tiers: [{ tier: "Prelims", configKey: "ibps-po-prelims" }, { tier: "Mains", configKey: "ibps-po-mains" }] }, 
  "ibps-clerk": { name: "IBPS Clerk", tiers: [{ tier: "Prelims", configKey: "ibps-clerk-prelims" }, { tier: "Mains", configKey: "ibps-clerk-mains" }] }, 
  "sbi-po": { name: "SBI PO", tiers: [{ tier: "Prelims", configKey: "sbi-po-prelims" }, { tier: "Mains", configKey: "sbi-po-mains" }] }, 
  "sbi-clerk": { name: "SBI Clerk", tiers: [{ tier: "Prelims", configKey: "sbi-clerk-prelims" }, { tier: "Mains", configKey: "sbi-clerk-mains" }] },
  cat: { name: "CAT (IIMs)", tiers: [{ tier: "CAT", configKey: "cat" }] }, 
  nda: { name: "NDA & NA", tiers: [{ tier: "Maths", configKey: "nda-maths" }, { tier: "GAT", configKey: "nda-gat" }] }, 
  cds: { name: "CDS", tiers: [{ tier: "OTA/IMA", configKey: "cds-general" }] }, 
  cuet: { name: "CUET (UG)", tiers: [{ tier: "General Test", configKey: "cuet-general-test" }] },
};

type Question = Record<string, unknown>; 
type Slot = { id: string; examSlug: string; tier?: string; type?: string; title?: string; questionCount?: number; hasFixedPaper?: boolean; isFree?: boolean };

function parse(text: string): Question[] { 
  const value = text.trim(); 
  if (!value) return []; 
  try { 
    const data: unknown = value.startsWith("[") 
      ? JSON.parse(value) 
      : value.startsWith("{") && !value.includes("\n") 
        ? ((JSON.parse(value) as { questions?: Question[] }).questions || [JSON.parse(value)]) 
        : value.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); 
    return Array.isArray(data) ? data.filter((x): x is Question => !!x && typeof x === "object") : []; 
  } catch { 
    return []; 
  } 
}

export default function MockTestManager({ backLink }: { backLink?: ReactNode }) {
  const [secret, setSecret] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("adminSecret") || "";
    }
    return "";
  });
  const [apiUrl, setApiUrl] = useState(`${API}/api/mocktest`); 
  const [examSlug, setExamSlug] = useState("ssc-cgl"); 
  const [tierIndex, setTierIndex] = useState(0); 
  const [type, setType] = useState<"mock" | "pyq">("mock"); 
  const [source, setSource] = useState<"upload" | "dynamic">("upload"); 
  const [questionsText, setQuestionsText] = useState(""); 
  const [title, setTitle] = useState(""); 
  const [id, setId] = useState(""); 
  const [year, setYear] = useState(""); 
  const [shift, setShift] = useState(""); 
  const [isFree, setIsFree] = useState(false); 
  const [order, setOrder] = useState(1); 
  const [slots, setSlots] = useState<Slot[]>([]); 
  const [status, setStatus] = useState(""); 
  const [busy, setBusy] = useState(false);

  const exam = EXAMS[examSlug]; 
  const tier = exam.tiers[tierIndex] || exam.tiers[0]; 
  const questions = useMemo(() => parse(questionsText), [questionsText]);

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) => {
      const sec = ((q.sectionKey || q.subject || q.section || "General") as string).toLowerCase();
      counts[sec] = (counts[sec] || 0) + 1;
    });
    return counts;
  }, [questions]);

  function generate() { 
    const prefix = examSlug.replace(/^(ssc|rrb|ibps|sbi)-/, ""); 
    const nextYear = year || String(new Date().getFullYear()); 
    const s = (shift.replace(/[^a-z0-9]/gi, "").toLowerCase() || "s1"); 
    const number = Math.floor(Math.random() * 90) + 10; 
    setId(type === "pyq" ? `${prefix}-pyq-${nextYear}-${s}` : `${prefix}-mock-${number}`); 
    setTitle(type === "pyq" ? `${exam.name} ${nextYear} ${tier.tier} (${s.toUpperCase()}) Official Paper` : `${exam.name} Full Mock Test ${number}`); 
  }

  async function loadSlots() { 
    setBusy(true); 
    try { 
      const response = await fetch(`${apiUrl}/admin/all-slots?exam=all`, { headers: secret ? { "x-admin-secret": secret } : {} }); 
      let data: { slots?: Slot[] } = {}; 
      if (response.ok) data = await response.json(); 
      else { const fallback = await fetch(`${apiUrl}/${examSlug}/slots`); data = await fallback.json(); } 
      setSlots(data.slots || []); 
    } catch (error) { 
      setStatus(error instanceof Error ? error.message : "Could not fetch slots from database."); 
    } finally { setBusy(false); } 
  }

  async function deploy() { 
    if (!secret || !id || !title || (source === "upload" && !questions.length)) return setStatus("Provide secret key, generated paper ID/title, and valid questions."); 
    setBusy(true); 
    const slot = { id, examSlug, configKey: tier.configKey, title, tier: tier.tier, type, year: type === "pyq" && year ? Number(year) : null, shift: type === "pyq" ? shift || null : null, isFree, order }; 
    try { 
      const response = await fetch(source === "upload" ? `${apiUrl}/admin/upload-paper` : `${apiUrl}/admin/slots`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret }, body: JSON.stringify(source === "upload" ? { slot, questions } : slot) }); 
      const data = await response.json().catch(() => ({})); 
      if (!response.ok) throw new Error(data.error || "Deployment failed"); 
      localStorage.setItem("adminSecret", secret); 
      setStatus(source === "upload" ? `Successfully deployed ${data.totalQuestions ?? questions.length} questions to Cosmos DB.` : `Dynamic slot "${id}" created successfully.`); 
      await loadSlots(); 
    } catch (error) { 
      setStatus(error instanceof Error ? error.message : "Deployment failed."); 
    } finally { setBusy(false); } 
  }

  async function remove(slot: Slot) { 
    if (!confirm(`Are you sure you want to delete slot "${slot.id}"?`)) return; 
    setBusy(true); 
    try { 
      const response = await fetch(`${apiUrl}/admin/slots/${encodeURIComponent(slot.id)}?examSlug=${encodeURIComponent(slot.examSlug)}`, { method: "DELETE", headers: { "x-admin-secret": secret } }); 
      if (!response.ok) throw new Error("Could not delete slot."); 
      await loadSlots(); 
    } catch (error) { 
      setStatus(error instanceof Error ? error.message : "Deletion failed."); 
    } finally { setBusy(false); } 
  }

  async function seed() { 
    setBusy(true); 
    try { 
      const response = await fetch(`${apiUrl}/admin/slots/seed`, { method: "POST", headers: { "x-admin-secret": secret } }); 
      const data = await response.json().catch(() => ({})); 
      if (!response.ok) throw new Error(data.error || "Could not seed slots."); 
      setStatus(`Seeded ${data.totalSeeded || 0} default slots into Cosmos DB.`); 
      await loadSlots(); 
    } catch (error) { 
      setStatus(error instanceof Error ? error.message : "Seed failed."); 
    } finally { setBusy(false); } 
  }

  return (
    <div className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Mock Test &amp; PYQ Studio</h1>
          <p className={styles.pageSubtitle}>Deploy complete previous year question papers or register dynamic question generator slots directly in Cosmos DB.</p>
        </div>
      </header>

      {/* Target Exam Configuration */}
      <section className={styles.macGroup}>
        <div className={styles.macGroupHeader}>
          <h2 className={styles.macGroupTitle}>🎯 Target Exam &amp; Configuration</h2>
        </div>
        
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>
            Admin Secret
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Enter ADMIN_SECRET" className={styles.macInput} />
          </label>
          <label className={styles.fieldLabel}>
            Mock Engine API
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className={styles.macInput} />
          </label>
          <label className={styles.fieldLabel}>
            Target Exam
            <select value={examSlug} onChange={(e) => { setExamSlug(e.target.value); setTierIndex(0); }} className={styles.macSelect}>
              {Object.entries(EXAMS).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            Stage / Tier
            <select value={tierIndex} onChange={(e) => setTierIndex(Number(e.target.value))} className={styles.macSelect}>
              {exam.tiers.map((value, index) => <option value={index} key={value.configKey}>{value.tier}</option>)}
            </select>
          </label>
        </div>

        {/* Mode Selectors */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <div style={{ display: "flex", background: "rgba(0, 0, 0, 0.05)", padding: 3, borderRadius: 8, border: "1px solid rgba(0, 0, 0, 0.08)" }}>
            <button type="button" onClick={() => setType("mock")} className={type === "mock" ? styles.btnPrimary : styles.btnSecondary} style={{ borderRadius: 6, padding: "5px 12px", fontSize: 12 }}>
              🎯 Full Mock Test
            </button>
            <button type="button" onClick={() => setType("pyq")} className={type === "pyq" ? styles.btnPrimary : styles.btnSecondary} style={{ borderRadius: 6, padding: "5px 12px", fontSize: 12 }}>
              🏛️ Previous Year (PYQ)
            </button>
          </div>

          <div style={{ display: "flex", background: "rgba(0, 0, 0, 0.05)", padding: 3, borderRadius: 8, border: "1px solid rgba(0, 0, 0, 0.08)" }}>
            <button type="button" onClick={() => setSource("upload")} className={source === "upload" ? styles.btnPrimary : styles.btnSecondary} style={{ borderRadius: 6, padding: "5px 12px", fontSize: 12 }}>
              📄 Upload Full Paper
            </button>
            <button type="button" onClick={() => setSource("dynamic")} className={source === "dynamic" ? styles.btnPrimary : styles.btnSecondary} style={{ borderRadius: 6, padding: "5px 12px", fontSize: 12 }}>
              ⚡ Dynamic Slot
            </button>
          </div>
        </div>

        {type === "pyq" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <label className={styles.fieldLabel}>
              Exam Year
              <input placeholder="e.g. 2024" value={year} onChange={(e) => setYear(e.target.value)} className={styles.macInput} />
            </label>
            <label className={styles.fieldLabel}>
              Shift / Shift Timing
              <input placeholder="e.g. Shift 1 (s1)" value={shift} onChange={(e) => setShift(e.target.value)} className={styles.macInput} />
            </label>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14, alignItems: "flex-end" }}>
          <label className={styles.fieldLabel} style={{ flex: "1 1 220px" }}>
            Slot ID
            <input placeholder="e.g. cgl-pyq-2024-s1" value={id} onChange={(e) => setId(e.target.value)} className={styles.macInput} />
          </label>
          <label className={styles.fieldLabel} style={{ flex: "2 1 300px" }}>
            Paper Title
            <input placeholder="e.g. SSC CGL 2024 Tier I Official Paper" value={title} onChange={(e) => setTitle(e.target.value)} className={styles.macInput} />
          </label>
          <button type="button" onClick={generate} className={styles.btnSecondary} style={{ height: 35 }}>
            ⚡ Auto-Generate
          </button>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 14 }}>
          <label className={styles.fieldLabel} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span>Order Index:</span>
            <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={styles.macInput} style={{ width: 80 }} />
          </label>
          <label className={styles.fieldLabel} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
            <span>Free Access for All Candidates</span>
          </label>
        </div>
      </section>

      {/* Paper Upload & Inspection */}
      {source === "upload" && (
        <section className={styles.macGroup}>
          <div className={styles.macGroupHeader}>
            <h2 className={styles.macGroupTitle}>📑 Paper Payload (JSON / NDJSON)</h2>
          </div>

          <label className={styles.dropzone} style={{ display: "block" }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📦</div>
            <div style={{ fontWeight: 600, color: "#1d1d1f", fontSize: 13.5 }}>Drop Paper File (.ndjson or .json)</div>
            <div style={{ fontSize: 11.5, color: "#6e6e73", marginTop: 2 }}>{questions.length > 0 ? `${questions.length} questions parsed` : "Click to select local file"}</div>
            <input type="file" accept=".json,.jsonl,.ndjson" onChange={async (e) => setQuestionsText(await e.target.files?.[0]?.text() || "")} style={{ display: "none" }} />
          </label>

          <textarea 
            value={questionsText} 
            onChange={(e) => setQuestionsText(e.target.value)} 
            placeholder="Or paste NDJSON lines or JSON array here…" 
            className={styles.macTextarea} 
            style={{ marginTop: 10, minHeight: 110, fontFamily: "SF Mono, Menlo, monospace", fontSize: 12 }} 
          />

          {questions.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {/* Stats Chips */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ padding: "6px 12px", background: "#e0f2fe", borderRadius: 8, border: "0.5px solid #bae6fd" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#0071e3" }}>{questions.length}</div>
                  <div style={{ fontSize: 10, color: "#0369a1", textTransform: "uppercase", fontWeight: 600 }}>Total Questions</div>
                </div>
                {Object.entries(sectionCounts).map(([key, count]) => (
                  <div key={key} style={{ padding: "6px 12px", background: "#f5f5f7", borderRadius: 8, border: "0.5px solid rgba(0, 0, 0, 0.08)" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1d1d1f" }}>{count}</div>
                    <div style={{ fontSize: 10, color: "#6e6e73", textTransform: "uppercase" }}>{key}</div>
                  </div>
                ))}
              </div>

              {/* Preview Table */}
              <div className={styles.tableWrap} style={{ maxHeight: 220, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead style={{ position: "sticky", top: 0, background: "#f5f5f7", zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "#6e6e73", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", width: 40 }}>#</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "#6e6e73", borderBottom: "1px solid rgba(0, 0, 0, 0.08)" }}>Question Statement</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "#6e6e73", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", width: 110 }}>Section</th>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "#6e6e73", borderBottom: "1px solid rgba(0, 0, 0, 0.08)", width: 70 }}>Ans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.slice(0, 25).map((q, i) => {
                      const text = String(q.question || q.q || "(no text)");
                      const section = String(q.sectionKey || q.subject || q.section || "General");
                      const ans = String(q.correctAnswer ?? q.answer ?? "A");
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f2f2f7" }}>
                          <td style={{ padding: "7px 12px", color: "#86868b", fontFamily: "SF Mono, monospace" }}>{i + 1}</td>
                          <td style={{ padding: "7px 12px", maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1d1d1f" }}>{text}</td>
                          <td style={{ padding: "7px 12px" }}>
                            <span style={{ padding: "2px 6px", background: "#e0f2fe", color: "#0369a1", borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>
                              {section}
                            </span>
                          </td>
                          <td style={{ padding: "7px 12px", fontWeight: 700, color: "#15803d" }}>{ans}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {status && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          background: status.includes("failed") || status.includes("Provide") ? "#fee2e2" : "#dcfce7",
          border: `1px solid ${status.includes("failed") || status.includes("Provide") ? "#fecaca" : "#bbf7d0"}`,
          color: status.includes("failed") || status.includes("Provide") ? "#dc2626" : "#15803d",
          marginBottom: 16
        }}>
          {status}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button disabled={busy} onClick={deploy} className={styles.btnPrimary}>
          {busy ? "Working…" : "🚀 Deploy Paper / Create Slot →"}
        </button>
      </div>

      {/* Live Cosmos DB Slots Management */}
      <section className={styles.macGroup}>
        <div className={styles.macGroupHeader}>
          <div>
            <h2 className={styles.macGroupTitle}>🌐 Live Cosmos DB Slots</h2>
            <span style={{ fontSize: 11.5, color: "#6e6e73" }}>Real-time test slots published to candidates</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy} onClick={loadSlots} className={styles.btnSecondary} style={{ fontSize: 12, padding: "5px 10px" }}>
              🔄 Fetch Live
            </button>
            <button disabled={busy} onClick={seed} className={styles.btnWarning} style={{ fontSize: 12, padding: "5px 10px" }}>
              ⚡ Seed Defaults
            </button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          {slots.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#86868b", fontSize: 13 }}>
              No slots loaded. Click <strong>"Fetch Live"</strong> to inspect database records.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f5f5f7", borderBottom: "1px solid rgba(0, 0, 0, 0.08)" }}>
                  {["Slot ID", "Exam", "Stage", "Type", "Title", "Count", "Access", "Actions"].map((x) => (
                    <th key={x} style={{ textAlign: "left", padding: "8px 12px", color: "#6e6e73" }}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const isPyq = slot.type === "pyq" || slot.id.includes("pyq");
                  return (
                    <tr key={`${slot.examSlug}-${slot.id}`} style={{ borderBottom: "1px solid #f2f2f7" }}>
                      <td style={{ padding: "8px 12px", fontFamily: "SF Mono, monospace", color: "#0071e3" }}>{slot.id}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{slot.examSlug}</td>
                      <td style={{ padding: "8px 12px", color: "#6e6e73" }}>{slot.tier || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ 
                          padding: "2px 6px", 
                          borderRadius: 4, 
                          fontSize: 10.5, 
                          fontWeight: 600, 
                          background: isPyq ? "#e0f2fe" : "#f3e8ff",
                          color: isPyq ? "#0369a1" : "#7e22ce" 
                        }}>
                          {isPyq ? "PYQ" : "MOCK"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#1d1d1f" }}>{slot.title}</td>
                      <td style={{ padding: "8px 12px", color: "#6e6e73" }}>{slot.questionCount ?? (slot.hasFixedPaper ? "Fixed" : "Dynamic")}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ 
                          padding: "2px 6px", 
                          borderRadius: 4, 
                          fontSize: 10.5, 
                          fontWeight: 600, 
                          background: slot.isFree ? "#dcfce7" : "#fef9c3",
                          color: slot.isFree ? "#15803d" : "#a16207" 
                        }}>
                          {slot.isFree ? "FREE" : "PRO"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <button disabled={busy} onClick={() => remove(slot)} className={styles.btnDanger} style={{ padding: "3px 8px", fontSize: 11 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
