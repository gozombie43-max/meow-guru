"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { GeometryDiagram } from "@/components/geometry/diagramSchema";

const GeometryRenderer = dynamic(() => import("@/components/geometry/GeometryRenderer"), {
  ssr: false,
});

type VisualTable = {
  type: "table";
  title?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

type VisualChart = {
  type: "chart";
  title?: string;
  chartType?: "bar" | "line";
  labels: string[];
  values: number[];
  unit?: string;
};

type VisualDiagram = {
  type: "diagram";
  title?: string;
  diagram: GeometryDiagram;
};

type VisualBlock = VisualTable | VisualChart | VisualDiagram;

type ParsedResponse = {
  markdown: string;
  visuals: VisualBlock[];
};

type VisualResponseProps = {
  content: string;
  normalizeMarkdown: (content: string) => string;
};

const visualFenceRegex = /```(?:ssc-visual|visual|visual-json)\s*([\s\S]*?)```/gi;
const tableSeparatorRegex = /^:?-{3,}:?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeVisual(value: unknown): VisualBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "diagram" && isRecord(value.diagram) && Array.isArray(value.diagram.shapes)) {
    return {
      type: "diagram",
      title: typeof value.title === "string" ? value.title : undefined,
      diagram: value.diagram as unknown as GeometryDiagram,
    };
  }

  if (value.type === "table" && isStringArray(value.headers) && Array.isArray(value.rows)) {
    return {
      type: "table",
      title: typeof value.title === "string" ? value.title : undefined,
      headers: value.headers,
      rows: value.rows
        .filter(Array.isArray)
        .map((row) =>
          row.map((cell) =>
            typeof cell === "number" || typeof cell === "string" ? cell : String(cell ?? "")
          )
        ),
    };
  }

  if (value.type === "chart" && isStringArray(value.labels) && Array.isArray(value.values)) {
    const values = value.values
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));

    if (values.length === 0) return null;

    return {
      type: "chart",
      title: typeof value.title === "string" ? value.title : undefined,
      chartType: value.chartType === "line" ? "line" : "bar",
      labels: value.labels.slice(0, values.length),
      values,
      unit: typeof value.unit === "string" ? value.unit : undefined,
    };
  }

  return null;
}

function splitTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function isTableSeparatorLine(line: string) {
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isLikelyPipeTableLine(line: string) {
  return line.includes("|") && splitTableCells(line).length >= 2;
}

function splitLooseTableRow(line: string, expectedColumns?: number): string[] | null {
  const trimmed = line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "");
  if (!trimmed || /^[-*_]{3,}$/.test(trimmed)) return null;

  const wideSpaceCells = trimmed.split(/\s{2,}|\t+/).map((cell) => cell.trim()).filter(Boolean);
  if (wideSpaceCells.length >= 2) return wideSpaceCells;

  const gluedHeaderCells = trimmed.match(/[A-Z][a-z]+|[A-Z]+(?=[A-Z]|$)/g);
  if (
    !expectedColumns &&
    gluedHeaderCells &&
    gluedHeaderCells.length >= 2 &&
    gluedHeaderCells.join("") === trimmed
  ) {
    return gluedHeaderCells;
  }

  const trailingNumber = trimmed.match(/^(.+?)[\s]*([-+]?\d+(?:\.\d+)?%?)$/);
  if (trailingNumber && trailingNumber[1].trim() && /\D/.test(trailingNumber[1])) {
    return [trailingNumber[1].trim(), trailingNumber[2]];
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (!expectedColumns && words.length >= 2 && words.length <= 5) return words;
  if (expectedColumns && words.length === expectedColumns) return words;

  return null;
}

function isPlainTableTitle(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 70) return false;
  if (/^#{1,6}\s/.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\s'():/-]*$/.test(trimmed);
}

function extractLooseTextTables(content: string): ParsedResponse {
  const visuals: VisualBlock[] = [];
  const lines = content.split("\n");
  const remove = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (remove.has(index)) continue;

    const header = splitLooseTableRow(lines[index]);
    if (!header || header.length < 2 || header.length > 6) continue;

    const rows: string[][] = [];
    let cursor = index + 1;

    while (cursor < lines.length) {
      const row = splitLooseTableRow(lines[cursor], header.length);
      if (!row || row.length !== header.length) break;
      rows.push(row);
      cursor += 1;
    }

    if (rows.length < 2) continue;

    let title: string | undefined;
    let titleIndex = index - 1;
    while (titleIndex >= 0 && !lines[titleIndex].trim()) titleIndex -= 1;
    if (titleIndex >= 0 && isPlainTableTitle(lines[titleIndex])) {
      title = lines[titleIndex].trim();
      remove.add(titleIndex);
    }

    visuals.push({
      type: "table",
      title,
      headers: header,
      rows,
    });

    for (let removeIndex = index; removeIndex < cursor; removeIndex += 1) {
      remove.add(removeIndex);
    }

    index = cursor - 1;
  }

  return {
    markdown: lines
      .filter((_line, index) => !remove.has(index))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    visuals,
  };
}

