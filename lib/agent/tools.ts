import { z } from "zod";
import { createTemplate, type TrainingState } from "../training.ts";
import { validateGeneratedDays, workoutSchema } from "../validation.ts";
import { planOutput } from "../coach-schema.ts";
import type { AgentRun } from "./types.ts";

const empty = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};
const tool = (
  name: string,
  description: string,
  parameters: object = empty,
) => ({ type: "function", name, description, parameters, strict: true });
export const agentTools = [
  tool(
    "read_profile",
    "Read the saved goal, equipment, session duration, units and limitations.",
  ),
  tool(
    "read_history",
    "Read recent training, completed sets and past programs. Empty history is valid; do not invent progress.",
  ),
  tool(
    "find_exercises",
    "Get the allowed exercise catalogue for the saved equipment. Use exact names and required equipment.",
  ),
  tool(
    "check_plan",
    "Check a drafted weekly plan against the split, time budget and available exercise catalogue. Correct returned errors and call again.",
    planOutput,
  ),
  tool(
    "propose_plan",
    "Hand the last successfully checked draft to the user. Requires profile, history and catalogue reads. This never saves a workout plan.",
  ),
  tool(
    "ask_user",
    "Pause for a missing preference or human guidance. Use this instead of guessing around injuries or uncertain constraints.",
    {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
      additionalProperties: false,
    },
  ),
];

const requirements: Record<string, string[]> = {
  "Goblet squat": ["dumbbell"],
  "Dumbbell Romanian deadlift": ["dumbbell"],
  "Dumbbell bench press": ["dumbbell", "bench"],
  "Supported dumbbell row": ["dumbbell", "bench"],
  "Seated dumbbell press": ["dumbbell", "bench"],
  "Dumbbell curl": ["dumbbell"],
  "Dumbbell floor press": ["dumbbell"],
  "Farmer hold": ["dumbbell"],
  "Easy treadmill walk": ["treadmill"],
  "Treadmill intervals": ["treadmill"],
  "Steady treadmill walk": ["treadmill"],
};

export function exerciseCatalogue(state: TrainingState) {
  // Accept clear inventory entries; ambiguous or negated prose is not confirmation.
  const equipment = state.profile.equipment
    .toLowerCase()
    .split(/[,;\n.]/)
    .map((item) => item.trim());
  const hasEquipment = (item: string) =>
    equipment.some((entry) =>
      new RegExp(`^(?:adjustable |a )?${item}s?$`).test(entry),
    );
  const all = createTemplate("2000-01-03", state.profile).days.flatMap(
    (day) => day.exercises,
  );
  const unique = [
    ...new Map(all.map((exercise) => [exercise.name, exercise])).values(),
  ];
  return unique
    .filter((exercise) =>
      (requirements[exercise.name] || []).every((item) => hasEquipment(item)),
    )
    .map((exercise) => ({
      name: exercise.name,
      unit: exercise.unit,
      note: exercise.note,
      equipment: requirements[exercise.name] || ["bodyweight"],
    }));
}

