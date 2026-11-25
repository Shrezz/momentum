import { stateSchema } from "../validation.ts";
import { checkDraft } from "./tools.ts";
import { trace, type AgentRun, type PublicRun } from "./types.ts";

export type RunRow = { payload: string; lease_until: number };
export function publicRun(row: RunRow): PublicRun {
  const {
    id,
    week,
    status,
    draft,
    question,
    error,
    trace,
    modelCalls,
    startedAt,
    finishedAt,
  } = JSON.parse(row.payload) as AgentRun;
  return {
    id,
    week,
    status,
    draft,
    question,
    error,
    trace,
    modelCalls,
    startedAt,
    finishedAt,
    busy: row.lease_until > Date.now(),
  };
}
export async function getRun(db: D1Database, user: string, id: string) {
  return db
    .prepare(
      "SELECT payload, lease_until FROM agent_runs WHERE id = ? AND user_id = ?",
    )
    .bind(id, user)
    .first<RunRow>();
}
export async function getTraining(db: D1Database, user: string) {
  const row = await db
    .prepare("SELECT payload, revision FROM training_states WHERE user_id = ?")
    .bind(user)
    .first<{ payload: string; revision: number }>();
  return row
    ? {
        state: stateSchema.parse(JSON.parse(row.payload)),
        revision: row.revision,
      }
    : null;
}
export async function acquireRun(
  db: D1Database,
  user: string,
  id: string,
  token: string,
) {
  const result = await db
    .prepare(
      "UPDATE agent_runs SET lease_token = ?, lease_until = ? WHERE id = ? AND user_id = ? AND lease_until <= ?",
    )
    .bind(token, Date.now() + 90_000, id, user, Date.now())
    .run();
  return result.meta.changes > 0;
}
export async function checkpoint(
  db: D1Database,
  user: string,
  token: string,
  run: AgentRun,
) {
  const result = await db
    .prepare(
      "UPDATE agent_runs SET payload = ?, lease_until = ? WHERE id = ? AND user_id = ? AND lease_token = ?",
    )
    .bind(JSON.stringify(run), Date.now() + 90_000, run.id, user, token)
    .run();
  if (!result.meta.changes) throw new Error("LEASE_LOST");
}
export async function releaseRun(
  db: D1Database,
  user: string,
  id: string,
  token: string,
) {
  await db
    .prepare(
      "UPDATE agent_runs SET lease_token = NULL, lease_until = 0 WHERE id = ? AND user_id = ? AND lease_token = ?",
    )
    .bind(id, user, token)
    .run();
}

// The training write and approval receipt commit together. A stale snapshot never wins.
export async function approveRun(
  db: D1Database,
  user: string,
  token: string,
  run: AgentRun,
) {
  if (run.status === "approved") return run;
  if (run.status !== "awaiting_approval" || !run.draft)
    throw new Error("NOT_READY");
  const current = await getTraining(db, user);
  if (
    !current ||
    current.revision !== run.sourceRevision ||
    current.state.sessions.some((session) => session.week === run.week)
  )
    throw new Error("STALE");
  const checked = checkDraft(run.draft, run);
  if (!checked.plan) throw new Error("NOT_READY");
  const state = stateSchema.parse({
    ...current.state,
    plans: {
      ...current.state.plans,
      [run.week]: { ...checked.plan, committed: true },
    },
  });
  const approved = {
    ...trace(
      run,
      "approval",
      "ok",
      "You approved this draft. Saved your weekly plan.",
    ),
    status: "approved" as const,
    finishedAt: new Date().toISOString(),
  };
  const results = await db.batch([
    db
      .prepare(
        "UPDATE training_states SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM agent_runs WHERE id = ? AND user_id = ? AND lease_token = ?)",
      )
      .bind(
        JSON.stringify(state),
        approved.finishedAt,
        user,
        run.sourceRevision,
        run.id,
        user,
        token,
      ),
    db
      .prepare(
        "UPDATE agent_runs SET payload = ? WHERE id = ? AND user_id = ? AND lease_token = ? AND changes() = 1",
      )
      .bind(JSON.stringify(approved), run.id, user, token),
  ]);
  if (!results[0].meta.changes) throw new Error("STALE");
  return approved;
}
