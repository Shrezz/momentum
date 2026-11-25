import { Check, Clock3, Dumbbell, MapPin, Play, Sparkles } from "lucide-react";
import {
  completedLifts,
  days,
  previousSet,
  type Plan,
  type TrainingState,
} from "@/lib/training";

type Props = {
  state: TrainingState;
  plan: Plan;
  day: number;
  onStart: () => void;
  onDay: (day: number) => void;
  onEnergy: (energy: string) => void;
  onCoach: () => void;
  onCommit: () => void;
};

export function Today({
  state,
  plan,
  day,
  onStart,
  onDay,
  onEnergy,
  onCoach,
  onCommit,
}: Props) {
  const workout = plan.days[day];
  const session = state.sessions.find(
    (s) => s.week === plan.week && s.day === day,
  );
  const lifts = completedLifts(state, plan.week);
  const affirmation = lifts
    ? `${lifts} lifting ${lifts === 1 ? "day" : "days"} logged. That’s you keeping your word.`
    : "You don’t have to feel ready. Just make room for the first rep.";

  return (
    <div className="today-grid">
      <div className="main-column">
        <div className="readiness">
          <span>How’s your energy?</span>
          <div className="segmented">
            {["Low", "Steady", "Ready"].map((energy) => (
              <button
                key={energy}
                onClick={() => onEnergy(energy)}
                aria-pressed={state.energy === energy}
              >
                {energy}
              </button>
            ))}
          </div>
        </div>
        <section className="workout-hero">
          <div className="hero-orbit" aria-hidden="true" />
          <div className="hero-content">
            <span className="eyebrow lime">STRENGTH + CONDITIONING</span>
            <div className="hero-tags">
              <span>{days[day]}</span>
              <span>
                {plan.source === "ai"
                  ? "AI-generated plan"
                  : "Starter template"}
              </span>
            </div>
            <h2>
              {workout.title}
              <span>.</span>
            </h2>
            <p>
              {workout.focus}.{" "}
              {workout.kind === "rest"
                ? "Recovery belongs on the calendar."
                : "One session. One promise to yourself."}
            </p>
            <div className="hero-metrics">
              <span>
                <Clock3 size={17} />
                {workout.minutes ? `${workout.minutes} min` : "No timer today"}
              </span>
              <span>
                <Dumbbell size={17} />
                {workout.exercises.length} exercises
              </span>
              <span>
                <MapPin size={17} />
                {workout.location}
              </span>
            </div>
            {workout.kind !== "rest" && (
              <button
                className="primary start-button"
                onClick={onStart}
                disabled={!!session?.finished}
              >
                {session?.finished ? <Check size={18} /> : <Play size={18} />}{" "}
                {session?.finished
                  ? "Session logged"
                  : session
                    ? "Continue workout"
                    : "Start workout"}
              </button>
            )}
            {workout.kind === "rest" && (
              <div className="rest-message">Today’s mission: recharge.</div>
            )}
          </div>
        </section>
        <section className="panel exercise-preview">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE GAME PLAN</span>
              <h3>
                {workout.kind === "rest"
                  ? "Room to recover"
                  : "Today’s movements"}
              </h3>
            </div>
            <span className="quiet">{state.profile.units}</span>
          </div>
          {workout.kind !== "rest" && (
            <div className="warmup">
              <Clock3 size={17} />
              <div>
                <strong>Ease into it · 5 min</strong>
                <p>
                  Easy movement and lighter practice sets. Included in your
                  session time.
                </p>
              </div>
            </div>
          )}
          {workout.exercises.map((exercise, index) => {
            const previous = previousSet(
              state.sessions,
              exercise.name,
              state.profile.units,
            );
            return (
              <details className="movement" key={exercise.name}>
                <summary>
                  <span className="movement-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{exercise.name}</strong>
                    <p>
                      {exercise.sets} sets × {exercise.target} {exercise.unit}
                    </p>
                  </div>
                  <span className="previous">
                    {previous
                      ? `${previous.weight || "BW"}${previous.weight ? ` ${state.profile.units}` : ""} × ${previous.value}`
                      : "First entry"}
                  </span>
                </summary>
                <div className="movement-detail">
                  {exercise.note}
                  <br />
                  Rest: {exercise.rest} seconds.{" "}
                  {previous
                    ? "Previous values show your most recent logged set."
                    : "Choose a working weight you can control. Log dumbbells per hand."}
                </div>
              </details>
            );
          })}
          {workout.kind === "rest" && (
            <p className="empty-copy">
              No boxes to check. Your next training day will be here when you
              are.
            </p>
          )}
        </section>
      </div>
      <aside className="side-column">
        <section className="panel consistency">
          <span className="eyebrow">KEEPING YOUR WORD</span>
          <div className="consistency-main">
            <div
              className="ring"
              style={
                {
                  "--progress": `${Math.min(lifts / 3, 1) * 100}%`,
                } as React.CSSProperties
              }
            >
              <span>
                {lifts}
                <small>/ 3</small>
              </span>
            </div>
            <div>
              <h3>Lifting days</h3>
              <p>
                Your weekly commitment.
                <br />
                Every honest session counts.
              </p>
            </div>
          </div>
        </section>
        <section className="panel week-mini">
          <div className="section-heading">
            <h3>Your week</h3>
            <span className="pill">
              {plan.committed ? "Committed" : "Draft"}
            </span>
          </div>
          {plan.days.map((item, index) => {
            const logged = state.sessions.some(
              (s) => s.week === plan.week && s.day === index && s.finished,
            );
            return (
              <button
                className={`mini-day ${index === day ? "selected" : ""}`}
                key={index}
                onClick={() => onDay(index)}
              >
                <span className="day-letter">{days[index].slice(0, 1)}</span>
                <div>
                  <strong>{item.focus}</strong>
                  <span>
                    {item.kind === "rest" ? "Rest" : `${item.minutes} min`}
                  </span>
                </div>
                {logged ? (
                  <Check size={17} />
                ) : index === day ? (
                  <span className="today-dot" />
                ) : null}
              </button>
            );
          })}
          {!plan.committed && (
            <button className="secondary full" onClick={onCommit}>
              Commit to this week
            </button>
          )}
        </section>
        <section className="coach-note">
          <Sparkles size={20} />
          <span className="eyebrow">A LITTLE MOMENTUM</span>
          <p>“{affirmation}”</p>
          <button className="text-button" onClick={onCoach}>
            Talk to your coach
          </button>
        </section>
      </aside>
    </div>
  );
}
