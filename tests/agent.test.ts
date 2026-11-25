import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { initialState, createTemplate, makeSession } from "../lib/training.ts";
import { createPlanningAgent } from "../lib/agent/graph.ts";
import { ModelError } from "../lib/agent/model.ts";
import { newRun, type AgentRun, type ToolCall } from "../lib/agent/types.ts";
import {
  checkDraft,
  executeTool,
  exerciseCatalogue,
} from "../lib/agent/tools.ts";
import {
  acquireRun,
  approveRun,
  checkpoint,
  getRun,
  getTraining,
  releaseRun,
} from "../lib/agent/store.ts";

const week = "2026-11-30";
const initial = () =>
  newRun(
    crypto.randomUUID(),
    week,
    "Build a consistent week.",
    initialState("2026-11-23"),
    1,
  );
const call = (name: string, input: unknown = {}): ToolCall => ({
  type: "function_call",
  call_id: crypto.randomUUID(),
  name,
  arguments: JSON.stringify(input),
});
const draft = () => createTemplate(week, initial().snapshot.profile);
const ready = (): AgentRun => {
  const run = initial();
  return {
    ...run,
    status: "awaiting_approval",
    draft: { ...draft(), source: "ai" },
    completedTools: ["read_profile", "read_history", "find_exercises"],
  };
};
const sequence = () => [
  call("read_profile"),
  call("read_history"),
  call("find_exercises"),
  call("check_plan", draft()),
  call("propose_plan"),
];
async function scripted(calls: ToolCall[], run = initial()) {
  const checkpoints: AgentRun[] = [];
  const graph = createPlanningAgent({
    decide: async () => {
      const next = calls.shift();
      assert.ok(next, "Unexpected extra model call");
      return next;
    },
    checkpoint: async (state) => {
      checkpoints.push(structuredClone(state));
    },
  });
  return {
    run: (await graph.invoke({ run }, { recursionLimit: 32 })).run,
    checkpoints,
  };
}

test("agent reads context, checks a plan and stops at approval without changing training", async () => {
  const start = initial();
  const before = structuredClone(start.snapshot);
  const { run, checkpoints } = await scripted(sequence(), start);
  assert.equal(run.status, "awaiting_approval");
  assert.equal(run.modelCalls, 5);
  assert.deepEqual(run.snapshot, before);
  assert.ok(
    checkpoints.some(
      (item) => item.phase === "tool" && item.pending?.name === "check_plan",
    ),
  );
  assert.ok(
    run.trace.some(
      (item) => item.name === "check_plan" && item.outcome === "ok",
    ),
  );
});

test("tool errors and invalid plans are returned to the model for repair", async () => {
  const broken = draft();
  broken.days[0].minutes = 45;
  const { run } = await scripted([
    call("unknown_tool"),
    call("propose_plan"),
    call("check_plan", draft()),
    ...sequence().slice(0, 3),
    call("check_plan", broken),
    call("check_plan", draft()),
    call("propose_plan"),
  ]);
  assert.equal(run.status, "awaiting_approval");
  assert.equal(run.trace.filter((item) => item.outcome === "error").length, 4);
  assert.ok(
    run.messages.some(
      (item) =>
        item.type === "function_call_output" &&
        String(item.output).includes("tool failed"),
    ),
  );
});

test("a transient model failure retries once; repeated failure stops safely", async () => {
  let calls = 0;
  const graph = createPlanningAgent({
    decide: async () => {
      calls++;
      throw new ModelError("Temporary outage", true);
    },
    checkpoint: async () => {},
    wait: async () => {},
  });
  const { run } = await graph.invoke({ run: initial() });
  assert.equal(calls, 2);
  assert.equal(run.status, "failed");
  assert.equal(run.modelCalls, 2);
  assert.equal(run.draft, null);
});

test("the agent recovers after one transient model failure", async () => {
  const calls = sequence();
  let attempt = 0;
  const graph = createPlanningAgent({
    decide: async () => {
      if (++attempt === 1) throw new ModelError("Retry", true);
      return calls.shift()!;
    },
    checkpoint: async () => {},
    wait: async () => {},
  });
  const { run } = await graph.invoke({ run: initial() });
  assert.equal(run.status, "awaiting_approval");
  assert.equal(run.modelCalls, 6);
});

test("human handoff persists and can resume with an answer", async () => {
  const paused = (
    await scripted([
      call("ask_user", { question: "Which equipment is confirmed?" }),
    ])
  ).run;
  assert.equal(paused.status, "needs_input");
  assert.equal(paused.draft, null);
  const resumed = {
    ...paused,
    status: "running" as const,
    messages: [
      ...paused.messages,
      { role: "user", content: "Use my saved equipment." },
    ],
  };
  assert.equal(
    (await scripted(sequence(), resumed)).run.status,
    "awaiting_approval",
  );
});

test("a stored pending tool resumes without repeating its model decision", async () => {
  const run = initial();
  const pending = call("read_profile");
  const result = await scripted(sequence().slice(1), {
    ...run,
    phase: "tool",
    pending,
    modelCalls: 1,
    messages: [...run.messages, pending],
  });
  assert.equal(result.run.status, "awaiting_approval");
  assert.equal(result.run.modelCalls, 5);
});

