"use client";
// ─────────────────────────────────────────────
//  GeometryRenderer.tsx
//  Drop-in Konva renderer for quiz diagrams.
//
//  Install:  npm install react-konva konva
//  Usage:
//    <GeometryRenderer diagram={question.diagram} />
// ─────────────────────────────────────────────

import React from "react";
import { Stage, Layer, Line, Circle, Arc, Arrow, Text, Rect } from "react-konva";
import type {
  GeometryDiagram, Shape,
  TriangleShape, CircleShape, LineShape,
  AngleShape, AxisShape, RectangleShape, PolygonShape,
  Point,
} from "@/components/geometry/diagramSchema";

// ── design tokens (matches sulu dark theme) ───
const T = {
  stroke:      "#5b9cf6",
  fill:        "rgba(59,130,246,0.12)",
  label:       "#d0d4e8",
  measure:     "#8ab4f8",
  axis:        "#4a5a8a",
  axisTip:     "#5b9cf6",
  rightAngle:  "#9097b8",
  bg:          "transparent",
  fontSize:    11,
  fontFamily:  "Inter, Segoe UI, sans-serif",
};

// ── coord helpers ─────────────────────────────
function useCoords(scale: number, originX: number, originY: number) {
  const tx = (x: number) => originX + x * scale;
  const ty = (y: number) => originY - y * scale;
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  return { tx, ty, mid, dist };
}

// ── right-angle box ───────────────────────────
function RightAngleBox({ cx, cy, s = 8 }: { cx: number; cy: number; s?: number }) {
  return (
    <Line
      points={[cx - s, cy, cx - s, cy - s, cx, cy - s]}
      stroke={T.rightAngle}
      strokeWidth={1.2}
      closed={false}
    />
  );
}

// ── axis with arrows ──────────────────────────
function AxisRenderer({ shape, tx, ty }: { shape: AxisShape; tx: (x:number)=>number; ty: (y:number)=>number }) {
  const { origin, x_label = "X", y_label = "Y", extent = 1.5 } = shape;
  const ox = tx(origin.x), oy = ty(origin.y);

  return (
    <>
      {/* Y axis */}
      <Arrow
        points={[ox, oy + extent * 40, ox, oy - extent * 40]}
        pointerLength={7} pointerWidth={6}
        fill={T.axisTip} stroke={T.axis} strokeWidth={1.2}
        dash={[4, 3]}
      />
      {/* X axis */}
      <Arrow
        points={[ox - 10, oy, ox + extent * 60, oy]}
        pointerLength={7} pointerWidth={6}
        fill={T.axisTip} stroke={T.axis} strokeWidth={1.2}
        dash={[4, 3]}
      />
      <Text text={y_label} x={ox + 4} y={oy - extent * 40 - 14}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.axisTip} />
      <Text text={x_label} x={ox + extent * 60 + 4} y={oy - 6}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.axisTip} />
    </>
  );
}

// ── triangle ──────────────────────────────────
function TriangleRenderer({
  shape, tx, ty
}: { shape: TriangleShape; tx: (x:number)=>number; ty: (y:number)=>number }) {
  const { vertices: { A, B, C }, right_angle_at, labels = {} } = shape;

  const flatPts = [tx(B.x),ty(B.y), tx(C.x),ty(C.y), tx(A.x),ty(A.y)];

  // right angle box position
  const verticesByName: Record<"A" | "B" | "C", Point> = { A, B, C };
  const raVertex = right_angle_at ? verticesByName[right_angle_at] : null;

  // mid-points for side labels
  const midAB = { x:(tx(A.x)+tx(B.x))/2, y:(ty(A.y)+ty(B.y))/2 };
  const midBC = { x:(tx(B.x)+tx(C.x))/2, y:(ty(B.y)+ty(C.y))/2 };
  const midCA = { x:(tx(C.x)+tx(A.x))/2, y:(ty(C.y)+ty(A.y))/2 };

  const vertexPairs: [string, Point, number, number][] = [
    ["B", B, -16, 4],
    ["C", C,   6, 4],
    ["A", A,   6, -14],
  ];

  return (
    <>
      {/* filled triangle */}
      <Line points={flatPts} closed fill={T.fill} stroke={T.stroke} strokeWidth={2} />

      {/* right angle box */}
      {raVertex && <RightAngleBox cx={tx(raVertex.x)} cy={ty(raVertex.y)} />}

      {/* side labels */}
      {labels.AB && <Text text={labels.AB} x={midAB.x-20} y={midAB.y-8}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} width={40} align="center" />}
      {labels.BC && <Text text={labels.BC} x={midBC.x-20} y={midBC.y+6}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} width={40} align="center" />}
      {labels.CA && <Text text={labels.CA} x={midCA.x+6} y={midCA.y-8}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} />}

      {/* vertex labels */}
      {vertexPairs.map(([name, pt, dx, dy]: [string, Point, number, number]) => (
        <Text key={name}
          text={labels[name as "A"|"B"|"C"] ?? name}
          x={tx(pt.x)+dx} y={ty(pt.y)+dy}
          fontSize={13} fontStyle="bold"
          fontFamily={T.fontFamily} fill={T.label}
        />
      ))}
    </>
  );
}

// ── circle ────────────────────────────────────
function CircleRenderer({ shape, tx, ty, scale }: {
  shape: CircleShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { center, radius, label, show_center, chord } = shape;
  return (
    <>
      <Circle x={tx(center.x)} y={ty(center.y)} radius={radius * scale}
        fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      {show_center && <Circle x={tx(center.x)} y={ty(center.y)} radius={3} fill={T.stroke} />}
      {label && <Text text={label} x={tx(center.x)+4} y={ty(center.y)-8}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.label} />}
      {chord && (
        <Line
          points={[tx(chord.from.x),ty(chord.from.y), tx(chord.to.x),ty(chord.to.y)]}
          stroke={T.measure} strokeWidth={1.5}
        />
      )}
    </>
  );
}

