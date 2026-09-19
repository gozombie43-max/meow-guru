export const geometryDiagramSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    scale: z.ZodOptional<z.ZodNumber>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    caption: z.ZodOptional<z.ZodString>;
    shapes: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        type: z.ZodEnum<{
            triangle: "triangle";
            right_triangle: "right_triangle";
        }>;
        vertices: z.ZodObject<{
            A: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, z.core.$strip>;
            B: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, z.core.$strip>;
            C: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>;
        right_angle_at: z.ZodOptional<z.ZodEnum<{
            A: "A";
            B: "B";
            C: "C";
        }>>;
        labels: z.ZodOptional<z.ZodObject<{
            [x: string]: any;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodEnum<{
            sphere: "sphere";
            hemisphere: "hemisphere";
            cone: "cone";
            cylinder: "cylinder";
            frustum: "frustum";
            cylinder_with_hemisphere: "cylinder_with_hemisphere";
        }>;
        center: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>>;
        radius: z.ZodOptional<z.ZodNumber>;
        top_radius: z.ZodOptional<z.ZodNumber>;
        bottom_radius: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        slant_height: z.ZodOptional<z.ZodNumber>;
        label: z.ZodOptional<z.ZodString>;
        labels: z.ZodOptional<z.ZodObject<{
            [x: string]: any;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"circle">;
        center: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>;
        radius: z.ZodNumber;
        label: z.ZodOptional<z.ZodString>;
        show_center: z.ZodOptional<z.ZodBoolean>;
        chord: z.ZodOptional<z.ZodObject<{
            from: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, z.core.$strip>;
            to: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, z.core.$strip>;
            label: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"line">;
        from: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>;
        to: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>;
        label: z.ZodOptional<z.ZodString>;
        dashed: z.ZodOptional<z.ZodBoolean>;
        arrow: z.ZodOptional<z.ZodEnum<{
            none: "none";
            end: "end";
            both: "both";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"angle">;
        vertex: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>;
        from_angle: z.ZodNumber;
        to_angle: z.ZodNumber;
        radius: z.ZodOptional<z.ZodNumber>;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"axis">;
        origin: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>;
        extent: z.ZodOptional<z.ZodNumber>;
        x_label: z.ZodOptional<z.ZodString>;
        y_label: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"rectangle">;
        top_left: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>;
        width: z.ZodNumber;
        height: z.ZodNumber;
        labels: z.ZodOptional<z.ZodObject<{
            [x: string]: any;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"polygon">;
        points: z.ZodArray<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, z.core.$strip>>;
        labels: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
import { z } from 'zod';
