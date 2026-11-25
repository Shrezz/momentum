# Momentum demo — under five minutes

Use the local app with its server-side key, a saved profile, and an untouched future week. Keep credentials and `.env` off-screen. Start the app before recording. Record with the actual UI; do not claim test fixtures are live model behavior.

| Time      | Show and explain                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Today screen. “Momentum helps me show up consistently: three lifting days, two conditioning days, cardio and core, and rest.”                                                                                          |
| 0:30–0:55 | Preferences and existing logs. Explain equipment, 35–45 minute sessions, and that empty logs do not justify invented progress.                                                                                         |
| 0:55–1:40 | My week → next untouched week → Plan this week. Ask: “Before drafting, ask whether I want full-body or upper/lower emphasis.” Show the clarification, answer, and expand Coach activity as it works.                   |
| 1:40–2:20 | Show the tool activity and checked draft. Expand Monday and inspect sets, targets, rest and notes. Explain that validation failures go back to the model; do not promise one will occur on this particular run.        |
| 2:20–2:50 | Close/reopen the dialog to demonstrate saved state. Show that the weekly calendar has not changed yet. Approve only a plan you actually want, then show the saved week. Alternatively discard if it is only test data. |
| 2:50–3:40 | Run `pnpm test` and `pnpm test:d1`. Highlight failure recovery, 12-call stop, clarification/resume, rejected/stale approvals and idempotence. Clearly label these controlled tests.                                    |
| 3:40–4:20 | Open `lib/agent/graph.ts`, `tools.ts` and `store.ts`. Explain one agent, two graph nodes, six tools and D1 application checkpoints. Approval is an explicit server boundary.                                           |
| 4:20–4:50 | Describe how Codex helped implement and test from your goals and KISS instructions. State limitations: small catalogue, human suitability review, no background job queue, and no measured 8/10 usability rate yet.    |

If the model is slow, keep the live workflow visible while explaining the architecture. The 34-second observed run is one observation, not a timing guarantee. Do not speed up the recording without labeling it.

For submission, attach the actual recorded video and hosted code link to the course form yourself. This file is a script, not a completed recording.