// ── line / arrow ──────────────────────────────
function LineRenderer({ shape, tx, ty }: {
  shape: LineShape; tx:(x:number)=>number; ty:(y:number)=>number
}) {
  const { from, to, label, dashed, arrow = "none" } = shape;
  const pts = [tx(from.x), ty(from.y), tx(to.x), ty(to.y)];
  const mid = { x:(tx(from.x)+tx(to.x))/2, y:(ty(from.y)+ty(to.y))/2 };

  if (arrow !== "none") {
    return (
      <>
        <Arrow points={pts} pointerLength={7} pointerWidth={6}
          fill={T.stroke} stroke={T.stroke} strokeWidth={1.5}
          dash={dashed ? [4,3] : undefined} />
        {label && <Text text={label} x={mid.x+4} y={mid.y-10}
          fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} />}
      </>
    );
  }

  return (
    <>
      <Line points={pts} stroke={T.stroke} strokeWidth={1.5}
        dash={dashed ? [4,3] : undefined} />
      {label && <Text text={label} x={mid.x+4} y={mid.y-10}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} />}
    </>
  );
}

// ── angle arc ─────────────────────────────────
function AngleRenderer({ shape, tx, ty }: {
  shape: AngleShape; tx:(x:number)=>number; ty:(y:number)=>number
}) {
  const { vertex, from_angle, to_angle, radius = 20, label } = shape;
  const vx = tx(vertex.x), vy = ty(vertex.y);
  const sweep = to_angle - from_angle;
  const midAngle = ((from_angle + to_angle) / 2) * (Math.PI / 180);

  return (
    <>
      <Arc
        x={vx} y={vy}
        innerRadius={0} outerRadius={radius}
        angle={sweep} rotation={-to_angle}
        fill="rgba(59,130,246,0.1)" stroke={T.stroke} strokeWidth={1.2}
      />
      {label && (
        <Text
          text={label}
          x={vx + (radius + 6) * Math.cos(midAngle)}
          y={vy - (radius + 6) * Math.sin(midAngle)}
          fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure}
        />
      )}
    </>
  );
}

// ── rectangle ─────────────────────────────────
function RectangleRenderer({ shape, tx, ty, scale }: {
  shape: RectangleShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { top_left, width, height, labels = {} } = shape;
  const rx = tx(top_left.x), ry = ty(top_left.y);
  const rw = width * scale, rh = height * scale;

  return (
    <>
      <Rect x={rx} y={ry - rh} width={rw} height={rh}
        fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      {labels.top    && <Text text={labels.top}    x={rx+rw/2-16} y={ry-rh-14} fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} />}
      {labels.bottom && <Text text={labels.bottom} x={rx+rw/2-16} y={ry+4}     fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} />}
      {labels.left   && <Text text={labels.left}   x={rx-28}      y={ry-rh/2}  fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} />}
      {labels.right  && <Text text={labels.right}  x={rx+rw+4}    y={ry-rh/2}  fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.measure} />}
    </>
  );
}

// ── polygon ───────────────────────────────────
function PolygonRenderer({ shape, tx, ty }: {
  shape: PolygonShape; tx:(x:number)=>number; ty:(y:number)=>number
}) {
  const pts = shape.points.flatMap((p: Point) => [tx(p.x), ty(p.y)]);
  return (
    <>
      <Line points={pts} closed fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      {shape.labels?.map((lbl: string, i: number) => (
        <Text key={i} text={lbl}
          x={tx(shape.points[i].x)+5} y={ty(shape.points[i].y)-14}
          fontSize={13} fontStyle="bold" fontFamily={T.fontFamily} fill={T.label} />
      ))}
    </>
  );
}

// ── shape dispatcher ──────────────────────────
function ShapeRenderer({ shape, tx, ty, scale }: {
  shape: Shape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  switch (shape.type) {
    case "triangle":
    case "right_triangle":
      return <TriangleRenderer shape={shape} tx={tx} ty={ty} />;
    case "circle":
      return <CircleRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
    case "line":
      return <LineRenderer shape={shape} tx={tx} ty={ty} />;
    case "angle":
      return <AngleRenderer shape={shape} tx={tx} ty={ty} />;
    case "axis":
      return <AxisRenderer shape={shape} tx={tx} ty={ty} />;
    case "rectangle":
      return <RectangleRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
    case "polygon":
      return <PolygonRenderer shape={shape} tx={tx} ty={ty} />;
    default:
      return null;
  }
}

// ── main exported component ───────────────────
interface GeometryRendererProps {
  diagram: GeometryDiagram;
  className?: string;
}

export default function GeometryRenderer({ diagram, className }: GeometryRendererProps) {
  const {
    shapes,
    scale = 50,
    width = 280,
    height = 220,
    caption,
  } = diagram;

  // Origin: bottom-left with padding
  const PAD = 36;
  const originX = PAD;
  const originY = height - PAD;

  const { tx, ty } = useCoords(scale, originX, originY);

  return (
    <div className={className} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <Stage width={width} height={height}>
        <Layer>
          {shapes.map((shape: Shape, i: number) => (
            <ShapeRenderer key={i} shape={shape} tx={tx} ty={ty} scale={scale} />
          ))}
        </Layer>
      </Stage>
      {caption && (
        <p style={{
          fontSize: 11,
          color: "#9097b8",
          fontFamily: T.fontFamily,
          margin: 0,
          textAlign: "center",
          maxWidth: width,
        }}>
          {caption}
        </p>
      )}
    </div>
  );
}
