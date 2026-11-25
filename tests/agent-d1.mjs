// Isolated in-memory Cloudflare D1 integration; never touches user training data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { initialState, createTemplate } from "../lib/training.ts";
import { newRun } from "../lib/agent/types.ts";
import {
  acquireRun,
  approveRun,
  getRun,
  getTraining,
} from "../lib/agent/store.ts";
const require = createRequire(
  realpathSync(resolve("node_modules/wrangler/package.json")),
);
const { Miniflare } = require("miniflare");
const worker = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("test");}}',
  compatibilityDate: "2026-05-15",
  d1Databases: ["DB"],
  d1Persist: false,
});
try {
  const db = await worker.getD1Database("DB");
  for (const file of ["0000_stale_corsair.sql", "0001_slow_sister_grimm.sql"])
    await db.exec(
      (
        await readFile(new URL("../drizzle/" + file, import.meta.url), "utf8")
      ).replaceAll("\n", " "),
    );
  const state = initialState("2026-11-23");
  const run = {
    ...newRun(crypto.randomUUID(), "2026-11-30", "Test", state, 1),
    status: "awaiting_approval",
    draft: { ...createTemplate("2026-11-30", state.profile), source: "ai" },
  };
  await db
    .prepare("INSERT INTO training_states VALUES (?, ?, 1, ?)")
    .bind("test", JSON.stringify(state), run.startedAt)
    .run();
  await db
    .prepare(
      "INSERT INTO agent_runs (id,user_id,week,payload,lease_until,created_at) VALUES (?,?,?,?,0,?)",
    )
    .bind(run.id, "test", run.week, JSON.stringify(run), run.startedAt)
    .run();
  await acquireRun(db, "test", run.id, "token");
  const approved = await approveRun(db, "test", "token", run);
  assert.equal((await getTraining(db, "test")).revision, 2);
  assert.equal(
    JSON.parse((await getRun(db, "test", run.id)).payload).status,
    "approved",
  );
  assert.equal(
    (await getTraining(db, "test")).state.plans[run.week].committed,
    true,
  );
  await approveRun(db, "test", "token", approved);
  assert.equal((await getTraining(db, "test")).revision, 2);
  await assert.rejects(approveRun(db, "test", "token", run), /STALE/);
  assert.equal(await getRun(db, "another-user", run.id), null);
  console.log(
    "Passed isolated Cloudflare D1 approval, atomic receipt, replay, stale revision and user isolation checks.",
  );
} finally {
  await worker.dispose();
}
