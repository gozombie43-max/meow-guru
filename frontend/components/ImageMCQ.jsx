import { useState } from "react";
import Image from "next/image";

export default function ImageMCQ({ data, onAnswer }) {
  const [selected, setSelected] = useState(null);

  const handleClick = (key) => {
    setSelected(key);
    onAnswer(key);
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 600 }}>
      
      {/* Question Image */}
      <Image
        src={data.questionImage}
        alt="question"
        width={600}
        height={400}
        style={{ width: "100%", height: "auto", display: "block" }}
        unoptimized
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
          />
        ))}
    </div>
  );
}