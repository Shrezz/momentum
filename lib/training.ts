export type Kind = "strength" | "conditioning" | "cardio" | "rest";
export type Exercise = {
  name: string;
  sets: number;
  target: number;
  unit: "reps" | "seconds" | "minutes";
  rest: number;
  note: string;
};
export type Workout = {
  title: string;
  kind: Kind;
  minutes: number;
  location: "Home" | "Gym";
  focus: string;
  exercises: Exercise[];
};
export type Plan = {
  week: string;
  source: "template" | "ai";
  committed: boolean;
  summary: string;
  days: Workout[];
};
export type SetLog = {
  exercise: string;
  set: number;
  value: string;
  weight: string;
  done: boolean;
  unit: Exercise["unit"];
};
export type Session = {
  id: string;
  week: string;
  day: number;
  title: string;
  kind: Kind;
  started: string;
  finished: string | null;
  sets: SetLog[];
  effort: string;
  note: string;
  units: "kg" | "lb";
};
export type Profile = {
  name: string;
  minutes: number;
  location: "Home" | "Gym";
  equipment: string;
  limitations: string;
  units: "kg" | "lb";
  goal: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposal?: { day: number; workout: Workout; reason: string; week: string };
  applied?: boolean;
};
export type TrainingState = {
  version: 1;
  profile: Profile;
  plans: Record<string, Plan>;
  sessions: Session[];
  messages: Message[];
  energy: string;
};
export const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekOf(d = new Date()) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return localDate(x);
}
export function shiftWeek(week: string, delta: number) {
  const d = new Date(week + "T12:00:00");
  d.setDate(d.getDate() + delta * 7);
  return localDate(d);
}
export function dateFor(week: string, day: number) {
  const d = new Date(week + "T12:00:00");
  d.setDate(d.getDate() + day);
  return d;
}
export function weekLabel(week: string) {
  return new Date(week + "T12:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
const ex = (
  name: string,
  sets: number,
  target: number,
  unit: Exercise["unit"] = "reps",
  rest = 75,
  note = "Leave a couple of good reps in reserve.",
): Exercise => ({ name, sets, target, unit, rest, note });
export function createTemplate(week: string, profile: Profile): Plan {
  const w = (
    title: string,
    kind: Kind,
    focus: string,
    exercises: Exercise[],
  ): Workout => ({
    title,
    kind,
    focus,
    exercises,
    minutes: kind === "rest" ? 0 : profile.minutes,
    location: profile.location,
  });
  const strengthSets = profile.minutes === 35 ? 2 : 3;
  return {
    week,
    source: "template",
    committed: false,
    summary:
      "Three familiar strength sessions, two conditioning days, cardio + core, and a full rest day. Choose your own working weights; this starter template does not prescribe load increases.",
    days: [
      w("Build your base", "strength", "Lower-body focus", [
        ex("Goblet squat", strengthSets, 8),
        ex("Dumbbell Romanian deadlift", strengthSets, 10),
        ex("Dumbbell bench press", 2, 10),
        ex(
          "Supported dumbbell row",
          2,
          10,
          "reps",
          60,
          "Reps per side; log the weight of one dumbbell.",
        ),
        ex("Dead bug", 2, 8, "reps", 40, "Reps per side, slow and controlled."),
      ]),
      w("Find your engine", "conditioning", "Controlled intervals", [
        ex(
          "Treadmill intervals",
          6,
          1,
          "minutes",
          90,
          "Alternate 1 minute brisk with 90 seconds easy. Pick a pace you control; no all-out sprint needed.",
        ),
        ex("Bodyweight squat", 2, 12, "reps", 45),
        ex("Incline push-up", 2, 10, "reps", 45, "Use a stable bench or wall."),
        ex("Easy walk", 1, 5, "minutes", 0, "Finish comfortably."),
      ]),
      w("Strong from the top", "strength", "Upper-body focus", [
        ex("Dumbbell bench press", strengthSets, 8),
        ex(
          "Supported dumbbell row",
          strengthSets,
          10,
          "reps",
          75,
          "Reps per side; log the weight of one dumbbell.",
        ),
        ex("Seated dumbbell press", 2, 10),
        ex(
          "Reverse lunge",
          2,
          8,
          "reps",
          60,
          "Reps per side. Bodyweight or dumbbells.",
        ),
        ex("Dumbbell curl", 2, 12, "reps", 45),
      ]),
      w("The steady session", "cardio", "Treadmill + core", [
        ex(
          "Steady treadmill walk",
          1,
          profile.minutes - 16,
          "minutes",
          0,
          "Choose a conversational pace.",
        ),
        ex("Dead bug", 2, 8, "reps", 30, "Reps per side."),
        ex(
          "Side plank",
          2,
          20,
          "seconds",
          30,
          "Hold per side; knees down is an option.",
        ),
        ex("Easy cooldown", 1, 3, "minutes", 0, "Slow down gradually."),
      ]),
      w("Finish strong", "strength", "Full-body focus", [
        ex("Dumbbell Romanian deadlift", strengthSets, 8),
        ex("Dumbbell floor press", strengthSets, 10),
        ex(
          "Split squat",
          2,
          8,
          "reps",
          60,
          "Reps per side. Use support for balance.",
        ),
        ex("Supported dumbbell row", 2, 10, "reps", 60, "Reps per side."),
        ex(
          "Farmer hold",
          2,
          30,
          "seconds",
          45,
          "Stand tall with dumbbells at your sides.",
        ),
      ]),
      w("Move your way", "conditioning", "Bodyweight + mobility", [
        ex(
          "Bodyweight circuit",
          4,
          4,
          "minutes",
          60,
          "Repeat comfortable squats, incline push-ups, and marching. Take breaks as needed.",
        ),
        ex("Easy treadmill walk", 1, 5, "minutes", 0),
        ex(
          "Gentle mobility",
          1,
          profile.minutes - 32,
          "minutes",
          0,
          "Choose comfortable hip, ankle, and shoulder movements; yoga blocks can provide support.",
        ),
      ]),
      w("Rest is part of it", "rest", "Recharge for your next week", []),
    ],
  };
}
export function initialState(week = weekOf()): TrainingState {
  const profile: Profile = {
    name: "Shreya",
    minutes: 40,
    location: "Home",
    equipment:
      "Bench, dumbbells, treadmill, leg extension, yoga blocks. Bars/rods available; type and weights not yet confirmed.",
    limitations: "",
    units: "lb",
    goal: "Lift consistently at least 3 days each week. Build discipline and strength.",
  };
  return {
    version: 1,
    profile,
    plans: { [week]: createTemplate(week, profile) },
    sessions: [],
    messages: [],
    energy: "Ready",
  };
}
export function makeSession(
  plan: Plan,
  day: number,
  units: Profile["units"],
): Session {
  const w = plan.days[day];
  return {
    id: crypto.randomUUID(),
    week: plan.week,
    day,
    title: w.title,
    kind: w.kind,
    started: new Date().toISOString(),
    finished: null,
    units,
    sets: w.exercises.flatMap((e) =>
      Array.from({ length: e.sets }, (_, i) => ({
        exercise: e.name,
        set: i + 1,
        value: String(e.target),
        weight: "",
        done: false,
        unit: e.unit,
      })),
    ),
    effort: "Just right",
    note: "",
  };
}
export function previousSet(
  sessions: Session[],
  exercise: string,
  units: string,
) {
  return [...sessions]
    .reverse()
    .filter((s) => s.finished && s.units === units)
    .flatMap((s) =>
      [...s.sets].reverse().filter((x) => x.exercise === exercise && x.done),
    )
    .at(0);
}
export function completedLifts(state: TrainingState, week: string) {
  return new Set(
    state.sessions
      .filter((s) => s.week === week && s.kind === "strength" && s.finished)
      .map((s) => s.day),
  ).size;
}
