import { useState } from "react";
import Image from "next/image";

export default function ImageMCQ({ data, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [loadedImage, setLoadedImage] = useState(null);
  const loaded = loadedImage === data?.questionImage;

  const handleClick = (key) => {
    setSelected(key);
    onAnswer(key);
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 600 }}>
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          Loading image...
        </div>
      )}

      {/* Question Image */}
      <Image
        src={data.questionImage}
        alt="question"
        width={600}
        height={400}
        sizes="(max-width: 640px) 100vw, 600px"
        style={{ width: "100%", height: "auto", display: "block" }}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        unoptimized
        onLoadingComplete={() => setLoadedImage(data?.questionImage)}
        onError={() => setLoadedImage(data?.questionImage)}
      />

      {/* Clickable regions */}
      {data.optionRegions &&
        Object.entries(data.optionRegions).map(([key, r]) => (
          <div
            key={key}
            onClick={() => handleClick(key)}
            style={{
              position: "absolute",
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
              cursor: "pointer",
              border: "2px solid red",
            }}
            role="button"
            tabIndex={0}
            aria-label={`Select answer ${key.toUpperCase()}`}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}
          />
        ))}
    </div>
  );
}
