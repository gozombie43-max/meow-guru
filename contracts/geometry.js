import { z } from 'zod';

const number = z.number().finite().min(-100000).max(100000);
const positive = number.positive();
const text = z.string().max(1000);
const point = z.object({ x: number, y: number });
const labels = keys => z.object(Object.fromEntries(keys.map(key => [key, text.optional()])));
const triangle = z.object({ type: z.enum(['triangle', 'right_triangle']), vertices: z.object({ A: point, B: point, C: point }), right_angle_at: z.enum(['A', 'B', 'C']).optional(), labels: labels(['AB', 'BC', 'CA', 'A', 'B', 'C']).optional() });
const solid = z.object({ type: z.enum(['sphere', 'hemisphere', 'cone', 'cylinder', 'frustum', 'cylinder_with_hemisphere']), center: point.optional(), radius: positive.optional(), top_radius: number.nonnegative().optional(), bottom_radius: positive.optional(), height: positive.optional(), slant_height: positive.optional(), label: text.optional(), labels: labels(['radius', 'top_radius', 'bottom_radius', 'height', 'slant_height']).optional() });
export const geometryDiagramSchema = z.object({
  id: text.optional(), scale: positive.max(1000).optional(), width: positive.max(4096).optional(), height: positive.max(4096).optional(), caption: text.optional(),
  shapes: z.array(z.union([
    triangle, solid,
    z.object({ type: z.literal('circle'), center: point, radius: positive, label: text.optional(), show_center: z.boolean().optional(), chord: z.object({ from: point, to: point, label: text.optional() }).optional() }),
    z.object({ type: z.literal('line'), from: point, to: point, label: text.optional(), dashed: z.boolean().optional(), arrow: z.enum(['none', 'end', 'both']).optional() }),
    z.object({ type: z.literal('angle'), vertex: point, from_angle: number, to_angle: number, radius: positive.optional(), label: text.optional() }),
    z.object({ type: z.literal('axis'), origin: point, extent: positive.optional(), x_label: text.optional(), y_label: text.optional() }),
    z.object({ type: z.literal('rectangle'), top_left: point, width: positive, height: positive, labels: labels(['top', 'right', 'bottom', 'left']).optional() }),
    z.object({ type: z.literal('polygon'), points: z.array(point).min(3).max(100), labels: z.array(text).max(100).optional() }),
  ])).min(1).max(100),
});