test("a model that keeps choosing unproductive tools hits the call budget", async () => {
  const graph = createPlanningAgent({
    decide: async () => call("read_profile"),
    checkpoint: async () => {},
  });
  const { run } = await graph.invoke(
    { run: initial() },
    { recursionLimit: 32 },
  );
  assert.equal(run.status, "failed");
  assert.equal(run.modelCalls, 12);
});

test("draft checks reject unavailable equipment, mismatched units and excessive work", () => {
  const run = initial();
  run.snapshot.profile.equipment = "No dumbbells, no treadmill, bench";
  assert.ok(
    !exerciseCatalogue(run.snapshot).some((item) =>
      item.name.includes("treadmill"),
    ),
  );
  assert.ok(
    checkDraft(draft(), run).errors.some((item) =>
      item.includes("Unavailable"),
    ),
  );
  const invalid = draft();
  invalid.days[0].exercises[0].unit = "minutes";
  invalid.days[0].exercises[0].target = 120;
  const result = checkDraft(invalid, initial());
  assert.ok(result.errors.some((item) => item.includes("catalogue unit")));
  assert.ok(result.errors.some((item) => item.includes("time budget")));
});

test("read history does not invent progress for an empty log", async () => {
  const result = await executeTool(initial(), "read_history", {});
  assert.match(JSON.stringify(result.output), /No completed training history/);
});

// Real SQLite exercises the same SQL, changes() and transaction semantics as D1.
function database(run: AgentRun) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../drizzle/0000_stale_corsair.sql", import.meta.url),
      "utf8",
    ),
  );
  sqlite.exec(
    readFileSync(
      new URL("../drizzle/0001_slow_sister_grimm.sql", import.meta.url),
      "utf8",
    ),
  );
  const prepare = (sql: string, values: unknown[] = []) => ({
    bind: (...next: unknown[]) => prepare(sql, next),
    first: async () => sqlite.prepare(sql).get(...(values as never[])) || null,
    run: async () => ({
      meta: {
        changes: Number(
          sqlite.prepare(sql).run(...(values as never[])).changes,
        ),
      },
    }),
  });
  const db = {
    prepare,
    batch: async (statements: ReturnType<typeof prepare>[]) => {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
  sqlite
    .prepare("INSERT INTO training_states VALUES (?, ?, ?, ?)")
    .run("user", JSON.stringify(run.snapshot), 1, run.startedAt);
  sqlite
    .prepare(
      "INSERT INTO agent_runs (id,user_id,week,payload,lease_until,created_at) VALUES (?,?,?,?,0,?)",
    )
    .run(run.id, "user", week, JSON.stringify(run), run.startedAt);
  return { db, sqlite };
}

test("approval saves atomically, is idempotent, and stays scoped to its owner", async () => {
  const run = ready();
  const { db, sqlite } = database(run);
  try {
    assert.equal(await getRun(db, "stranger", run.id), null);
    assert.equal(await acquireRun(db, "stranger", run.id, "bad"), false);
    assert.equal(await acquireRun(db, "user", run.id, "token"), true);
    const approved = await approveRun(db, "user", "token", run);
    assert.equal(approved.status, "approved");
    assert.equal(
      (await getTraining(db, "user"))?.state.plans[week].committed,
      true,
    );
    assert.equal((await getTraining(db, "user"))?.revision, 2);
    await approveRun(db, "user", "token", approved);
    assert.equal((await getTraining(db, "user"))?.revision, 2);
    assert.equal(
      JSON.parse((await getRun(db, "user", run.id))!.payload).status,
      "approved",
    );
  } finally {
    sqlite.close();
  }
});

test("stale approvals and rejected drafts cannot write a training plan", async () => {
  const run = ready();
  const { db, sqlite } = database(run);
  try {
    await acquireRun(db, "user", run.id, "token");
    sqlite.exec("UPDATE training_states SET revision = 2");
    await assert.rejects(approveRun(db, "user", "token", run), /STALE/);
    await assert.rejects(
      approveRun(db, "user", "token", { ...run, status: "rejected" }),
      /NOT_READY/,
    );
    assert.equal((await getTraining(db, "user"))?.state.plans[week], undefined);
  } finally {
    sqlite.close();
  }
});

test("an approval cannot replace a started week", async () => {
  const run = ready();
  run.snapshot.sessions.push(makeSession(draft(), 0, "lb"));
  const { db, sqlite } = database(run);
  try {
    await acquireRun(db, "user", run.id, "token");
    await assert.rejects(approveRun(db, "user", "token", run), /STALE/);
  } finally {
    sqlite.close();
  }
});

test("lease takeover prevents an old executor from checkpointing or approving", async () => {
  const run = ready();
  const { db, sqlite } = database(run);
  try {
    assert.equal(await acquireRun(db, "user", run.id, "old"), true);
    assert.equal(await acquireRun(db, "user", run.id, "new"), false);
    sqlite.exec("UPDATE agent_runs SET lease_until = 0");
    assert.equal(await acquireRun(db, "user", run.id, "new"), true);
    await assert.rejects(checkpoint(db, "user", "old", run), /LEASE_LOST/);
    await assert.rejects(approveRun(db, "user", "old", run), /STALE/);
    await releaseRun(db, "user", run.id, "old");
    assert.equal(await acquireRun(db, "user", run.id, "third"), false);
    assert.equal((await getTraining(db, "user"))?.revision, 1);
  } finally {
    sqlite.close();
  }
});
