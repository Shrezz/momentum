import { Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import {
  days,
  dateFor,
  weekLabel,
  type Plan,
  type TrainingState,
} from "@/lib/training";

type Props = {
  state: TrainingState;
  week: string;
  plan?: Plan;
  onWeek: (delta: number) => void;
  onGenerate: () => void;
  onDay: (day: number) => void;
  onCommit: () => void;
  onSwap: (from: number, to: number) => void;
};

export function WeekPlan({
  state,
  week,
  plan,
  onWeek,
  onGenerate,
  onDay,
  onCommit,
  onSwap,
}: Props) {
  return (
    <>
      <div className="page-toolbar">
        <div className="week-picker">
          <button
            className="icon-button"
            aria-label="Previous week"
            onClick={() => onWeek(-1)}
          >
            <ChevronLeft />
          </button>
          <h3>Week of {weekLabel(week)}</h3>
          <button
            className="icon-button"
            aria-label="Next week"
            onClick={() => onWeek(1)}
          >
            <ChevronRight />
          </button>
        </div>
        <button className="primary" onClick={onGenerate}>
          <Sparkles size={18} />{" "}
          {plan ? "Create a new draft" : "Plan this week"}
        </button>
      </div>
      {!plan ? (
        <section className="panel empty-state">
          <h2>A fresh week is waiting.</h2>
          <p>
            Generate a personalized draft or start with the strength +
            conditioning template.
          </p>
          <button className="secondary" onClick={onGenerate}>
            Create weekly plan
          </button>
        </section>
      ) : (
        <>
          <div className="plan-intro">
            <span className="pill">
              {plan.source === "ai" ? "AI-generated" : "Starter template"} ·{" "}
              {plan.committed ? "Committed" : "Draft"}
            </span>
            <p>{plan.summary}</p>
            {!plan.committed && (
              <button className="secondary" onClick={onCommit}>
                Commit to this week
              </button>
            )}
          </div>
          <div className="weekly-list">
            {plan.days.map((workout, day) => {
              const session = state.sessions.find(
                (s) => s.week === week && s.day === day,
              );
              return (
                <section
                  className={`panel week-card kind-${workout.kind}`}
                  key={day}
                >
                  <div className="calendar-date">
                    <span>{days[day].slice(0, 3)}</span>
                    <strong>{dateFor(week, day).getDate()}</strong>
                  </div>
                  <div className="week-workout">
                    <span className="eyebrow">{workout.focus}</span>
                    <h3>{workout.title}</h3>
                    <p>
                      {workout.kind === "rest"
                        ? "Recovery is on the plan."
                        : `${workout.minutes} min · ${workout.location} · ${workout.exercises.length} exercises`}
                    </p>
                  </div>
                  <div className="week-actions">
                    {session?.finished ? (
                      <span className="success-label">
                        <Check size={16} /> Logged
                      </span>
                    ) : (
                      <button className="secondary" onClick={() => onDay(day)}>
                        View session
                      </button>
                    )}
                    <label className="move-label">
                      <span className="sr-only">
                        Swap {days[day]} with another day
                      </span>
                      <select
                        value=""
                        disabled={!!session}
                        onChange={(event) =>
                          onSwap(day, Number(event.target.value))
                        }
                      >
                        <option value="">Move day…</option>
                        {days.map((name, index) =>
                          index !== day &&
                          !state.sessions.some(
                            (s) => s.week === week && s.day === index,
                          ) ? (
                            <option key={name} value={index}>
                              Swap with {name}
                            </option>
                          ) : null,
                        )}
                      </select>
                    </label>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
