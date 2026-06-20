"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import type { GeometryDiagram } from "@/components/geometry/diagramSchema";

const GeometryRenderer = dynamic(() => import("@/components/geometry/GeometryRenderer"), {
  ssr: false,
  loading: () => <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontFamily: "sans-serif", fontSize: 13 }}>Loading diagram...</div>
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function getNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function getPoint(value: unknown, fallback: { x: number; y: number }) {
  if (!isRecord(value)) return fallback;
  const x = Number(value.x);
  const y = Number(value.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
}

function normalizeDiagramShape(shape: unknown) {
  if (!isRecord(shape) || typeof shape.type !== "string") return shape;

  const rawType = [
    shape.type,
    typeof shape.name === "string" ? shape.name : "",
    typeof shape.solid === "string" ? shape.solid : "",
    typeof shape.description === "string" ? shape.description : "",
  ]
    .filter(Boolean)
    .join(" ");
  const type = rawType.toLowerCase().replace(/[\s-]+/g, "_");
  const label =
    typeof shape.label === "string"
      ? shape.label
      : typeof shape.caption === "string"
        ? shape.caption
        : undefined;

  if (
    /cyl(?:i|y)nder/.test(type) &&
    (/hemi/.test(type) || /dome/.test(type) || /top/.test(type))
  ) {
    const radius = getNumber(shape.radius ?? shape.r, 2);
    const height = getNumber(shape.height ?? shape.cylinder_height ?? shape.h, radius * 2);
    return {
      type: "cylinder_with_hemisphere",
      center: getPoint(shape.center, { x: 0, y: 0 }),
      radius,
      height,
      label,
      labels: {
        ...(isRecord(shape.labels) ? shape.labels : {}),
        radius: isRecord(shape.labels) && typeof shape.labels.radius === "string" ? shape.labels.radius : "Radius",
        height: isRecord(shape.labels) && typeof shape.labels.height === "string" ? shape.labels.height : "height",
      },
    };
  }

  if (type === "sphere" || type === "hemisphere") {
    const radius = getNumber(shape.radius ?? shape.r, 2);
    return {
      type,
      center: getPoint(shape.center, { x: 0, y: 0 }),
      radius,
      label,
      labels: {
        ...(isRecord(shape.labels) ? shape.labels : {}),
        radius: isRecord(shape.labels) && typeof shape.labels.radius === "string" ? shape.labels.radius : `r = ${radius}`,
      },
    };
  }

  if (type === "cone" || type === "right_circular_cone") {
    const radius = getNumber(shape.radius ?? shape.base_radius ?? shape.bottom_radius, 2);
    const height = getNumber(shape.height ?? shape.slant_height ?? shape.slantHeight, radius * 1.7);
    return {
      type: "cone",
      center: getPoint(shape.center, { x: 0, y: 0 }),
      radius,
      height,
      slant_height: getNumber(shape.slant_height ?? shape.slantHeight, 0) || undefined,
      label,
      labels: {
        ...(isRecord(shape.labels) ? shape.labels : {}),
        radius: isRecord(shape.labels) && typeof shape.labels.radius === "string" ? shape.labels.radius : "Radius",
        height: isRecord(shape.labels) && typeof shape.labels.height === "string" ? shape.labels.height : "height",
        slant_height: isRecord(shape.labels) && typeof shape.labels.slant_height === "string" ? shape.labels.slant_height : undefined,
      },
    };
  }

  if (type === "frustum" || type === "frustrum" || type === "truncated_cone") {
    const topRadius = getNumber(shape.top_radius ?? shape.r1 ?? shape.small_radius, 1.5);
    const bottomRadius = getNumber(shape.bottom_radius ?? shape.r2 ?? shape.large_radius, topRadius + 1);
    const height = getNumber(shape.height ?? shape.slant_height ?? shape.slantHeight, bottomRadius * 1.4);
    return {
      type: "frustum",
      center: getPoint(shape.center, { x: 0, y: 0 }),
      top_radius: topRadius,
      bottom_radius: bottomRadius,
      height,
      slant_height: getNumber(shape.slant_height ?? shape.slantHeight, 0) || undefined,
      label,
      labels: {
        ...(isRecord(shape.labels) ? shape.labels : {}),
        top_radius: isRecord(shape.labels) && typeof shape.labels.top_radius === "string" ? shape.labels.top_radius : `r = ${topRadius}`,
        bottom_radius: isRecord(shape.labels) && typeof shape.labels.bottom_radius === "string" ? shape.labels.bottom_radius : `R = ${bottomRadius}`,
        height: isRecord(shape.labels) && typeof shape.labels.height === "string" ? shape.labels.height : `h = ${height}`,
        slant_height: isRecord(shape.labels) && typeof shape.labels.slant_height === "string" ? shape.labels.slant_height : undefined,
      },
    };
  }

  if (type === "cylinder" || type === "cyclinder") {
    const radius = getNumber(shape.radius ?? shape.r, 2);
    const height = getNumber(shape.height ?? shape.h, radius * 2);
    return {
      type: "cylinder",
      center: getPoint(shape.center, { x: 0, y: 0 }),
      radius,
      height,
      label,
      labels: {
        ...(isRecord(shape.labels) ? shape.labels : {}),
        radius: isRecord(shape.labels) && typeof shape.labels.radius === "string" ? shape.labels.radius : `r = ${radius}`,
        height: isRecord(shape.labels) && typeof shape.labels.height === "string" ? shape.labels.height : `h = ${height}`,
      },
    };
  }

  return shape;
}

function normalizeDiagram(diagram: Record<string, unknown>): GeometryDiagram {
  return {
    ...(diagram as unknown as GeometryDiagram),
    shapes: Array.isArray(diagram.shapes) ? diagram.shapes.map(normalizeDiagramShape) as GeometryDiagram["shapes"] : [],
  };
}

function normalizeVisual(value: unknown): VisualBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;

  if (value.type === "diagram" && isRecord(value.diagram) && Array.isArray(value.diagram.shapes)) {
    return {
      type: "diagram",
      title: typeof value.title === "string" ? value.title : undefined,
      diagram: normalizeDiagram(value.diagram),
    };
  }

  if (value.type === "diagram" && isRecord(value.diagram)) {
    const diagramShape =
      typeof value.diagram.shape === "string"
        ? value.diagram.shape
        : typeof value.diagram.solid === "string"
          ? value.diagram.solid
          : typeof value.diagram.name === "string"
            ? value.diagram.name
            : "";

    if (diagramShape) {
      return {
        type: "diagram",
        title: typeof value.title === "string" ? value.title : undefined,
        diagram: normalizeDiagram({
          ...value.diagram,
          shapes: [
            {
              ...value.diagram,
              type: diagramShape,
            },
          ],
        }),
      };
    }
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

function extractVisuals(content: string): ParsedResponse {
  const visuals: VisualBlock[] = [];
  const normalizedContent = content.replace(/<br\s*\/?>/gi, "\n");
  const markdown = normalizedContent
    .replace(visualFenceRegex, (_match, rawJson: string) => {
      try {
        const parsed = JSON.parse(rawJson.trim());
        const candidates = Array.isArray(parsed) ? parsed : [parsed];
        for (const candidate of candidates) {
          const visual = normalizeVisual(candidate);
          if (visual) visuals.push(visual);
        }
      } catch {
        return "\n\n_[Diagram could not be rendered: invalid visual data.]_\n\n";
      }
      return "\n\n";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    markdown,
    visuals: visuals,
  };
}

function TableVisual({ block }: { block: VisualTable }) {
  const normalizeCellMath = (value: string | number | undefined) => {
    const text = String(value ?? "").trim();
    if (!text || /\$/.test(text)) return text;
    const looksMathy =
      /\\[A-Za-z]+|[_^=]|[Δ²³]|^[A-Za-z]\d+$|^[A-Z]\([^)]+\)$/.test(text) &&
      !/[|]/.test(text);

    if (!looksMathy) return text;

    return `$${text
      .replace(/Δ/g, "\\Delta ")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/\s+/g, " ")
      .trim()}$`;
  };

  const renderCell = (value: string | number | undefined) => (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]]}
      components={{
        p: ({ children }) => <span>{children}</span>,
      }}
    >
      {normalizeCellMath(value)}
    </ReactMarkdown>
  );

  return (
    <div className="table-visual-block">
      {block.title && <h3 className="table-title">{block.title}</h3>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {block.headers.map((header, columnIndex) => (
                <th key={`${header}-${columnIndex}`}>{renderCell(header)}</th>
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
      <div style={{ display: "flex", justifyContent: "center", overflowX: "auto", padding: "10px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ minWidth: "fit-content" }}>
          <GeometryRenderer diagram={block.diagram} />
        </div>
      </div>
    </div>
  );
}

export default function VisualResponse({ content, normalizeMarkdown }: VisualResponseProps) {
  const { markdown, visuals } = extractVisuals(content);

  return (
    <>
      {markdown && (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkMath, remarkGfm]}
            rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]]}
            components={{
              table: (props) => (
                <div className="table-wrapper">
                  <table {...props} />
                </div>
              ),
              th: (props) => <th {...props} />,
              td: (props) => <td {...props} />,
            }}
          >
            {normalizeMarkdown(markdown)}
          </ReactMarkdown>
        </div>
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

        .markdown-body :global(p) {
          margin: 0 0 10px;
        }

        .markdown-body :global(p:last-child) {
          margin-bottom: 0;
        }

        .markdown-body :global(strong) {
          color: #202123;
          font-weight: 700;
        }

        .markdown-body :global(ol),
        .markdown-body :global(ul) {
          margin: 8px 0 10px;
          padding-left: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }

        .markdown-body :global(li) {
          padding-left: 20px;
          position: relative;
        }

        .markdown-body :global(li::before) {
          content: "•";
          color: #f07c6d;
          font-weight: 700;
          position: absolute;
          left: 0;
          top: 0;
        }

        .markdown-body :global(li > p) {
          margin: 0;
        }
      `}</style>
    </>
  );
}
