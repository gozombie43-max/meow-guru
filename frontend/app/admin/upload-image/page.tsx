"use client";
import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/api/http";

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

    const res = await fetchWithRetry(
      "/api/upload-image",
      {
        method: "POST",
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

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
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
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>Image Question Builder</h2>

      <input type="file" onChange={handleImage} />

      {/* Option selector */}
      <div style={{ marginTop: 15, display: "flex", gap: 10 }}>
        {["a", "b", "c", "d"].map((k) => (
          <button
            key={k}
            onClick={() => setCurrent(k)}
            style={{
              padding: "8px 14px",
              background: current === k ? "#007bff" : "#ddd",
              color: current === k ? "#fff" : "#000",
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
          <button
            key={k}
            onClick={() => setCorrect(k)}
            style={{
              marginRight: 10,
              padding: "6px 12px",
              background: correct === k ? "green" : "#ddd",
              color: correct === k ? "#fff" : "#000",
              border: "none",
              borderRadius: 5,
            }}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      <button onClick={autoDetect}>
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
              width: 600,
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
          >
            <div
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: "top left",
                position: "relative",
                width: 500,
              }}
            >
              <img
                src={image}
                style={{ width: "100%", borderRadius: 8 }}
                onClick={handleClick}
              />

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
                  <div
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
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      background: "red",
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
          />
        </div>
      )}

      <button onClick={() => setRegions({})}>
        Reset Regions
      </button>

      <button
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
