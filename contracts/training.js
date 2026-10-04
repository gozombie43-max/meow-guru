import { z } from 'zod';
export const TRAINING_MODES = [
  "adaptive",
  "challenge",
  "sprint",
  "pressure",
  "section",
  "gauntlet",
  "nightmare",
  "survival",
];
export const TRAINING_EXAMS = [
  { id: "ssc-cgl", label: "SSC CGL" },
  { id: "ssc-chsl", label: "SSC CHSL" },
  { id: "cat", label: "CAT" },
];
export const MISTAKES = [
  "Concept Gap",
  "Calculation Error",
  "Misread",
  "Memory/Formula",
  "Bad Elimination",
  "Time Management",
  "Guessing",
];
export const startSchema = z.object({
  mode: z.enum([...TRAINING_MODES, "review", "mission"]),
  exam: z.enum(TRAINING_EXAMS.map(exam => exam.id)),
  tier: z.enum(["1", "2"]).default("1"),
  subject: z.string().max(100).optional(),
  topic: z.string().max(150).optional(),
  count: z
    .union([
      z.literal(10),
      z.literal(20),
      z.literal(25),
      z.literal(50),
      z.literal("full"),
    ])
    .default(20),
  minutes: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(10),
});
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("answer"),
    revision: z.number().int().nonnegative(),
    choice: z.number().int().nullable(),
    confidence: z.enum(["sure", "unsure", "guess"]).nullable().optional(),
  }),
  z.object({
    type: z.literal("visit"),
    revision: z.number().int().nonnegative(),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("finish"),
    revision: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("abandon"),
    revision: z.number().int().nonnegative(),
  }),
]);
