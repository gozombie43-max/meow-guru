// ─────────────────────────────────────────────
//  Geometry Diagram Schema  — sulu quiz app
//  Used in both NDJSON question bank and
//  AI-generated diagram responses
// ─────────────────────────────────────────────

export type Point = { x: number; y: number };

export type ShapeType =
  | "triangle"
  | "right_triangle"
  | "circle"
  | "sphere"
  | "hemisphere"
  | "cone"
  | "cylinder"
  | "frustum"
  | "cylinder_with_hemisphere"
  | "line"
  | "angle"
  | "rectangle"
  | "polygon"
  | "axis";

// ── individual shape definitions ──────────────

export interface TriangleShape {
  type: "triangle" | "right_triangle";
  vertices: {
    A: Point;
    B: Point;
    C: Point;
  };
  right_angle_at?: "A" | "B" | "C";       // draws the □ box
  labels?: {
    AB?: string;   // e.g. "5.2 cm"
    BC?: string;
    CA?: string;
    A?: string;    // vertex label override
    B?: string;
    C?: string;
  };
}

export interface CircleShape {
  type: "circle";
  center: Point;
  radius: number;                          // in diagram units
  label?: string;                          // e.g. "O"
  show_center?: boolean;
  chord?: { from: Point; to: Point; label?: string };
}

export interface SolidShape {
  type: "sphere" | "hemisphere" | "cone" | "cylinder" | "frustum" | "cylinder_with_hemisphere";
  center?: Point;                           // base/central reference point
  radius?: number;                          // sphere, hemisphere, cone, cylinder
  top_radius?: number;                      // frustum smaller radius
  bottom_radius?: number;                   // frustum larger radius
  height?: number;                          // cone/cylinder/frustum height
  slant_height?: number;                    // cone/frustum slant height label
  label?: string;
  labels?: {
    radius?: string;
    top_radius?: string;
    bottom_radius?: string;
    height?: string;
    slant_height?: string;
  };
}

export interface LineShape {
  type: "line";
  from: Point;
  to: Point;
  label?: string;
  dashed?: boolean;
  arrow?: "none" | "end" | "both";
}

export interface AngleShape {
  type: "angle";
  vertex: Point;
  from_angle: number;                      // degrees
  to_angle: number;                        // degrees
  radius?: number;                         // arc radius in px, default 20
  label?: string;                          // e.g. "60°"
}

export interface AxisShape {
  type: "axis";
  origin: Point;
  x_label?: string;                        // default "X"
  y_label?: string;                        // default "Y"
  extent?: number;                         // how far axes extend, default 1.5 units
}

export interface RectangleShape {
  type: "rectangle";
  top_left: Point;
  width: number;
  height: number;
  labels?: { top?: string; right?: string; bottom?: string; left?: string };
}

export interface PolygonShape {
  type: "polygon";
  points: Point[];
  labels?: string[];                       // one per vertex
}

export type Shape =
  | TriangleShape
  | CircleShape
  | SolidShape
  | LineShape
  | AngleShape
  | AxisShape
  | RectangleShape
  | PolygonShape;

// ── top-level diagram object ──────────────────

export interface GeometryDiagram {
  id?: string;                             // optional, for NDJSON bank
  scale?: number;                          // px per unit, default 50
  width?: number;                          // canvas width, default 280
  height?: number;                         // canvas height, default 220
  shapes: Shape[];
  caption?: string;                        // shown below diagram
}

// ─────────────────────────────────────────────
//  Example — the triangle from the screenshot
// ─────────────────────────────────────────────
export const EXAMPLE_DIAGRAM: GeometryDiagram = {
  scale: 40,
  width: 280,
  height: 220,
  shapes: [
    {
      type: "axis",
      origin: { x: 4.6, y: 3.6 },
    },
    {
      type: "right_triangle",
      vertices: {
        B: { x: 0,   y: 0   },
        C: { x: 4.6, y: 0   },
        A: { x: 4.6, y: 3.6 },
      },
      right_angle_at: "C",
      labels: {
        AB: "5.2 cm",
        BC: "4.6 cm",
      },
    },
  ],
};
