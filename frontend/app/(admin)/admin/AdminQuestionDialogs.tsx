import { X } from "lucide-react";
import RichContent from "@/components/RichContent";
import type { Dispatch, SetStateAction } from "react";
import { DIFFICULTIES, LETTERS, type Question } from "./admin-question-bank-model";

type QuestionEditorDialogProps = {
  formData: Omit<Question, "id">;
  isNew: boolean;
  onClose: () => void;
  onSave: () => void;
  setFormData: Dispatch<SetStateAction<Omit<Question, "id">>>;
};

const fieldStyle = {
  width: "100%",
  padding: "7px 10px",
  border: "0.5px solid var(--color-border-secondary, #e5e7eb)",
  borderRadius: 7,
  fontSize: 13,
  background: "var(--color-background-primary, #ffffff)",
  color: "var(--color-text-primary, #111827)",
  boxSizing: "border-box",
} as const;

const labelStyle = {
  fontSize: 12,
  color: "var(--color-text-secondary)",
  display: "block",
  marginBottom: 4,
} as const;

export function QuestionEditorDialog({ formData, isNew, onClose, onSave, setFormData }: QuestionEditorDialogProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 640, maxHeight: "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 32px)", overflowY: "auto", border: "0.5px solid var(--color-border-secondary, #e5e7eb)" }} role="dialog" aria-modal="true" aria-labelledby="question-editor-title">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 id="question-editor-title" style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{isNew ? "Add Question" : "Edit Question"}</h2>
          <button data-ui-button="state" data-ui-shape="icon" onClick={onClose} aria-label="Close question editor" style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-text-secondary)" }}><X aria-hidden="true" /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12 }}>
          {(["topic", "subject", "chapter", "subtopic", "exam", "concept", "source"] as const).map((field) => (
            <div key={field}>
              <label htmlFor={`question-${field}`} style={{ ...labelStyle, textTransform: "capitalize" }}>{field}</label>
              <input id={`question-${field}`} value={(formData as unknown as Record<string, string>)[field] || ""} onChange={(event) => setFormData({ ...formData, [field]: event.target.value })} style={fieldStyle} aria-label={field} />
            </div>
          ))}

          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="question-text" style={labelStyle}>Question</label>
            <textarea id="question-text" value={formData.question} onChange={(event) => setFormData({ ...formData, question: event.target.value })} rows={3} style={{ ...fieldStyle, resize: "vertical" }} aria-label="Question" />
          </div>

          <div style={{ gridColumn: "1 / -1", border: "0.5px dashed var(--color-border-secondary, #e5e7eb)", borderRadius: 10, padding: "10px 12px", background: "var(--color-background-secondary, #f8fafc)" }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Preview</div>
            <RichContent text={formData.question || ""} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Options</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 8 }}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", width: 16 }}>{LETTERS[index]})</span>
                  <input value={formData.options[index] || ""} onChange={(event) => {
                    const options = [...formData.options];
                    options[index] = event.target.value;
                    setFormData({ ...formData, options });
                  }} style={{ ...fieldStyle, flex: 1 }} aria-label={`Option ${LETTERS[index]}`} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="question-correct-answer" style={labelStyle}>Correct Answer</label>
            <input id="question-correct-answer" value={formData.correctAnswer} onChange={(event) => setFormData({ ...formData, correctAnswer: event.target.value })} style={fieldStyle} aria-label="Correct answer" />
          </div>
          <div>
            <label htmlFor="question-correct-letter" style={labelStyle}>Correct Letter</label>
            <select id="question-correct-letter" value={formData.correctLetter} onChange={(event) => setFormData({ ...formData, correctLetter: event.target.value })} style={fieldStyle}>
              <option value="">Select</option>
              {LETTERS.map((letter) => <option key={letter} value={letter}>{letter}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="question-difficulty" style={labelStyle}>Difficulty</label>
            <select id="question-difficulty" value={formData.difficulty} onChange={(event) => setFormData({ ...formData, difficulty: event.target.value })} style={fieldStyle}>
              {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="question-solution" style={labelStyle}>Solution / Explanation</label>
            <textarea id="question-solution" value={formData.solution || ""} onChange={(event) => setFormData({ ...formData, solution: event.target.value })} rows={4} placeholder="Step-by-step solution..." style={{ ...fieldStyle, resize: "vertical" }} aria-label="Solution or explanation" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: "1.25rem", justifyContent: "flex-end" }}>
          <button data-ui-button="state" onClick={onClose} style={{ padding: "8px 18px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 14 }}>Cancel</button>
          <button data-ui-button="state" onClick={onSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--admin-blue)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>{isNew ? "Create" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}

type ConfirmDialogProps = {
  busy?: boolean;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
};

export function ConfirmDialog({ busy = false, confirmLabel, description, onCancel, onConfirm, title }: ConfirmDialogProps) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", borderRadius: 16, padding: "1.5rem", width: "min(400px, calc(100vw - 32px))", border: "0.5px solid var(--color-border-secondary, #e5e7eb)" }} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title" style={{ fontSize: 16, fontWeight: 500, margin: "0 0 8px" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.25rem" }}>{description}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button data-ui-button="state" onClick={onCancel} disabled={busy} style={{ padding: "7px 16px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button data-ui-button="state" onClick={onConfirm} disabled={busy} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#dc2626", color: "#fff", cursor: busy ? "wait" : "pointer", fontSize: 13, fontWeight: 500, opacity: busy ? 0.7 : 1 }}>{busy ? "Deleting..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function ImagePreviewDialog({ preview, onClose }: { preview: { src: string; title: string }; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }} role="dialog" aria-modal="true" aria-label="Question image preview">
      <div style={{ background: "var(--color-background-primary, #ffffff)", borderRadius: 16, padding: "1rem", width: "100%", maxWidth: 860, border: "0.5px solid var(--color-border-secondary, #e5e7eb)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>{preview.title}</div>
          <button data-ui-button="state" data-ui-shape="icon" onClick={onClose} aria-label="Close image preview" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}><X aria-hidden="true" /></button>
        </div>
        <div style={{ borderRadius: 12, border: "0.5px solid var(--color-border-secondary)", background: "var(--admin-surface-muted)", padding: 10 }}>
          <img src={preview.src} alt={preview.title} style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}
