import { useState } from "react";
import {
  createTemplate,
  weekLabel,
  type Plan,
  type TrainingState,
} from "@/lib/training";
import { Modal } from "./Modal";
import { AgentPlanner } from "./AgentPlanner";
import { PlanDraft } from "./PlanDraft";

type Props = {
  state: TrainingState;
  week: string;
  aiConfigured: boolean;
  saved: boolean;
  onAccept: (plan: Plan) => void;
  onClose: () => void;
};
export function GeneratePlan({
  state,
  week,
  aiConfigured,
  saved,
  onAccept,
  onClose,
}: Props) {
  const [template, setTemplate] = useState<Plan | null>(null);
  const started = state.sessions.some((session) => session.week === week);
  return (
    <Modal title="Build your week" onClose={onClose}>
      <div className="generate-content">
        <span className="pill">
          Week of {weekLabel(week)} · {state.profile.minutes} min ·{" "}
          {state.profile.location}
        </span>
        <p>
          Three lifting commitments. Two conditioning sessions. Cardio + core.
          One day to recharge.
        </p>
        {started ? (
          <p className="inline-error">
            This week has already started. Choose next week in My week to create
            a fresh program. Your logged workouts stay put.
          </p>
        ) : template ? (
          <>
            <PlanDraft plan={template} />
            <div className="modal-actions">
              <button className="secondary" onClick={() => setTemplate(null)}>
                Back
              </button>
              <button className="primary" onClick={() => onAccept(template)}>
                Use starter plan
              </button>
            </div>
          </>
        ) : (
          <>
            <AgentPlanner week={week} enabled={aiConfigured} saved={saved} />
            {!aiConfigured && (
              <p className="field-help">
                Live AI isn’t connected on this server yet. The starter program
                is available below.
              </p>
            )}
            <div className="template-option">
              <h3>Or start with the essentials</h3>
              <p>
                A fixed template for dumbbells, a bench, and a treadmill. It
                uses your selected duration; it does not adapt to limitations or
                increase weights.
              </p>
              <button
                className="secondary full"
                onClick={() => setTemplate(createTemplate(week, state.profile))}
              >
                Preview starter template
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
