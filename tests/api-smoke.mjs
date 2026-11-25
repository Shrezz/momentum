// Run against the local preview only. These checks never change saved workouts.
import assert from "node:assert/strict";
const base = "http://127.0.0.1:5173";
const headers = {
  Cookie: "__sites_local_auth=1",
  Origin: base,
  "Content-Type": "application/json",
};
assert.equal((await fetch(base + "/api/state")).status, 401);
const response = await fetch(base + "/api/state", { headers });
assert.equal(response.status, 200);
const current = await response.json();
assert.ok(
  current.state && current.revision > 0,
  "Open and sign into the app once before this check.",
);
const put = (body, extra = {}) =>
  fetch(base + "/api/state", {
    method: "PUT",
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
  });
assert.equal(
  (
    await put(
      { state: current.state, revision: current.revision },
      { Origin: "https://example.invalid" },
    )
  ).status,
  403,
);
assert.equal(
  (await put({ state: current.state, revision: current.revision - 1 })).status,
  409,
);
assert.equal(
  (await put({ state: { version: 1 }, revision: current.revision })).status,
  400,
);
assert.equal((await fetch(base + "/api/agent?week=2026-11-30")).status, 401);
const agentPost = (body, extra = {}) =>
  fetch(base + "/api/agent", {
    method: "POST",
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
  });
assert.equal(
  (
    await agentPost(
      { action: "run", id: crypto.randomUUID() },
      { Origin: "https://example.invalid" },
    )
  ).status,
  403,
);
assert.equal(
  (await agentPost({ action: "approve", id: "invalid" })).status,
  400,
);
assert.equal(
  (await agentPost({ action: "approve", id: crypto.randomUUID() })).status,
  409,
);
if (!current.aiConfigured) {
  const unavailable = await fetch(base + "/api/ai", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "chat",
      state: current.state,
      week: Object.keys(current.state.plans)[0],
      message: "Hello",
    }),
  });
  assert.equal(unavailable.status, 503);
}
console.log(
  "Passed: authentication, persistence read, origin checks, stale-write protection, input validation, agent access/input protection, and disconnected-AI behavior when applicable.",
);
