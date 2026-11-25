import { z } from "zod";
export const exerciseSchema = z.object({
  name: z.string().min(1).max(100),
  sets: z.number().int().min(1).max(8),
  target: z.number().min(1).max(120),
  unit: z.enum(["reps", "seconds", "minutes"]),
  rest: z.number().int().min(0).max(300),
  note: z.string().max(500),
});
export const workoutSchema = z.object({
  title: z.string().min(1).max(100),
  kind: z.enum(["strength", "conditioning", "cardio", "rest"]),
  minutes: z.number().int().min(0).max(45),
  location: z.enum(["Home", "Gym"]),
  focus: z.string().max(150),
  exercises: z.array(exerciseSchema).max(10),
});
export const planSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["template", "ai"]),
  committed: z.boolean(),
  summary: z.string().max(2000),
  days: z.array(workoutSchema).length(7),
});
const setSchema = z.object({
  exercise: z.string().max(100),
  set: z.number().int().min(1).max(8),
  value: z
    .string()
    .max(6)
    .refine(
      (s) =>
        s === "" ||
        (Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 9999),
    ),
  weight: z
    .string()
    .max(7)
    .refine(
      (s) =>
        s === "" ||
        (Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) <= 9999),
    ),
  done: z.boolean(),
  unit: z.enum(["reps", "seconds", "minutes"]),
});
export const stateSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    name: z.string().min(1).max(50),
    minutes: z.number().int().min(35).max(45),
    location: z.enum(["Home", "Gym"]),
    equipment: z.string().max(1500),
    limitations: z.string().max(1500),
    units: z.enum(["kg", "lb"]),
    goal: z.string().max(1000),
  }),
  plans: z.record(planSchema).refine((v) => Object.keys(v).length <= 104),
  sessions: z
    .array(
      z.object({
        id: z.string().max(80),
        week: z.string().max(10),
        day: z.number().int().min(0).max(6),
        title: z.string().max(100),
        kind: workoutSchema.shape.kind,
        started: z.string().max(40),
        finished: z.string().max(40).nullable(),
        sets: z.array(setSchema).max(80),
        effort: z.string().max(50),
        note: z.string().max(1000),
        units: z.enum(["kg", "lb"]),
      }),
    )
    .max(1000),
  messages: z
    .array(
      z.object({
        id: z.string().max(80),
        role: z.enum(["user", "assistant"]),
        text: z.string().max(6000),
        proposal: z
          .object({
            day: z.number().int().min(0).max(6),
            workout: workoutSchema,
            reason: z.string().max(1000),
            week: z.string().max(10),
          })
          .optional(),
        applied: z.boolean().optional(),
      }),
    )
    .max(100),
  energy: z.string().max(30),
});
export function validateGeneratedDays(days: z.infer<typeof workoutSchema>[]) {
  if (days.length !== 7) throw new Error("The plan needs exactly seven days.");
  const counts = { strength: 0, conditioning: 0, cardio: 0, rest: 0 };
  for (const d of days) {
    counts[d.kind]++;
    if (d.kind === "rest") {
      if (d.minutes !== 0 || d.exercises.length)
        throw new Error("Rest day must be empty.");
    } else if (d.minutes < 35 || d.minutes > 45 || !d.exercises.length)
      throw new Error(
        "Each workout needs exercises and a 35–45 minute duration.",
      );
  }
  if (
    counts.strength !== 3 ||
    counts.conditioning !== 2 ||
    counts.cardio !== 1 ||
    counts.rest !== 1
  )
    throw new Error(
      "The plan must keep your 3 lifting, 2 conditioning, 1 cardio, 1 rest split.",
    );
}
