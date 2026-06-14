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
import { Stage, Layer, Line, Circle, Arc, Arrow, Text, Rect, Ellipse } from "react-konva";
import type {
  GeometryDiagram, Shape,
  TriangleShape, CircleShape, LineShape,
  AngleShape, AxisShape, RectangleShape, PolygonShape, SolidShape,
  Point,
} from "@/components/geometry/diagramSchema";

// ── design tokens (matches light theme) ───
const T = {
  stroke:      "#111827",
  fill:        "rgba(255,255,255,0)",
  topFill:     "rgba(255,255,255,0)",
  darkSide:    "#111827",
  lightSide:   "#111827",
  highlight:   "rgba(255,255,255,0)",
  shadow:      "rgba(255,255,255,0)",
  label:       "#111827",
  measure:     "#111827",
  axis:        "#9ca3af",
  axisTip:     "#4b5563",
  rightAngle:  "#9ca3af",
  bg:          "transparent",
  fontSize:    12,
  solidFontSize: 13,
  fontFamily:  "Inter, Segoe UI, sans-serif",
};

// ── coord helpers ─────────────────────────────
function createCoords(scale: number, originX: number, originY: number) {
  const tx = (x: number) => originX + x * scale;
  const ty = (y: number) => originY - y * scale;
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  return { tx, ty, mid, dist };
}

function expandBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }, point: Point) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function solidDimensions(shape: SolidShape) {
  const radius = Number.isFinite(shape.radius) && shape.radius ? shape.radius : 2;
  const topRadius = Number.isFinite(shape.top_radius) && shape.top_radius ? shape.top_radius : Math.max(1, radius * 0.65);
  const bottomRadius = Number.isFinite(shape.bottom_radius) && shape.bottom_radius ? shape.bottom_radius : radius;
  const height = Number.isFinite(shape.height) && shape.height ? shape.height : Math.max(radius * 1.8, 3);
  return { radius, topRadius, bottomRadius, height };
}

function getShapeBounds(shapes: Shape[]) {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const solidLabelMargin = 8;

  for (const shape of shapes) {
    if (shape.type === "triangle" || shape.type === "right_triangle") {
      Object.values(shape.vertices || {}).forEach((point) => expandBounds(bounds, point));
    }

    if (shape.type === "circle" && shape.center) {
      const radius = Number.isFinite(shape.radius) ? shape.radius : 1;
      expandBounds(bounds, { x: shape.center.x - radius, y: shape.center.y - radius });
      expandBounds(bounds, { x: shape.center.x + radius, y: shape.center.y + radius });
    }

    if (shape.type === "sphere" || shape.type === "hemisphere") {
      const { radius } = solidDimensions(shape);
      const center = shape.center || { x: 0, y: shape.type === "sphere" ? 0 : 0 };
      expandBounds(bounds, { x: center.x - radius - solidLabelMargin, y: center.y - (shape.type === "sphere" ? radius : 0) });
      expandBounds(bounds, { x: center.x + radius + solidLabelMargin, y: center.y + radius });
    }

    if (shape.type === "cone" || shape.type === "cylinder") {
      const { radius, height } = solidDimensions(shape);
      const center = shape.center || { x: 0, y: 0 };
      expandBounds(bounds, { x: center.x - radius - solidLabelMargin, y: center.y });
      expandBounds(bounds, { x: center.x + radius + solidLabelMargin, y: center.y + height });
    }

    if (shape.type === "cylinder_with_hemisphere") {
      const { radius, height } = solidDimensions(shape);
      const center = shape.center || { x: 0, y: 0 };
      expandBounds(bounds, { x: center.x - radius - solidLabelMargin, y: center.y });
      expandBounds(bounds, { x: center.x + radius + solidLabelMargin, y: center.y + height + radius });
    }

    if (shape.type === "frustum") {
      const { topRadius, bottomRadius, height } = solidDimensions(shape);
      const radius = Math.max(topRadius, bottomRadius);
      const center = shape.center || { x: 0, y: 0 };
      expandBounds(bounds, { x: center.x - radius - solidLabelMargin, y: center.y });
      expandBounds(bounds, { x: center.x + radius + solidLabelMargin, y: center.y + height });
    }

    if (shape.type === "line") {
      if (shape.from) expandBounds(bounds, shape.from);
      if (shape.to) expandBounds(bounds, shape.to);
    }

    if (shape.type === "angle" && shape.vertex) {
      const radiusUnits = (shape.radius || 20) / 40;
      expandBounds(bounds, { x: shape.vertex.x - radiusUnits, y: shape.vertex.y - radiusUnits });
      expandBounds(bounds, { x: shape.vertex.x + radiusUnits, y: shape.vertex.y + radiusUnits });
    }

    if (shape.type === "axis" && shape.origin) {
      const extent = shape.extent || 1.5;
      expandBounds(bounds, { x: shape.origin.x - extent, y: shape.origin.y - extent });
      expandBounds(bounds, { x: shape.origin.x + extent, y: shape.origin.y + extent });
    }

    if (shape.type === "rectangle" && shape.top_left) {
      expandBounds(bounds, shape.top_left);
      expandBounds(bounds, { x: shape.top_left.x + shape.width, y: shape.top_left.y - shape.height });
    }

    if (shape.type === "polygon" && Array.isArray(shape.points)) {
      shape.points.forEach((point) => expandBounds(bounds, point));
    }
  }

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) return null;
  if (bounds.minX === bounds.maxX) {
    bounds.minX -= 1;
    bounds.maxX += 1;
  }
  if (bounds.minY === bounds.maxY) {
    bounds.minY -= 1;
    bounds.maxY += 1;
  }
  return bounds;
}

