import assert from "node:assert/strict";
import test from "node:test";
import {
  initialState,
  createTemplate,
  weekOf,
  shiftWeek,
  makeSession,
  completedLifts,
  previousSet,
} from "../lib/training.ts";
import { stateSchema, validateGeneratedDays } from "../lib/validation.ts";

test("weeks start on Monday and cross year boundaries correctly", () => {
  assert.equal(weekOf(new Date("2027-01-03T12:00:00")), "2026-12-28");
  assert.equal(shiftWeek("2026-12-28", 1), "2027-01-04");
});

test("starter plans keep the agreed split at each supported duration", () => {
  const state = initialState("2026-11-23");
  for (const minutes of [35, 40, 45]) {
    const plan = createTemplate("2026-11-30", { ...state.profile, minutes });
    validateGeneratedDays(plan.days);
    assert.ok(
      plan.days.every(
        (day) => day.minutes === (day.kind === "rest" ? 0 : minutes),
      ),
    );
  }
  assert.equal(stateSchema.safeParse(state).success, true);
});

test("invalid AI weekly splits are rejected", () => {
  const plan = initialState("2026-11-23").plans["2026-11-23"];
  plan.days[1].kind = "strength";
  assert.throws(() => validateGeneratedDays(plan.days));
});

test("draft sessions do not create achievements and duplicate days count once", () => {
  const state = initialState("2026-11-23");
  const session = makeSession(state.plans["2026-11-23"], 0, "lb");
  state.sessions = [session];
  assert.equal(completedLifts(state, "2026-11-23"), 0);
  session.sets[0].done = true;
  session.finished = "2026-11-23T12:40:00Z";
  state.sessions.push({ ...session, id: "duplicate" });
  assert.equal(completedLifts(state, "2026-11-23"), 1);
});

test("previous performance uses the latest checked set and matching weight units", () => {
  const state = initialState("2026-11-23");
  const session = makeSession(state.plans["2026-11-23"], 0, "lb");
  session.finished = "2026-11-23T12:40:00Z";
  session.sets[0] = { ...session.sets[0], done: true, weight: "20" };
  session.sets[1] = { ...session.sets[1], done: true, weight: "25" };
  assert.equal(previousSet([session], "Goblet squat", "lb")?.weight, "25");
  assert.equal(previousSet([session], "Goblet squat", "kg"), undefined);
});

test("logged numeric fields reject impossible or nonnumeric values", () => {
  const state = initialState("2026-11-23");
  state.sessions = [makeSession(state.plans["2026-11-23"], 0, "lb")];
  state.sessions[0].sets[0].weight = "-20";
  assert.equal(stateSchema.safeParse(state).success, false);
  state.sessions[0].sets[0].weight = "25";
  assert.equal(stateSchema.safeParse(state).success, true);
});
