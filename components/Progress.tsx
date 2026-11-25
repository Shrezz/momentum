import { Check, Download, Dumbbell } from "lucide-react";
import {
  completedLifts,
  days,
  shiftWeek,
  weekLabel,
  type TrainingState,
} from "@/lib/training";

type Props = {
  state: TrainingState;
  week: string;
  onSession: (id: string) => void;
  onExport: () => void;
};

export function Progress({ state, week, onSession, onExport }: Props) {
  const sessions = state.sessions.filter((session) => session.finished);
  const weeks = [-3, -2, -1, 0].map((delta) => shiftWeek(week, delta));
  return (
    <>
      <div className="page-toolbar">
        <p className="quiet">Proof that you’re showing up.</p>
        <button className="secondary" onClick={onExport}>
          <Download size={17} /> Export my data
        </button>
      </div>
      <div className="progress-stats">
        <section className="panel">
          <span className="eyebrow">THIS WEEK</span>
          <strong className="big-stat">
            {completedLifts(state, week)}
            <small> / 3</small>
          </strong>
          <p>Lifting commitments kept</p>
        </section>
        <section className="panel">
          <span className="eyebrow">TOTAL SESSIONS</span>
          <strong className="big-stat">{sessions.length}</strong>
          <p>Including partial sessions</p>
        </section>
        <section className="panel">
          <span className="eyebrow">SETS LOGGED</span>
          <strong className="big-stat">
            {sessions.reduce(
              (count, session) =>
                count + session.sets.filter((set) => set.done).length,
              0,
            )}
          </strong>
          <p>Every rep has a place here</p>
        </section>
      </div>
      <section className="panel consistency-chart">
        <div className="section-heading">
          <h3>Consistency over perfection</h3>
          <span className="quiet">Lifting days · goal 3/week</span>
        </div>
        <div
          className="bar-chart"
          role="img"
          aria-label={weeks
            .map(
              (w) =>
                `${weekLabel(w)}: ${completedLifts(state, w)} lifting days`,
            )
            .join("; ")}
        >
          {weeks.map((w) => (
            <div className="bar-column" key={w}>
              <strong>{completedLifts(state, w)}</strong>
              <div className="bar-track">
                <div
                  style={{
                    height: `${Math.min(100, (completedLifts(state, w) / 3) * 100)}%`,
                  }}
                />
              </div>
              <span>{weekLabel(w)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel history">
        <div className="section-heading">
          <h3>Your training log</h3>
          <Dumbbell size={20} />
        </div>
        {!sessions.length ? (
          <div className="empty-state">
            <h3>Your first entry starts with showing up.</h3>
            <p>
              Log a session to see your history here. No sample achievements,
              just your work.
            </p>
          </div>
        ) : (
          [...sessions].reverse().map((session) => (
            <button
              className="history-row"
              key={session.id}
              onClick={() => onSession(session.id)}
            >
              <span className="history-check">
                <Check size={18} />
              </span>
              <div>
                <strong>{session.title}</strong>
                <p>
                  {new Date(session.finished!).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {days[session.day]} ·{" "}
                  {session.sets.filter((set) => set.done).length}/
                  {session.sets.length} sets · {session.effort}
                </p>
              </div>
              <span className="pill">
                {session.sets.every((set) => set.done) ? "Complete" : "Partial"}
              </span>
            </button>
          ))
        )}
      </section>
    </>
  );
}
