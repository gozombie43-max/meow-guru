"use client";
import { useRef, useState, type ChangeEvent } from "react";

type Region = { x: number; y: number; w: number; h: number };

type ImageEntry = {
  id: string;
  file: File;
  previewUrl: string;
  regions: Record<string, Region>;
  correctLetter: string;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
};

type Props = {
  subjectId: string;
  topicId: string;
  quizId: string;
  subjectName: string;
  topicName: string;
  quizName: string;
};

const LETTERS = ["a", "b", "c", "d"];

const DEFAULT_REGIONS: Record<string, Region> = {
  a: { x: 0, y: 0.6, w: 0.5, h: 0.2 },
  b: { x: 0.5, y: 0.6, w: 0.5, h: 0.2 },
  c: { x: 0, y: 0.8, w: 0.5, h: 0.2 },
  d: { x: 0.5, y: 0.8, w: 0.5, h: 0.2 },
};

let idCounter = 0;
const uid = () => `img-${Date.now()}-${idCounter++}`;

export default function MassImageUpload({
  subjectId,
  topicId,
  quizId,
  subjectName,
  topicName,
  quizName,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<ImageEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string>("a");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newEntries: ImageEntry[] = files.map((file) => ({
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      regions: { ...DEFAULT_REGIONS },
      correctLetter: "a",
      status: "idle",
    }));
    setEntries((prev) => [...prev, ...newEntries]);
    if (!activeId && newEntries.length > 0) setActiveId(newEntries[0].id);
    if (fileRef.current) fileRef.current.value = "";
  };

  const updateEntry = (id: string, patch: Partial<ImageEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
  };

  const handleImageClick = (
    e: React.MouseEvent<HTMLImageElement>,
    entry: ImageEntry
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    updateEntry(entry.id, {
      regions: {
        ...entry.regions,
        [activeLetter]: { x, y, w: 0.3, h: 0.15 },
      },
    });
  };

  const uploadOne = async (entry: ImageEntry): Promise<boolean> => {
    updateEntry(entry.id, { status: "uploading" });
    try {
      const formData = new FormData();
      formData.append("questionImage", entry.file);
      formData.append("topic", topicId);
      formData.append("subject", subjectId);
      formData.append("quizName", quizId);
      formData.append("correctLetter", entry.correctLetter);
      formData.append("optionRegions", JSON.stringify(entry.regions));

      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let msg = `Server error ${res.status}`;
        try {
          const d = await res.json();
          if (d?.error) msg = d.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      updateEntry(entry.id, { status: "done" });
      return true;
    } catch (err) {
      updateEntry(entry.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed",
      });
      return false;
    }
  };

  const handleUploadAll = async () => {
    if (!subjectId || !topicId || !quizId) {
      showToast("Select subject, topic, and quiz first", true);
      return;
    }
    const pending = entries.filter((e) => e.status !== "done");
    if (!pending.length) {
      showToast("No images to upload", true);
      return;
    }

    setUploading(true);
    let ok = 0;
    let fail = 0;
    for (const entry of pending) {
      const success = await uploadOne(entry);
      success ? ok++ : fail++;
    }
    setUploading(false);
    showToast(
      fail > 0 ? `Uploaded ${ok}, failed ${fail}` : `Uploaded ${ok} image question${ok !== 1 ? "s" : ""} ✓`
    );
  };

  const activeEntry = entries.find((e) => e.id === activeId) ?? null;
  const doneCount = entries.filter((e) => e.status === "done").length;
  const errorCount = entries.filter((e) => e.status === "error").length;

  const statusColor = (s: ImageEntry["status"]) => {
    if (s === "done") return "#16a34a";
    if (s === "error") return "#dc2626";
    if (s === "uploading") return "#d97706";
    return "var(--color-text-secondary)";
  };

  const statusLabel = (e: ImageEntry) => {
    if (e.status === "done") return "✓";
    if (e.status === "error") return "✗";
    if (e.status === "uploading") return "…";
    const regionCount = Object.keys(e.regions).length;
    return `${regionCount}/4`;
  };

  if (entries.length === 0) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>
              Mass Image Upload
            </p>
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
              Upload multiple image-based questions. Click an image to place option regions.
            </p>
          </div>
        </div>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            border: "1.5px dashed var(--color-border-secondary)",
            borderRadius: 10,
            padding: "24px 16px",
            cursor: "pointer",
            color: "var(--color-text-secondary)",
            fontSize: 13,
            background: "var(--color-background-primary)",
          }}
        >
          <span style={{ fontSize: 24 }}>🖼️</span>
          <span>Click to select image files</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>PNG, JPG, WEBP supported</span>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFiles}
            style={{ display: "none" }}
          />
        </label>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>
            Mass Image Upload
            {subjectName && topicName && quizName && (
              <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-text-secondary)", marginLeft: 8 }}>
                → {subjectName} / {topicName} / {quizName}
              </span>
            )}
          </p>
          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "2px 0 0" }}>
            {entries.length} image{entries.length !== 1 ? "s" : ""} · {doneCount} done
            {errorCount > 0 && (
              <span style={{ color: "#dc2626", marginLeft: 6 }}>{errorCount} error{errorCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <label
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              border: "0.5px solid var(--color-border-secondary)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            + Add More
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFiles}
              style={{ display: "none" }}
            />
          </label>
          <button
            onClick={() => setEntries([])}
            style={{
              padding: "6px 12px",
              borderRadius: 7,
              border: "0.5px solid var(--color-border-secondary)",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--color-text-secondary)",
            }}
          >
            Clear All
          </button>
          <button
            onClick={handleUploadAll}
            disabled={uploading}
            style={{
              padding: "6px 14px",
              borderRadius: 7,
              border: "none",
              background: uploading ? "#a855f7" : "#6d28d9",
              color: "#fff",
              cursor: uploading ? "wait" : "pointer",
              fontSize: 12,
              fontWeight: 500,
              opacity: uploading ? 0.8 : 1,
            }}
          >
            {uploading ? "Uploading…" : `Upload All (${entries.filter((e) => e.status !== "done").length})`}
          </button>
        </div>
      </div>

      {toast && (
        <div
          style={{
            padding: "8px 14px",
            borderRadius: 7,
            marginBottom: 10,
            fontSize: 12,
            background: toast.err ? "#fef2f2" : "#f0fdf4",
            color: toast.err ? "#dc2626" : "#16a34a",
            border: `1px solid ${toast.err ? "#fecaca" : "#bbf7d0"}`,
          }}
        >
          {toast.msg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, alignItems: "start" }}>
        {/* Thumbnail list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 480,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setActiveId(entry.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 8,
                border: `1px solid ${activeId === entry.id ? "#6d28d9" : "var(--color-border-secondary)"}`,
                background:
                  activeId === entry.id
                    ? "#ede9fe"
                    : "var(--color-background-primary)",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <img
                src={entry.previewUrl}
                alt=""
                style={{
                  width: 44,
                  height: 36,
                  objectFit: "cover",
                  borderRadius: 5,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 11,
                    margin: 0,
                    color: "var(--color-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.file.name}
                </p>
                <p
                  style={{
                    fontSize: 10,
                    margin: "2px 0 0",
                    color: statusColor(entry.status),
                    fontWeight: 500,
                  }}
                >
                  {entry.status === "error"
                    ? entry.error ?? "Error"
                    : statusLabel(entry)}
                </p>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  removeEntry(entry.id);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-secondary)",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 2,
                  flexShrink: 0,
                }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Active editor */}
        {activeEntry ? (
          <div>
            {/* Controls */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Place option:
              </span>
              {LETTERS.map((l) => (
                <button
                  key={l}
                  onClick={() => setActiveLetter(l)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: activeLetter === l ? "#6d28d9" : "#e5e7eb",
                    color: activeLetter === l ? "#fff" : "#374151",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}

              <span
                style={{
                  marginLeft: 12,
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                }}
              >
                Correct:
              </span>
              {LETTERS.map((l) => (
                <button
                  key={l}
                  onClick={() =>
                    updateEntry(activeEntry.id, { correctLetter: l })
                  }
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "none",
                    background:
                      activeEntry.correctLetter === l ? "#16a34a" : "#e5e7eb",
                    color:
                      activeEntry.correctLetter === l ? "#fff" : "#374151",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}

              <button
                onClick={() =>
                  updateEntry(activeEntry.id, {
                    regions: { ...DEFAULT_REGIONS },
                  })
                }
                style={{
                  marginLeft: "auto",
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "0.5px solid var(--color-border-secondary)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                }}
              >
                Auto Detect
              </button>
              <button
                onClick={() => updateEntry(activeEntry.id, { regions: {} })}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "0.5px solid var(--color-border-secondary)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                }}
              >
                Clear Regions
              </button>

              {/* Per-image upload */}
              <button
                onClick={() => uploadOne(activeEntry)}
                disabled={activeEntry.status === "uploading" || activeEntry.status === "done"}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    activeEntry.status === "done"
                      ? "#16a34a"
                      : activeEntry.status === "uploading"
                      ? "#a855f7"
                      : "#6d28d9",
                  color: "#fff",
                  cursor:
                    activeEntry.status === "uploading" ||
                    activeEntry.status === "done"
                      ? "default"
                      : "pointer",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {activeEntry.status === "done"
                  ? "Uploaded ✓"
                  : activeEntry.status === "uploading"
                  ? "Uploading…"
                  : "Upload This"}
              </button>
            </div>

            {/* Image canvas */}
            <div
              style={{
                position: "relative",
                border: "1px solid var(--color-border-secondary)",
                borderRadius: 8,
                overflow: "hidden",
                background: "#000",
                maxHeight: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={activeEntry.previewUrl}
                alt={activeEntry.file.name}
                onClick={(e) => handleImageClick(e, activeEntry)}
                style={{
                  width: "100%",
                  display: "block",
                  cursor: "crosshair",
                  userSelect: "none",
                }}
                draggable={false}
              />

              {/* Region overlays */}
              {Object.entries(activeEntry.regions).map(([letter, r]) => (
                <div
                  key={letter}
                  draggable
                  onDoubleClick={() => {
                    const copy = { ...activeEntry.regions };
                    delete copy[letter];
                    updateEntry(activeEntry.id, { regions: copy });
                  }}
                  onDragEnd={(e) => {
                    const rect =
                      e.currentTarget.parentElement!.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    updateEntry(activeEntry.id, {
                      regions: {
                        ...activeEntry.regions,
                        [letter]: { ...r, x, y },
                      },
                    });
                  }}
                  style={{
                    position: "absolute",
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    border: `2px solid ${
                      activeEntry.correctLetter === letter ? "#16a34a" : "#ef4444"
                    }`,
                    background:
                      activeEntry.correctLetter === letter
                        ? "rgba(22,163,74,0.15)"
                        : "rgba(239,68,68,0.1)",
                    cursor: "move",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      activeEntry.correctLetter === letter
                        ? "#16a34a"
                        : "#ef4444",
                    fontWeight: 700,
                    fontSize: 13,
                    userSelect: "none",
                  }}
                  title="Drag to move · Double-click to remove"
                >
                  {letter.toUpperCase()}
                  {/* Resize handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startW = r.w;
                      const startH = r.h;
                      const parentRect =
                        e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();

                      const onMove = (ev: MouseEvent) => {
                        const dx = (ev.clientX - startX) / parentRect.width;
                        const dy = (ev.clientY - startY) / parentRect.height;
                        updateEntry(activeEntry.id, {
                          regions: {
                            ...activeEntry.regions,
                            [letter]: {
                              ...r,
                              w: Math.max(0.05, startW + dx),
                              h: Math.max(0.05, startH + dy),
                            },
                          },
                        });
                      };
                      const onUp = () => {
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      background:
                        activeEntry.correctLetter === letter
                          ? "#16a34a"
                          : "#ef4444",
                      cursor: "nwse-resize",
                    }}
                  />
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "6px 0 0" }}>
              Click image to place <strong>{activeLetter.toUpperCase()}</strong> · Drag region to move · Double-click to remove · Drag corner to resize
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 200,
              color: "var(--color-text-secondary)",
              fontSize: 13,
              border: "1px dashed var(--color-border-secondary)",
              borderRadius: 8,
            }}
          >
            Select an image from the list
          </div>
        )}
      </div>
    </div>
  );
}