function tableFromCells(cells: string[], title?: string): VisualTable | null {
  const firstSeparatorIndex = cells.findIndex((cell) => tableSeparatorRegex.test(cell));
  if (firstSeparatorIndex <= 0) return null;

  const headers = cells.slice(0, firstSeparatorIndex);
  const dataCells = cells.slice(firstSeparatorIndex).filter((cell) => !tableSeparatorRegex.test(cell));
  if (headers.length < 2 || dataCells.length < headers.length) return null;

  const rows: string[][] = [];
  for (let index = 0; index + headers.length - 1 < dataCells.length; index += headers.length) {
    rows.push(dataCells.slice(index, index + headers.length));
  }

  return {
    type: "table",
    title,
    headers,
    rows,
  };
}

function extractPipeTables(content: string): ParsedResponse {
  const visuals: VisualBlock[] = [];
  const lines = content.split("\n");
  const nextLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const inlineTable = tableFromCells(splitTableCells(line));

    if (inlineTable) {
      visuals.push(inlineTable);
      continue;
    }

    if (
      isLikelyPipeTableLine(line) &&
      index + 1 < lines.length &&
      isTableSeparatorLine(lines[index + 1])
    ) {
      const headers = splitTableCells(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && isLikelyPipeTableLine(lines[index])) {
        const row = splitTableCells(lines[index]);
        if (row.length > 0) rows.push(row);
        index += 1;
      }

      index -= 1;

      if (headers.length > 1 && rows.length > 0) {
        visuals.push({
          type: "table",
          title: undefined,
          headers,
          rows,
        });
        continue;
      }
    }

    if (trimmed !== "|") {
      nextLines.push(line);
    }
  }

  return {
    markdown: nextLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    visuals,
  };
}

function extractVisuals(content: string): ParsedResponse {
  const visuals: VisualBlock[] = [];
  const normalizedContent = content.replace(/<br\s*\/?>/gi, "\n");
  const markdownWithoutVisualJson = normalizedContent.replace(visualFenceRegex, (_match, rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson.trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        const visual = normalizeVisual(candidate);
        if (visual) visuals.push(visual);
      }
    } catch {
      return _match;
    }

    return "";
  });

  const tableParsed = extractPipeTables(markdownWithoutVisualJson);
  const looseTableParsed = extractLooseTextTables(tableParsed.markdown);

  return {
    markdown: looseTableParsed.markdown,
    visuals: [...visuals, ...tableParsed.visuals, ...looseTableParsed.visuals],
  };
}

