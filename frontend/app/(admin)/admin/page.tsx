"use client";
import AdminDisclosure from "@/components/admin/AdminDisclosure";
import layout from "@/components/admin/AdminLayout.module.css";
import MassSolutionUpload from "@/components/admin/MassSolutionUpload";
import RichContent from "@/components/RichContent";
import { useAdminQuestionBank } from '@/features/admin/questions/useAdminQuestionBank';
import { ChevronLeft,ChevronRight,ChevronsLeft,ChevronsRight } from "lucide-react";
import MassImageUpload from "../../../components/admin/MassImageUpload";
import {
DIFFICULTIES,
SUBJECT_OPTIONS,
SUBJECTS,
type SubjectKey
} from "./admin-question-bank-model";
import { ConfirmDialog,ImagePreviewDialog,QuestionEditorDialog } from "./AdminQuestionDialogs";
import BulkImageQuestionUpload from "./BulkImageQuestionUpload";


export default function AdminPanel() {
  const { questions, loading, error, success, search, setSearch, filterTopic, setFilterTopic, filterSubject, setFilterSubject, filterDifficulty, setFilterDifficulty, filterExam, setFilterExam, filterQuizName, setFilterQuizName, sortOrder, setSortOrder, muSubject, setMuSubject, muTopic, setMuTopic, muQuiz, setMuQuiz, muFileName, muStats, muQuestions, muUploading, muApiUrl, setMuApiUrl, muFileRef, bulkImages, bulkImageNotice, bulkImageUploading, bulkImageRef, page, setPage, editing, isNew, formData, setFormData, deleteConfirm, setDeleteConfirm, selected, bulkDeleteConfirm, setBulkDeleteConfirm, bulkDeleting, imagePreview, setImagePreview, solImgUploading, solImgRefs, topics, exams, quizNames, muTopicOptions, selectedSubjectId, selectedTopicId, selectedQuizId, selectedSubjectName, selectedTopicName, selectedQuizName, quizOptions, filtered, handleMuFileChange, handleMuClear, handleMuUpload, handleBulkImageFiles, removeBulkImage, clearBulkImages, handleBulkImageUpload, handleSolutionImageUpload, toggleOne, paginated, allPageSelected, togglePage, selectAll, clearSelection, handleBulkDelete, openEdit, openNew, closeModal, handleSave, handleDelete, totalPages, diffColor } = useAdminQuestionBank();


  return (
    <div className={layout.page}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Question Bank Admin</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            {filtered.length} of {questions.length} questions
            {selected.size > 0 && <span style={{ marginLeft: 8, color: "var(--admin-blue)", fontWeight: 500 }}>· {selected.size} selected</span>}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {selected.size > 0 && (
            <>
              <button data-ui-button="state" onClick={clearSelection} style={{ padding: "8px 14px", background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                Clear
              </button>
              <button data-ui-button="state" onClick={() => setBulkDeleteConfirm(true)} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                Delete {selected.size} selected
              </button>
            </>
          )}
          <a
            href="/admin/upload-image"
            style={{ padding: "8px 14px", background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Upload Image Question
          </a>
          <a
            href="/admin/upload"
            style={{ padding: "8px 14px", background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Upload Tools
          </a>
          <button data-ui-button="state" onClick={openNew} style={{ padding: "8px 16px", background: "var(--admin-blue)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
            + Add Question
          </button>
        </div>
      </div>

      {/* Toast */}
      {(error || success) && (
        <div style={{ padding: "10px 16px", borderRadius: 8, marginBottom: "1rem", background: error ? "#fef2f2" : "#f0fdf4", color: error ? "#dc2626" : "#16a34a", border: `1px solid ${error ? "#fecaca" : "#bbf7d0"}`, fontSize: 14 }}>
          {error || success}
        </div>
      )}

      {/* ── Mass Upload ── */}
      <AdminDisclosure title="Import questions and images">
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", background: "var(--color-background-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Mass Upload</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Upload NDJSON/JSONL or a JSON array. Select subject, topic, and quiz.
            </p>
          </div>
          <button data-ui-button="state" onClick={handleMuClear} style={{ padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Clear
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10, marginBottom: 10 }}>
          <select
            value={muSubject}
            onChange={(e) => {
              const next = e.target.value as SubjectKey | "";
              setMuSubject(next);
              setMuTopic("");
              setMuQuiz("");
            }}
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="">Select subject</option>
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={muTopic}
            onChange={(e) => {
              setMuTopic(e.target.value);
              setMuQuiz("");
            }}
            disabled={!muSubject}
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="">Select topic</option>
            {muTopicOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select
            value={muQuiz}
            onChange={(e) => setMuQuiz(e.target.value)}
            disabled={!muTopic}
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="">Select quiz</option>
            {quizOptions.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10, alignItems: "center" }}>
          <input
            ref={muFileRef}
            type="file"
            accept=".ndjson,.jsonl,.json"
            onChange={handleMuFileChange}
            style={{ padding: "6px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 12, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
           aria-label="Choose file"/>
          <input
            value={muApiUrl}
            onChange={(e) => setMuApiUrl(e.target.value)}
            placeholder="Bulk API URL"
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
           aria-label="Bulk API URL"/>
          <button data-ui-button="state"
            onClick={handleMuUpload}
            disabled={muUploading || !muApiUrl || !muSubject || !muTopic || !muQuiz || muQuestions.length === 0}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: muUploading ? "#a855f7" : "var(--admin-blue)", color: "#fff", cursor: muUploading ? "wait" : "pointer", fontSize: 13, fontWeight: 500, opacity: muUploading ? 0.8 : 1 }}
          >
            {muUploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 12, color: "var(--color-text-secondary)" }}>
          <span>File: {muFileName || "None"}</span>
          <span>Total: {muStats.total}</span>
          <span>Ready: {muStats.ready}</span>
          <span>Errors: {muStats.errors}</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <MassImageUpload
            subjectId={selectedSubjectId}
            topicId={selectedTopicId}
            quizId={selectedQuizId}
            subjectName={selectedSubjectName}
            topicName={selectedTopicName}
            quizName={selectedQuizName}
          />
        </div>
      </div>

      </AdminDisclosure>

      {/* ── Mass Solution Upload ── */}
      <AdminDisclosure title="Upload solution images">
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", background: "var(--color-background-secondary)" }}>
        <MassSolutionUpload />
      </div>

      </AdminDisclosure>

      <BulkImageQuestionUpload
        busy={bulkImageUploading}
        fileInputRef={bulkImageRef}
        items={bulkImages}
        notice={bulkImageNotice}
        onClear={clearBulkImages}
        onFilesChange={handleBulkImageFiles}
        onRemove={removeBulkImage}
        onUpload={handleBulkImageUpload}
      />

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10, marginBottom: "1rem" }}>
        <input placeholder="Search question, chapter, ID..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}  aria-label="Search question, chapter, ID..."/>
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All topics</option>
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All exams</option>
          {exams.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filterQuizName} onChange={(e) => setFilterQuizName(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All quiz names</option>
          {quizNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="asc">Sort by ID ↑</option>
          <option value="desc">Sort by ID ↓</option>
        </select>
      </div>

      {/* Select all banner */}
      {selected.size > 0 && (
        <div style={{ padding: "8px 14px", background: "var(--admin-blue-soft)", borderRadius: 8, marginBottom: 10, fontSize: 13, color: "var(--admin-blue)", display: "flex", alignItems: "center", gap: 12 }}>
          <span>{selected.size} question{selected.size > 1 ? "s" : ""} selected</span>
          {selected.size < filtered.length && (
            <button data-ui-button="state" onClick={selectAll} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-blue)", fontWeight: 500, fontSize: 13, padding: 0 }}>
              Select all {filtered.length}
            </button>
          )}
          <button data-ui-button="state" onClick={clearSelection} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-blue)", fontSize: 13, padding: 0, marginLeft: "auto" }}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className={layout.tableWrap}>
        <table className={layout.table}>
          <thead>
            <tr style={{ background: "var(--color-background-secondary)" }}>
              <th style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)", width: 40 }}>
                <input type="checkbox" checked={allPageSelected} onChange={togglePage}
                  style={{ cursor: "pointer", width: 15, height: 15 }} title="Select all on this page"  aria-label="Select all on this page"/>
              </th>
              {["ID", "Topic", "Chapter", "Difficulty", "Exam", "Question", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Loading...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>No questions found</td></tr>
            ) : paginated.map((q, i) => (
              <tr key={q.id} style={{
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                background: selected.has(q.id) ? "var(--admin-blue-soft)" : i % 2 === 0 ? "var(--color-background-primary)" : "var(--color-background-secondary)"
              }}>
                <td data-label="Select" style={{ padding: "10px 14px" }}>
                  <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleOne(q.id)}
                    style={{ cursor: "pointer", width: 15, height: 15 }} aria-label={`Select question ${q.id}`} />
                </td>
                <td data-label="ID" style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontFamily: "monospace", fontSize: 11 }}>{q.id?.slice(0, 16)}...</td>
                <td data-label="Topic" style={{ padding: "10px 14px" }}>
                  <span style={{ background: "var(--admin-blue-soft)", color: "var(--admin-blue)", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{q.topic}</span>
                </td>
                <td data-label="Chapter" style={{ padding: "10px 14px", color: "var(--color-text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.chapter}</td>
                <td data-label="Difficulty" style={{ padding: "10px 14px" }}>
                  <span style={{ color: diffColor(q.difficulty), fontWeight: 500, fontSize: 12 }}>{q.difficulty}</span>
                </td>
                <td data-label="Exam" style={{ padding: "10px 14px", color: "var(--color-text-secondary)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{q.exam}</td>
                <td data-label="Question" style={{ padding: "10px 14px", maxWidth: 320 }}>
                  <div style={{ maxHeight: 64, overflow: "hidden" }}>
                    {q.question ? (
                      <RichContent text={q.question} />
                    ) : q.questionImage ? (
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Image question
                      </span>
                    ) : null}
                  </div>
                </td>
                <td data-label="Actions" style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                  <button data-ui-button="state" onClick={() => openEdit(q)} style={{ marginRight: 6, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}>Edit</button>
                  <button data-ui-button="state" onClick={() => setDeleteConfirm(q.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "0.5px solid #fecaca", background: "transparent", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>Delete</button>
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      ref={(el) => { solImgRefs.current[q.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSolutionImageUpload(q.id, file);
                        e.target.value = "";
                      }}
                     aria-label="Choose file"/>
                    <button data-ui-button="state"
                      onClick={() => solImgRefs.current[q.id]?.click()}
                      disabled={solImgUploading === q.id}
                      style={{
                        marginLeft: 6,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "0.5px solid #bbf7d0",
                        background: "transparent",
                        cursor: solImgUploading === q.id ? "wait" : "pointer",
                        fontSize: 12,
                        color: "#16a34a",
                        opacity: solImgUploading === q.id ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {solImgUploading === q.id ? "Uploading..." : `${(q.solutionImage || q.solution?.includes("![solution](")) ? "✓ " : ""}Sol. Image`}
                    </button>
                  </>
                  {(q.subject === "reasoning" || q.topic === "visual_reasoning") && q.questionImage && (
                    <button data-ui-button="state"
                      onClick={() =>
                        setImagePreview({
                          src: q.questionImage || "",
                          title: q.question || q.id,
                        })
                      }
                      style={{ marginLeft: 6, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}
                    >
                      View Image
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: "1rem", justifyContent: "center" }}>
          <button data-ui-button="state" data-ui-shape="icon" aria-label="First page" onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}><ChevronsLeft aria-hidden="true" /></button>
          <button data-ui-button="state" data-ui-shape="icon" aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}><ChevronLeft aria-hidden="true" /></button>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Page {page} of {totalPages}</span>
          <button data-ui-button="state" data-ui-shape="icon" aria-label="Next page" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}><ChevronRight aria-hidden="true" /></button>
          <button data-ui-button="state" data-ui-shape="icon" aria-label="Last page" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}><ChevronsRight aria-hidden="true" /></button>
        </div>
      )}

      {editing && (
        <QuestionEditorDialog
          formData={formData}
          isNew={isNew}
          onClose={closeModal}
          onSave={handleSave}
          setFormData={setFormData}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete question?"
          description="This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
        />
      )}

      {bulkDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${selected.size} questions?`}
          description={`This will permanently delete all ${selected.size} selected questions. This cannot be undone.`}
          confirmLabel={`Delete ${selected.size} questions`}
          busy={bulkDeleting}
          onCancel={() => setBulkDeleteConfirm(false)}
          onConfirm={handleBulkDelete}
        />
      )}

      {imagePreview && (
        <ImagePreviewDialog preview={imagePreview} onClose={() => setImagePreview(null)} />
      )}
    </div>
  );

}