export function checkDraft(input: unknown, run: AgentRun) {
  const parsed = z
    .object({
      summary: z.string().min(1).max(2000),
      days: z.array(workoutSchema).length(7),
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      errors: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .slice(0, 8),
      plan: null,
    };
  const errors: string[] = [];
  try {
    validateGeneratedDays(parsed.data.days);
  } catch (error) {
    errors.push((error as Error).message);
  }
  const allowed = new Map(
    exerciseCatalogue(run.snapshot).map((exercise) => [
      exercise.name,
      exercise.unit,
    ]),
  );
  for (const day of parsed.data.days) {
    if (day.minutes > run.snapshot.profile.minutes)
      errors.push(`${day.title}: exceeds the preferred duration.`);
    if (day.location !== run.snapshot.profile.location)
      errors.push(
        `${day.title}: use the saved location, or ask the user to update preferences.`,
      );
    for (const exercise of day.exercises) {
      if (
        allowed.has(exercise.name) &&
        allowed.get(exercise.name) !== exercise.unit
      )
        errors.push(
          `${exercise.name}: use the catalogue unit ${allowed.get(exercise.name)}.`,
        );
      if (!allowed.has(exercise.name))
        errors.push(
          `Unavailable exercise: ${exercise.name}. Choose from find_exercises.`,
        );
    }
    // Estimate, not a guarantee: warm-up, transitions, active work and rest.
    const requiredMinutes =
      7 +
      day.exercises.reduce(
        (total, exercise) =>
          total +
          exercise.sets *
            ([
              "Supported dumbbell row",
              "Dead bug",
              "Reverse lunge",
              "Side plank",
              "Split squat",
            ].includes(exercise.name)
              ? 2
              : 1) *
            (exercise.unit === "minutes"
              ? exercise.target
              : exercise.unit === "seconds"
                ? exercise.target / 60
                : (exercise.target * 3) / 60) +
          ((exercise.sets - 1) * exercise.rest) / 60,
        0,
      );
    if (day.kind !== "rest" && requiredMinutes > day.minutes)
      errors.push(
        `${day.title}: estimated work, rest, warm-up and transitions exceed the time budget.`,
      );
  }
  const plan = errors.length
    ? null
    : {
        ...parsed.data,
        week: run.week,
        source: "ai" as const,
        committed: false,
      };
  return { errors: [...new Set(errors)].slice(0, 10), plan };
}

export async function executeTool(
  run: AgentRun,
  name: string,
  input: unknown,
): Promise<{ run: AgentRun; output: unknown; detail: string }> {
  switch (name) {
    case "read_profile":
      return {
        run,
        output: run.snapshot.profile,
        detail: "Read your saved goals, equipment and preferences.",
      };
    case "read_history": {
      const sessions = run.snapshot.sessions
        .filter((session) => session.finished)
        .slice(-12);
      return {
        run,
        output: {
          sessions,
          recentPlans: Object.values(run.snapshot.plans)
            .sort((a, b) => b.week.localeCompare(a.week))
            .slice(0, 3),
          instruction: sessions.length
            ? "Use only checked sets as evidence."
            : "No completed training history. Establish a baseline; do not infer strength or increase loads.",
        },
        detail: `Reviewed ${sessions.length} completed sessions and recent plans.`,
      };
    }
    case "find_exercises": {
      const exercises = exerciseCatalogue(run.snapshot);
      return {
        run,
        output: {
          exercises,
          note: "Curated prototype catalogue, not a medical or trainer-validated exercise database.",
        },
        detail: `Found ${exercises.length} movements for your saved equipment.`,
      };
    }
    case "check_plan": {
      const missing = ["read_profile", "read_history", "find_exercises"].filter(
        (toolName) => !run.completedTools.includes(toolName),
      );
      if (missing.length)
        return {
          run: { ...run, candidate: null },
          output: {
            valid: false,
            errors: [`Read these tools first: ${missing.join(", ")}`],
          },
          detail: "Draft checking paused: required context is missing.",
        };
      const { errors, plan } = checkDraft(input, run);
      return {
        run: { ...run, candidate: plan },
        output: { valid: !!plan, errors },
        detail: plan
          ? "Passed weekly split, exercise availability and time-budget checks."
          : `Draft needs revision: ${errors.join(" ")}`,
      };
    }
    case "propose_plan": {
      if (!run.candidate)
        return {
          run,
          output: {
            error:
              "No validated draft. Call check_plan and resolve its errors first.",
          },
          detail: "Blocked an unchecked proposal.",
        };
      return {
        run: {
          ...run,
          draft: run.candidate,
          status: "awaiting_approval",
          finishedAt: new Date().toISOString(),
        },
        output: { status: "awaiting_approval" },
        detail: "Draft ready. Waiting for your approval before saving.",
      };
    }
    case "ask_user": {
      const { question } = z
        .object({ question: z.string().min(1).max(1000) })
        .parse(input);
      return {
        run: { ...run, status: "needs_input", question },
        output: { status: "needs_input" },
        detail: question,
      };
    }
    default:
      throw new Error("Unknown tool. Use only the available tools.");
  }
}