function arcLinePoints(cx: number, cy: number, rx: number, ry: number, start: number, end: number) {
  const points: number[] = [];
  const steps = 28;
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + ((end - start) * index) / steps;
    points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
  }
  return points;
}

function SolidLabel({ text, x, y, width = 76 }: { text?: string; x: number; y: number; width?: number }) {
  if (!text) return null;
  return (
    <Text
      text={text}
      x={x}
      y={y}
      width={width}
      align="left"
      fontSize={T.solidFontSize}
      fontStyle="bold"
      fontFamily={T.fontFamily}
      fill={T.label}
    />
  );
}

function ArrowHead({ x, y, angle, size = 9 }: { x: number; y: number; angle: number; size?: number }) {
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  return (
    <Line
      points={[
        x,
        y,
        x + Math.cos(left) * size,
        y + Math.sin(left) * size,
        x + Math.cos(right) * size,
        y + Math.sin(right) * size,
      ]}
      closed
      fill={T.measure}
      stroke={T.measure}
      strokeWidth={1}
    />
  );
}

function DashedArrow({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  return (
    <>
      <Line points={[from.x, from.y, to.x, to.y]} stroke={T.measure} strokeWidth={2} dash={[7, 6]} />
      <ArrowHead x={to.x} y={to.y} angle={angle} />
    </>
  );
}

function HeightBracket({ x, topY, bottomY, label }: { x: number; topY: number; bottomY: number; label: string }) {
  const tick = 16;
  return (
    <>
      <Line points={[x, topY, x - tick, topY]} stroke={T.measure} strokeWidth={1.4} />
      <Line points={[x - tick / 2, topY, x - tick / 2, bottomY]} stroke={T.measure} strokeWidth={1.4} />
      <Line points={[x, bottomY, x - tick, bottomY]} stroke={T.measure} strokeWidth={1.4} />
      <Text
        text={label}
        x={x - tick - 76}
        y={(topY + bottomY) / 2 - 8}
        width={66}
        align="right"
        fontSize={13}
        fontStyle="bold"
        fontFamily={T.fontFamily}
        fill={T.label}
      />
    </>
  );
}

function CylinderBody({ x, topY, bottomY, radius }: {
  x: number; topY: number; bottomY: number; radius: number;
}) {
  return (
    <>
      <Line points={[x - radius, topY, x - radius, bottomY]} stroke={T.stroke} strokeWidth={2} />
      <Line points={[x + radius, topY, x + radius, bottomY]} stroke={T.stroke} strokeWidth={2} />
    </>
  );
}

function TopEllipse({ x, y, radius, ellipseY }: { x: number; y: number; radius: number; ellipseY: number }) {
  return (
    <>
      <Ellipse
        x={x}
        y={y}
        radiusX={radius}
        radiusY={ellipseY}
        fill="rgba(255,255,255,0)"
        stroke={T.stroke}
        strokeWidth={2}
      />
    </>
  );
}

// ── right-angle box ───────────────────────────
function RightAngleBox({ cx, cy, s = 8 }: { cx: number; cy: number; s?: number }) {
  if (cx == null || cy == null) return null;
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
  if (!origin) return null;
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
  const vertices = shape.vertices || {};
  const { A, B, C } = vertices;
  const { right_angle_at, labels = {} } = shape;

  if (!A || !B || !C) return null;

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
  const { center, radius = 1, label, show_center, chord } = shape;
  if (!center) return null;
  return (
    <>
      <Circle x={tx(center.x)} y={ty(center.y)} radius={radius * scale}
        fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      {show_center && <Circle x={tx(center.x)} y={ty(center.y)} radius={3} fill={T.stroke} />}
      {label && <Text text={label} x={tx(center.x)+4} y={ty(center.y)-8}
        fontSize={T.fontSize} fontFamily={T.fontFamily} fill={T.label} />}
      {chord && chord.from && chord.to && (
        <Line
          points={[tx(chord.from.x),ty(chord.from.y), tx(chord.to.x),ty(chord.to.y)]}
          stroke={T.measure} strokeWidth={1.5}
        />
      )}
    </>
  );
}

function SphereRenderer({ shape, tx, ty, scale }: {
  shape: SolidShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { radius } = solidDimensions(shape);
  const center = shape.center || { x: 0, y: 0 };
  const cx = tx(center.x);
  const cy = ty(center.y);
  const r = radius * scale;
  const label = shape.labels?.radius || shape.label || `r = ${radius}`;

  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      <Line points={arcLinePoints(cx, cy, r, r * 0.28, Math.PI, 0)} stroke={T.measure} strokeWidth={1.4} dash={[5, 4]} />
      <Line points={arcLinePoints(cx, cy, r, r * 0.28, 0, Math.PI)} stroke={T.measure} strokeWidth={1.4} />
      <Circle x={cx} y={cy} radius={3} fill={T.stroke} />
      <Line points={[cx, cy, cx + r, cy]} stroke={T.measure} strokeWidth={1.7} />
      <SolidLabel text={label} x={cx + r + 10} y={cy - 10} />
    </>
  );
}

function HemisphereRenderer({ shape, tx, ty, scale }: {
  shape: SolidShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { radius } = solidDimensions(shape);
  const center = shape.center || { x: 0, y: 0 };
  const cx = tx(center.x);
  const cy = ty(center.y);
  const r = radius * scale;
  const label = shape.labels?.radius || shape.label || `r = ${radius}`;

  return (
    <>
      <Line points={arcLinePoints(cx, cy, r, r, Math.PI, Math.PI * 2)} closed fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      <Line points={arcLinePoints(cx, cy, r, r * 0.24, Math.PI, 0)} stroke={T.measure} strokeWidth={1.4} dash={[5, 4]} />
      <Line points={arcLinePoints(cx, cy, r, r * 0.24, 0, Math.PI)} stroke={T.measure} strokeWidth={1.4} />
      <Circle x={cx} y={cy} radius={3} fill={T.stroke} />
      <Line points={[cx, cy, cx + r, cy]} stroke={T.measure} strokeWidth={1.7} />
      <SolidLabel text={label} x={cx + r + 10} y={cy + 2} />
    </>
  );
}

function CylinderRenderer({ shape, tx, ty, scale }: {
  shape: SolidShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { radius, height } = solidDimensions(shape);
  const center = shape.center || { x: 0, y: 0 };
  const topY = ty(center.y + height);
  const bottomY = ty(center.y);
  const cx = tx(center.x);
  const r = radius * scale;
  const ellipseY = Math.max(8, r * 0.26);
  const radiusLabel = shape.labels?.radius || "Radius";
  const heightLabel = shape.labels?.height || "Height";

  return (
    <>
      <CylinderBody x={cx} topY={topY} bottomY={bottomY} radius={r} />
      <TopEllipse x={cx} y={topY} radius={r} ellipseY={ellipseY} />
      <Line points={arcLinePoints(cx, bottomY, r, ellipseY, Math.PI, 0)} stroke={T.measure} strokeWidth={1.2} dash={[5, 4]} />
      <Line points={arcLinePoints(cx, bottomY, r, ellipseY, 0, Math.PI)} stroke={T.stroke} strokeWidth={2} />
      <Circle x={cx} y={topY} radius={5} fill="#000000" />
      <Line points={[cx, topY, cx + r * 0.55, topY]} stroke={T.measure} strokeWidth={1.4} />
      <DashedArrow from={{ x: cx + r * 0.55, y: topY - 4 }} to={{ x: cx + r + 32, y: topY - 28 }} />
      <SolidLabel text={radiusLabel} x={cx + r + 34} y={topY - 46} width={90} />
      <HeightBracket x={cx - r - 28} topY={topY} bottomY={bottomY} label={heightLabel} />
    </>
  );
}

function CylinderWithHemisphereRenderer({ shape, tx, ty, scale }: {
  shape: SolidShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { radius, height } = solidDimensions(shape);
  const center = shape.center || { x: 0, y: 0 };
  const cx = tx(center.x);
  const bottomY = ty(center.y);
  const joinY = ty(center.y + height);
  const r = radius * scale;
  const ellipseY = Math.max(8, r * 0.26);
  const heightLabel = shape.labels?.height || "Height";
  const radiusLabel = shape.labels?.radius || "Radius";

  return (
    <>
      <CylinderBody x={cx} topY={joinY} bottomY={bottomY} radius={r} />
      <Line
        points={arcLinePoints(cx, joinY, r, r, Math.PI, Math.PI * 2)}
        closed
        fill="rgba(255,255,255,0)"
        stroke={T.stroke}
        strokeWidth={2}
      />
      <Line points={arcLinePoints(cx, joinY, r, ellipseY, Math.PI, 0)} stroke={T.measure} strokeWidth={1.2} dash={[5, 4]} />
      <Line points={arcLinePoints(cx, joinY, r, ellipseY, 0, Math.PI)} stroke={T.stroke} strokeWidth={1.8} />
      <Line points={arcLinePoints(cx, bottomY, r, ellipseY, Math.PI, 0)} stroke={T.measure} strokeWidth={1.2} dash={[5, 4]} />
      <Line points={arcLinePoints(cx, bottomY, r, ellipseY, 0, Math.PI)} stroke={T.stroke} strokeWidth={2} />
      <Circle x={cx} y={joinY} radius={5} fill="#000000" />
      <Line points={[cx, joinY, cx + r * 0.55, joinY]} stroke={T.measure} strokeWidth={1.4} />
      <DashedArrow from={{ x: cx + r * 0.55, y: joinY - 4 }} to={{ x: cx + r + 32, y: joinY - 28 }} />
      <SolidLabel text={radiusLabel} x={cx + r + 34} y={joinY - 46} width={90} />
      <HeightBracket x={cx - r - 28} topY={joinY} bottomY={bottomY} label={heightLabel} />
    </>
  );
}

function ConeRenderer({ shape, tx, ty, scale }: {
  shape: SolidShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { radius, height } = solidDimensions(shape);
  const center = shape.center || { x: 0, y: 0 };
  const cx = tx(center.x);
  const baseY = ty(center.y);
  const apexY = ty(center.y + height);
  const r = radius * scale;
  const ellipseY = Math.max(8, r * 0.24);

  return (
    <>
      <Line points={[cx, apexY, cx - r, baseY, cx + r, baseY]} closed fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      <Line points={arcLinePoints(cx, baseY, r, ellipseY, Math.PI, 0)} stroke={T.measure} strokeWidth={1.4} dash={[5, 4]} />
      <Line points={arcLinePoints(cx, baseY, r, ellipseY, 0, Math.PI)} stroke={T.stroke} strokeWidth={2} />
      <Line points={[cx, apexY, cx, baseY]} stroke={T.measure} strokeWidth={1.5} dash={[4, 3]} />
      <Line points={[cx, baseY, cx + r, baseY]} stroke={T.measure} strokeWidth={1.7} />
      <SolidLabel text={shape.labels?.radius || `r = ${radius}`} x={cx + r + 8} y={baseY - 4} />
      <SolidLabel text={shape.labels?.height || `h = ${height}`} x={cx + 8} y={(apexY + baseY) / 2 - 10} width={84} />
      <SolidLabel text={shape.labels?.slant_height || (shape.slant_height ? `l = ${shape.slant_height}` : undefined)} x={cx + r * 0.58} y={(apexY + baseY) / 2 - 30} width={86} />
    </>
  );
}

function FrustumRenderer({ shape, tx, ty, scale }: {
  shape: SolidShape; tx:(x:number)=>number; ty:(y:number)=>number; scale:number
}) {
  const { topRadius, bottomRadius, height } = solidDimensions(shape);
  const center = shape.center || { x: 0, y: 0 };
  const cx = tx(center.x);
  const bottomY = ty(center.y);
  const topY = ty(center.y + height);
  const topR = topRadius * scale;
  const bottomR = bottomRadius * scale;
  const topEllipseY = Math.max(7, topR * 0.26);
  const bottomEllipseY = Math.max(8, bottomR * 0.24);

  return (
    <>
      <Line
        points={[cx - topR, topY, cx + topR, topY, cx + bottomR, bottomY, cx - bottomR, bottomY]}
        closed
        fill={T.fill}
        stroke={T.stroke}
        strokeWidth={2}
      />
      <Ellipse x={cx} y={topY} radiusX={topR} radiusY={topEllipseY} fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      <Line points={arcLinePoints(cx, bottomY, bottomR, bottomEllipseY, Math.PI, 0)} stroke={T.measure} strokeWidth={1.4} dash={[5, 4]} />
      <Line points={arcLinePoints(cx, bottomY, bottomR, bottomEllipseY, 0, Math.PI)} stroke={T.stroke} strokeWidth={2} />
      <Line points={[cx, topY, cx + topR, topY]} stroke={T.measure} strokeWidth={1.7} />
      <SolidLabel text={shape.labels?.top_radius || `r = ${topRadius}`} x={cx + topR + 8} y={topY - 12} />
      <Line points={[cx, bottomY, cx + bottomR, bottomY]} stroke={T.measure} strokeWidth={1.7} />
      <SolidLabel text={shape.labels?.bottom_radius || `R = ${bottomRadius}`} x={cx + bottomR + 8} y={bottomY - 2} />
      <Line points={[cx + bottomR + 24, topY, cx + bottomR + 24, bottomY]} stroke={T.measure} strokeWidth={1.5} dash={[4, 3]} />
      <SolidLabel text={shape.labels?.height || `h = ${height}`} x={cx + bottomR + 34} y={(topY + bottomY) / 2 - 10} width={90} />
      <SolidLabel text={shape.labels?.slant_height || (shape.slant_height ? `l = ${shape.slant_height}` : undefined)} x={cx + bottomR * 0.58} y={(topY + bottomY) / 2 - 30} width={86} />
    </>
  );
}

// ── line / arrow ──────────────────────────────
function LineRenderer({ shape, tx, ty }: {
  shape: LineShape; tx:(x:number)=>number; ty:(y:number)=>number
}) {
  const { from, to, label, dashed, arrow = "none" } = shape;
  if (!from || !to) return null;
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
  const { vertex, from_angle = 0, to_angle = 90, radius = 20, label } = shape;
  if (!vertex) return null;
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
  const { top_left, width = 1, height = 1, labels = {} } = shape;
  if (!top_left) return null;
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
  if (!shape.points || !Array.isArray(shape.points)) return null;
  const validPoints = shape.points.filter(
    (point: Point | null | undefined): point is Point =>
      Boolean(point && point.x != null && point.y != null)
  );
  if (validPoints.length === 0) return null;
  const pts = validPoints.flatMap((p: Point) => [tx(p.x), ty(p.y)]);
  return (
    <>
      <Line points={pts} closed fill={T.fill} stroke={T.stroke} strokeWidth={2} />
      {shape.labels?.map((lbl: string, i: number) => {
        if (!validPoints[i]) return null;
        return (
          <Text key={i} text={lbl}
            x={tx(validPoints[i].x)+5} y={ty(validPoints[i].y)-14}
            fontSize={13} fontStyle="bold" fontFamily={T.fontFamily} fill={T.label} />
        );
      })}
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
    case "sphere":
      return <SphereRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
    case "hemisphere":
      return <HemisphereRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
    case "cylinder":
      return <CylinderRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
    case "cylinder_with_hemisphere":
      return <CylinderWithHemisphereRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
    case "cone":
      return <ConeRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
    case "frustum":
      return <FrustumRenderer shape={shape} tx={tx} ty={ty} scale={scale} />;
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
  if (!diagram) return null;

  const {
    shapes = [],
    scale = 50,
    width = 280,
    height = 220,
    caption,
  } = diagram;

  const supportedTypes = ["triangle", "right_triangle", "circle", "sphere", "hemisphere", "cone", "cylinder", "frustum", "cylinder_with_hemisphere", "line", "angle", "axis", "rectangle", "polygon"];
  const validShapes = shapes.filter((s: Shape) => s && supportedTypes.includes(s.type));

  if (validShapes.length === 0) {
    return (
      <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", background: "#f9fafb", borderRadius: "8px", border: "1px dashed #d1d5db" }}>
        <p style={{ color: "#6b7280", margin: 0, fontSize: 13, fontFamily: T.fontFamily }}>[Diagram could not be loaded]</p>
      </div>
    );
  }

  // Fit AI-generated measurements like radius 9 cm inside the canvas.
  const PAD = 34;
  const bounds = getShapeBounds(validShapes);
  const availableWidth = Math.max(width - PAD * 2, 1);
  const availableHeight = Math.max(height - PAD * 2, 1);
  const fitScale = bounds
    ? Math.min(
        availableWidth / Math.max(bounds.maxX - bounds.minX, 1),
        availableHeight / Math.max(bounds.maxY - bounds.minY, 1)
      )
    : scale;
  const fittedScale = Math.min(scale, Math.max(8, fitScale));
  const originX = bounds ? PAD - bounds.minX * fittedScale : PAD;
  const originY = bounds ? height - PAD + bounds.minY * fittedScale : height - PAD;

  const { tx, ty } = createCoords(fittedScale, originX, originY);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <Stage width={width} height={height}>
        <Layer>
          {validShapes.map((shape: Shape, i: number) => (
            <ShapeRenderer key={i} shape={shape} tx={tx} ty={ty} scale={fittedScale} />
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
