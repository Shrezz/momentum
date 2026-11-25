// JSON Schema sent to the Responses API. Runtime validation lives in validation.ts.
const text = { type: "string" };
const integer = { type: "integer" };
const exercise = {
  type: "object",
  additionalProperties: false,
  required: ["name", "sets", "target", "unit", "rest", "note"],
  properties: {
    name: text,
    sets: integer,
    target: { type: "number" },
    unit: { type: "string", enum: ["reps", "seconds", "minutes"] },
    rest: integer,
    note: text,
  },
};
const workout = {
  type: "object",
  additionalProperties: false,
  required: ["title", "kind", "minutes", "location", "focus", "exercises"],
  properties: {
    title: text,
    kind: {
      type: "string",
      enum: ["strength", "conditioning", "cardio", "rest"],
    },
    minutes: integer,
    location: { type: "string", enum: ["Home", "Gym"] },
    focus: text,
    exercises: { type: "array", items: exercise },
  },
};
export const planOutput = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "days"],
  properties: { summary: text, days: { type: "array", items: workout } },
};
export const chatOutput = {
  type: "object",
  additionalProperties: false,
  required: ["message", "proposal"],
  properties: {
    message: text,
    proposal: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["day", "workout", "reason"],
          properties: { day: integer, workout, reason: text },
        },
      ],
    },
  },
};
