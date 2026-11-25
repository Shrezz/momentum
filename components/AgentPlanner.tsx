import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { PublicRun } from "@/lib/agent/types";
import { PlanDraft } from "./PlanDraft";

const labels = {
  running: "Building your week",
  needs_input: "A quick check-in",
  awaiting_approval: "Your draft is ready",
  approved: "Plan saved",
  rejected: "Draft discarded",
  failed: "Planning paused",
};
export function AgentPlanner({
  week,
  enabled,
  saved,
}: {
  week: string;
  enabled: boolean;
  saved: boolean;
}) {
  const [run, setRun] = useState<PublicRun | null>(null);
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/agent?week=${encodeURIComponent(week)}`,
        );
        const data = (await response.json()) as {
          run: PublicRun | null;
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "Unable to load agent progress.");
        if (active) setRun(data.run);
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load progress.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(refresh, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [week]);

  async function send(
    action: string,
    id: string,
    text = "",
  ): Promise<PublicRun> {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, week, message: text }),
    });
    const data = (await response.json()) as { run: PublicRun; error?: string };
    if (!response.ok)
      throw new Error(data.error || "The agent could not continue.");
    setRun(data.run);
    return data.run;
  }
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      if (action === "start") {
        const created = await send("start", crypto.randomUUID(), message);
        await send("run", created.id);
      } else if (run) {
        const updated = await send(
          action,
          run.id,
          action === "answer" ? answer : "",
        );
        if (updated.status === "approved") window.location.reload();
        if (action === "answer") setAnswer("");
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to continue. Your weekly plan is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  const working = busy || !!run?.busy;
  const canStart =
    !run || ["approved", "rejected", "failed"].includes(run.status);
  return (
    <section className="agent-planner" aria-label="Weekly planning agent">
      {loading ? (
        <p role="status">Loading saved planning progress…</p>
      ) : (
        <>
          {run && (
            <>
              <div className="agent-heading">
                <h3>{labels[run.status]}</h3>
                <span className="pill">{run.modelCalls}/12 steps</span>
              </div>
              {run.status === "running" && (
                <p role="status">
                  {working
                    ? "Your coach is reading, drafting, and checking. Progress is saved as it goes."
                    : "This run is paused. Continue from its last saved step."}
                </p>
              )}
              <details
                className="agent-activity"
                open={run.status === "running" || run.status === "failed"}
              >
                <summary>Coach activity · {run.trace.length} events</summary>
                <ol>
                  {run.trace.map((event, index) => (
                    <li
                      key={index}
                      className={
                        event.outcome === "error" ? "agent-event-error" : ""
                      }
                    >
                      {event.detail}
                    </li>
                  ))}
                </ol>
                {!run.trace.length && (
                  <p className="field-help">
                    Waiting for the first tool result.
                  </p>
                )}
              </details>
              {run.status === "needs_input" && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act("answer");
                  }}
                >
                  <label>
                    {run.question}
                    <textarea
                      required
                      maxLength={1000}
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                    />
                  </label>
                  <button
                    className="primary full"
                    disabled={working || !answer.trim() || !enabled}
                  >
                    Continue with my answer
                  </button>
                </form>
              )}
              {run.status === "awaiting_approval" && run.draft && (
                <>
                  <PlanDraft plan={run.draft} />
                  <p className="field-help">
                    Review the exercises and notes. Approving saves this entire
                    week.
                  </p>
                  <button
                    className="primary full"
                    disabled={working || !saved}
                    onClick={() => void act("approve")}
                  >
                    Approve & save week
                  </button>
                </>
              )}
              {run.error && (
                <p className="inline-error" role="alert">
                  {run.error}
                </p>
              )}
              {(run.status === "running" ||
                (run.status === "failed" && run.modelCalls < 12)) && (
                <button
                  className="secondary full"
                  disabled={working || !enabled}
                  onClick={() => void act("run")}
                >
                  {working ? "Coach is working…" : "Resume planning"}
                </button>
              )}
              {[
                "running",
                "needs_input",
                "awaiting_approval",
                "failed",
              ].includes(run.status) && (
                <button
                  className="text-button"
                  disabled={working}
                  onClick={() => void act("reject")}
                >
                  Discard draft
                </button>
              )}
            </>
          )}
          {canStart && (
            <>
              <label>
                Anything different this week?
                <textarea
                  maxLength={1000}
                  placeholder="A movement to focus on, or guidance for your week…"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <button
                className="primary full"
                disabled={!enabled || !saved || working}
                onClick={() => void act("start")}
              >
                <Sparkles size={18} />
                {working
                  ? "Planning…"
                  : run
                    ? "Create a new draft"
                    : "Plan with my AI coach"}
              </button>
            </>
          )}
        </>
      )}
      {!saved && (
        <p className="field-help">
          Wait for your training changes to save before planning or approving.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <p className="field-help">
        Your coach uses your saved preferences and recent logs. Equipment or
        duration changed? Update Preferences first. AI planning shares that
        context with OpenAI.
      </p>
    </section>
  );
}