function TableVisual({ block }: { block: VisualTable }) {
  const renderCell = (value: string | number | undefined) => (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]]}
      components={{
        p: ({ children }) => <span>{children}</span>,
      }}
    >
      {String(value ?? "")}
    </ReactMarkdown>
  );

  return (
    <div className="table-visual-block">
      {block.title && <h3 className="table-title">{block.title}</h3>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th key={header}>{renderCell(header)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {block.headers.map((header, columnIndex) => (
                  <td
                    key={`${header}-${columnIndex}`}
                    className={columnIndex > 0 ? "numeric-cell" : undefined}
                  >
                    {renderCell(row[columnIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartVisual({ block }: { block: VisualChart }) {
  const width = 620;
  const height = 240;
  const pad = 34;
  const max = Math.max(...block.values, 1);
  const chartWidth = width - pad * 2;
  const chartHeight = height - pad * 2;
  const barGap = 10;
  const barWidth = Math.max(18, (chartWidth - barGap * (block.values.length - 1)) / block.values.length);
  const points = block.values.map((value, index) => {
    const x =
      block.values.length === 1
        ? pad + chartWidth / 2
        : pad + (index / (block.values.length - 1)) * chartWidth;
    const y = pad + chartHeight - (value / max) * chartHeight;
    return `${x},${y}`;
  });

  return (
    <div className="visual-block">
      {block.title && <div className="visual-title">{block.title}</div>}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={block.title ?? "Chart"}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#d1d5db" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#d1d5db" />
        {block.chartType === "line" ? (
          <>
            <polyline points={points.join(" ")} fill="none" stroke="#10a37f" strokeWidth="3" />
            {block.values.map((value, index) => {
              const [x, y] = points[index].split(",").map(Number);
              return (
                <g key={`${block.labels[index]}-${index}`}>
                  <circle cx={x} cy={y} r="4" fill="#10a37f" />
                  <text x={x} y={y - 9} textAnchor="middle" fontSize="11" fill="#374151">
                    {value}
                    {block.unit ?? ""}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          block.values.map((value, index) => {
            const barHeight = (value / max) * chartHeight;
            const x = pad + index * (barWidth + barGap);
            const y = height - pad - barHeight;
            return (
              <g key={`${block.labels[index]}-${index}`}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill="#10a37f" />
                <text x={x + barWidth / 2} y={y - 7} textAnchor="middle" fontSize="11" fill="#374151">
                  {value}
                  {block.unit ?? ""}
                </text>
              </g>
            );
          })
        )}
        {block.labels.map((label, index) => {
          const x =
            block.chartType === "line"
              ? block.values.length === 1
                ? pad + chartWidth / 2
                : pad + (index / (block.values.length - 1)) * chartWidth
              : pad + index * (barWidth + barGap) + barWidth / 2;
          return (
            <text key={`${label}-${index}`} x={x} y={height - 11} textAnchor="middle" fontSize="11" fill="#6b7280">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function DiagramVisual({ block }: { block: VisualDiagram }) {
  return (
    <div className="visual-block diagram-block">
      {block.title && <div className="visual-title">{block.title}</div>}
      <GeometryRenderer diagram={block.diagram} />
    </div>
  );
}

export default function VisualResponse({ content, normalizeMarkdown }: VisualResponseProps) {
  const { markdown, visuals } = extractVisuals(content);

  return (
    <>
      {markdown && (
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]]}
        >
          {normalizeMarkdown(markdown)}
        </ReactMarkdown>
      )}

      {visuals.map((visual, index) => {
        if (visual.type === "diagram") return <DiagramVisual key={index} block={visual} />;
        if (visual.type === "table") return <TableVisual key={index} block={visual} />;
        return <ChartVisual key={index} block={visual} />;
      })}

      <style jsx>{`
        .visual-block {
          margin: 14px 0 4px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          overflow: hidden;
        }

        .visual-title {
          border-bottom: 1px solid #e5e7eb;
          background: #fafafa;
          padding: 9px 12px;
          color: #202123;
          font-size: 13px;
          font-weight: 700;
        }

        .table-visual-block {
          margin: 18px 0 6px;
        }

        .table-title {
          margin: 0 0 18px;
          color: #07111f;
          font-size: clamp(26px, 4vw, 42px);
          line-height: 1.08;
          font-weight: 800;
          letter-spacing: 0;
        }

        .table-scroll {
          overflow-x: auto;
          border: 2px solid #6b7280;
          background: #ffffff;
        }

        table {
          width: 100%;
          min-width: 520px;
          border-collapse: collapse;
          table-layout: fixed;
          border: 0;
          background: #ffffff;
          font-size: clamp(22px, 3.4vw, 32px);
          line-height: 1.25;
          font-variant-numeric: tabular-nums;
        }

        th,
        td {
          border: 2px solid #6b7280;
          padding: 28px 38px;
          text-align: left;
          vertical-align: middle;
          word-break: break-word;
        }

        th {
          background: #f8fafc;
          color: #07111f;
          font-weight: 800;
          text-align: center;
          border-color: #6b7280;
          white-space: nowrap;
        }

        tbody td {
          height: 92px;
          color: #07111f;
          font-weight: 400;
        }

        .numeric-cell {
          text-align: center;
        }

        th :global(.katex),
        td :global(.katex) {
          font-size: 0.92em;
        }

        th :global(p),
        td :global(p) {
          margin: 0;
        }

        td :global(.katex-display) {
          margin: 0;
          overflow: visible;
        }

        svg {
          display: block;
          width: 100%;
          height: auto;
          padding: 10px;
        }

        .diagram-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 12px;
        }

        .diagram-block .visual-title {
          align-self: stretch;
        }
      `}</style>
    </>
  );
}
