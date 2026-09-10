"use client";
import styles from "@/components/admin/AdminTool.module.css";
import { getAccessToken } from "@/lib/axios";
import { fetchWithRetry } from "@/lib/api/http";
import { useEffect,useState } from "react";

type Region = { x: number; y: number; w: number; h: number };

function readDraft() {
  if (typeof window === "undefined") {
    return { regions: {} as Record<string, Region>, correct: "a" };
  }

  const saved = localStorage.getItem("image_mcq_draft");
  if (!saved) {
    return { regions: {} as Record<string, Region>, correct: "a" };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      regions: parsed?.regions || {},
      correct: parsed?.correct || "a",
    };
  } catch {
    return { regions: {} as Record<string, Region>, correct: "a" };
  }
}

export default function UploadImage() {
  const draft = readDraft();
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [regions, setRegions] = useState<Record<string, Region>>(draft.regions);
  const [current, setCurrent] = useState<string>("a");
  const [correct, setCorrect] = useState<string>(draft.correct);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const data = { regions, correct };
    localStorage.setItem("image_mcq_draft", JSON.stringify(data));
  }, [regions, correct]);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImage(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) return alert("Select image");
    if (Object.keys(regions).length < 2) {
      return alert("Mark at least 2 options");
    }

    const formData = new FormData();
    formData.append("questionImage", file);
    formData.append("topic", "visual_reasoning");
    formData.append("correctLetter", correct);
    formData.append("optionRegions", JSON.stringify(regions));

    const token = getAccessToken();
    if (!token) throw new Error("Your admin session has expired");
    const res = await fetchWithRetry(
      "/api/upload-image",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
      {
        attempts: 3,
        timeoutMs: 20000,
        retryDelayMs: 5000,
        retryMethods: ["POST"],
        retryOnStatuses: [502, 503, 504],
      }
    );

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw new Error(data?.error || "Upload failed");
    }

    console.log(data);
    localStorage.removeItem("image_mcq_draft");
    setRegions({});
    setCorrect("a");
    alert("Uploaded");
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const x = (e.clientX - rect.left - offset.x) / (rect.width * scale);
    const y = (e.clientY - rect.top - offset.y) / (rect.height * scale);

    setRegions((prev) => ({
      ...prev,
      [current]: { x, y, w: 0.3, h: 0.15 },
    }));
  };

  const autoDetect = () => {
    const detected = {
      a: { x: 0, y: 0.6, w: 0.5, h: 0.2 },
      b: { x: 0.5, y: 0.6, w: 0.5, h: 0.2 },
      c: { x: 0, y: 0.8, w: 0.5, h: 0.2 },
      d: { x: 0.5, y: 0.8, w: 0.5, h: 0.2 },
    };

    setRegions(detected);
  };

  return (
    <div className={styles.shell} style={{ padding: 0, maxWidth: "100%", margin: "0 auto" }}>
      <h2 className={styles.pageTitle}>Image Question Builder</h2>

      <input className={styles.macInput} aria-label="Question image" type="file" accept="image/*" onChange={handleImage} />

      {/* Option selector */}
      <div style={{ marginTop: 15, display: "flex", gap: 10 }}>
        {["a", "b", "c", "d"].map((k) => (
          <button data-ui-button="state"
            key={k}
            onClick={() => setCurrent(k)}
            style={{
              padding: "8px 14px",
              minHeight: 44,
              background: current === k ? "#007bff" : "var(--admin-surface-muted)",
              color: current === k ? "#fff" : "var(--admin-text)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 15 }}>
        <p>Select Correct Answer:</p>
        {["a", "b", "c", "d"].map((k) => (
          <button data-ui-button="state"
            key={k}
            onClick={() => setCorrect(k)}
            style={{
              marginRight: 10,
              padding: "6px 12px",
              minHeight: 44,
              background: correct === k ? "green" : "var(--admin-surface-muted)",
              color: correct === k ? "#fff" : "var(--admin-text)",
              border: "none",
              borderRadius: 5,
            }}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <button data-ui-button="secondary" className={styles.btnSecondary} onClick={autoDetect}>
        Auto Detect Options
      </button>

      {/* Image area */}
      {image && (
        <div style={{ marginTop: 20 }}>
          <p>
            Click on image to place: <b>{current.toUpperCase()}</b>
          </p>

          <div
            style={{
              overflow: "hidden",
              border: "1px solid #ccc",
              width: "100%",
              maxWidth: 600,
              height: 400,
              position: "relative",
              cursor: "grab",
            }}
            onWheel={(e) => {
              e.preventDefault();
              const newScale = Math.min(3, Math.max(0.5, scale - e.deltaY * 0.001));
              setScale(newScale);
            }}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startY = e.clientY;
              const startOffset = { ...offset };

              const onMove = (ev: MouseEvent) => {
                setOffset({
                  x: startOffset.x + (ev.clientX - startX),
                  y: startOffset.y + (ev.clientY - startY),
                });
              };

              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };

              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
            role="application"
            aria-label="Answer-region image editor. Drag to pan and use the mouse wheel to zoom."
          >
            <div
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: "top left",
                position: "relative",
                width: "100%",
                maxWidth: 500,
              }}
            >
              <button data-ui-button="state"
                type="button"
                onClick={handleClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setRegions((prev) => ({
                      ...prev,
                      [current]: { x: 0.35, y: 0.4, w: 0.3, h: 0.15 },
                    }));
                  }
                }}
                aria-label={`Place answer region ${current.toUpperCase()} in the center`}
                style={{ display: "block", width: "100%", padding: 0, border: 0, background: "transparent" }}
              >
                <img
                  src={image}
                  alt="Question with editable answer regions"
                  style={{ width: "100%", borderRadius: 8 }}
                />
              </button>

              {Object.entries(regions).map(([k, r]) => (
                <div
                  key={k}
                  draggable
                  onDoubleClick={() => {
                    const copy = { ...regions };
                    delete copy[k];
                    setRegions(copy);
                  }}
                  onDragEnd={(e) => {
                    const rect = e.currentTarget.parentElement!.getBoundingClientRect();

                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;

                    setRegions((prev) => ({
                      ...prev,
                      [k]: { ...prev[k], x, y },
                    }));
                  }}
                  role="group"
                  aria-label={`Answer region ${k.toUpperCase()}; double-click to remove`}
                  style={{
                    position: "absolute",
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    border: "2px solid red",
                    background: "rgba(255,0,0,0.1)",
                    cursor: "move",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "red",
                    fontWeight: "bold",
                  }}
                >
                  {k.toUpperCase()}

                  {/* Resize handle */}
                  <button data-ui-button="state"
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();

                      const startX = e.clientX;
                      const startY = e.clientY;

                      const startW = r.w;
                      const startH = r.h;

                      const rect = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();

                      const onMove = (ev: MouseEvent) => {
                        const dx = (ev.clientX - startX) / rect.width;
                        const dy = (ev.clientY - startY) / rect.height;

                        setRegions((prev) => ({
                          ...prev,
                          [k]: {
                            ...prev[k],
                            w: Math.max(0.05, startW + dx),
                            h: Math.max(0.05, startH + dy),
                          },
                        }));
                      };

                      const onUp = () => {
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };

                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 0.05 : 0.01;
                      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
                      event.preventDefault();
                      setRegions((prev) => ({
                        ...prev,
                        [k]: {
                          ...prev[k],
                          w: Math.max(0.05, prev[k].w + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0)),
                          h: Math.max(0.05, prev[k].h + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0)),
                        },
                      }));
                    }}
                    aria-label={`Resize answer region ${k.toUpperCase()}`}
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      background: "red",
                      border: 0,
                      padding: 0,
                      cursor: "nwse-resize",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* JSON output */}
      {Object.keys(regions).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p>
            <b>Generated JSON:</b>
          </p>
          <textarea
            value={JSON.stringify(regions, null, 2)}
            readOnly
            style={{ width: "100%", height: 150 }}
            aria-label="Generated answer-region JSON"
          />
        </div>
      )}

      <button data-ui-button="secondary" className={styles.btnSecondary} onClick={() => setRegions({})}>
        Reset Regions
      </button>

      <button data-ui-button="state"
        onClick={async () => {
          try {
            await handleUpload();
          } catch {
            alert("Upload failed");
          }
        }}
        style={{
          marginTop: 10,
          padding: "10px 20px",
          background: "green",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        Upload Question
      </button>
    </div>
  );
}
