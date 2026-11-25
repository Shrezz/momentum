import { useEffect, useState } from "react";
import { Check, Pause, Timer, X } from "lucide-react";
import type { Session, Workout } from "@/lib/training";

type Props = {
  session: Session;
  workout: Workout;
  onChange: (session: Session) => void;
  onFinish: () => void;
  onClose: () => void;
  onDiscard: () => void;
};

export function WorkoutLogger({
  session,
  workout,
  onChange,
  onFinish,
  onClose,
  onDiscard,
}: Props) {
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!restUntil) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((restUntil - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [restUntil]);
  const count = session.sets.filter((set) => set.done).length;

  function updateSet(
    index: number,
    field: "value" | "weight" | "done",
    value: string | boolean,
  ) {
    const sets = session.sets.map((set, i) =>
      i === index ? { ...set, [field]: value } : set,
    );
    onChange({ ...session, sets });
    if (field === "done" && value) {
      const rest =
        workout.exercises.find(
          (exercise) => exercise.name === sets[index].exercise,
        )?.rest || 0;
      setRestUntil(Date.now() + rest * 1000);
    }
  }

  return (
    <div className="workout-session">
      <div className="session-top">
        <div>
          <span className="eyebrow">
            {session.finished ? "SESSION RECORD" : "YOU SHOWED UP"}
          </span>
          <h2>{session.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close workout"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="session-progress">
        <span>
          {count} / {session.sets.length} sets logged
        </span>
        <progress value={count} max={session.sets.length} />
      </div>
      {!session.finished && (
        <div className="rest-timer" role="status">
          <Timer size={19} />
          <strong>
            {remaining > 0
              ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
              : "Ready when you are"}
          </strong>
          <span>
            {remaining > 0 ? "Rest timer" : "Timer starts when you log a set"}
          </span>
          {remaining > 0 && (
            <button
              className="text-button"
              onClick={() => {
                setRestUntil(null);
                setRemaining(0);
              }}
            >
              <Pause size={15} /> Skip rest
            </button>
          )}
        </div>
      )}
      {!session.finished && (
        <p className="session-tip">
          Start with 5 minutes of easy movement and lighter practice sets. Log
          dumbbell weight per hand; leave weight blank for bodyweight or timed
          work.
        </p>
      )}
      {workout.exercises.map((exercise) => (
        <section className="panel log-exercise" key={exercise.name}>
          <div className="section-heading">
            <div>
              <h3>{exercise.name}</h3>
              <p>{exercise.note}</p>
            </div>
          </div>
          <div className="set-header">
            <span>Set</span>
            <span>{session.units}</span>
            <span>{exercise.unit}</span>
            <span>Done</span>
          </div>
          {session.sets.map((set, index) =>
            set.exercise !== exercise.name ? null : (
              <div
                className={`set-row ${set.done ? "set-done" : ""}`}
                key={index}
              >
                <span>{set.set}</span>
                <input
                  aria-label={`${set.exercise} set ${set.set} weight in ${session.units}`}
                  type="number"
                  min="0"
                  max="9999"
                  step="0.5"
                  inputMode="decimal"
                  placeholder="BW"
                  value={set.weight}
                  disabled={!!session.finished}
                  onChange={(event) =>
                    updateSet(index, "weight", event.target.value)
                  }
                />
                <input
                  aria-label={`${set.exercise} set ${set.set} ${set.unit}`}
                  type="number"
                  min="1"
                  max="9999"
                  step="0.5"
                  inputMode="decimal"
                  value={set.value}
                  disabled={!!session.finished}
                  onChange={(event) =>
                    updateSet(index, "value", event.target.value)
                  }
                />
                <button
                  className="set-check"
                  aria-label={`${set.done ? "Uncheck" : "Log"} ${set.exercise} set ${set.set}`}
                  aria-pressed={set.done}
                  disabled={
                    !!session.finished ||
                    !set.value ||
                    Number(set.value) <= 0 ||
                    Number(set.value) > 9999 ||
                    Number(set.weight) < 0 ||
                    Number(set.weight) > 9999
                  }
                  onClick={() => updateSet(index, "done", !set.done)}
                >
                  <Check size={18} />
                </button>
              </div>
            ),
          )}
        </section>
      ))}
      {!session.finished && count === 0 && (
        <button className="text-button" onClick={onDiscard}>
          Discard empty session
        </button>
      )}
      <section className="panel session-review">
        <h3>How did that feel?</h3>
        <div className="segmented">
          {["Easy", "Just right", "Challenging"].map((effort) => (
            <button
              key={effort}
              disabled={!!session.finished}
              aria-pressed={session.effort === effort}
              onClick={() => onChange({ ...session, effort })}
            >
              {effort}
            </button>
          ))}
        </div>
        <label>
          Session notes
          <textarea
            maxLength={1000}
            placeholder="A win, a challenge, something to remember…"
            value={session.note}
            disabled={!!session.finished}
            onChange={(event) =>
              onChange({ ...session, note: event.target.value })
            }
          />
        </label>
        {!session.finished && (
          <button className="primary full" disabled={!count} onClick={onFinish}>
            <Check size={18} />
            {count === session.sets.length
              ? "Finish & log workout"
              : "Save as a partial session"}
          </button>
        )}
      </section>
    </div>
  );
}
