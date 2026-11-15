import React from 'react';

export function ConceptBadge({
  concept,
}: {
  concept: string;
}) {
  const label = concept
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <span style={{ fontSize: "inherit", fontWeight: "inherit" }}>
      {label}
    </span>
  );
}
