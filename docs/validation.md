# Validation record

Verified November 25, 2026. Test fixtures are synthetic; live runs used the builder's configured local OpenAI key. No generated test plan was applied to the builder's training data.

| Check                            | Observed result                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript                       | `pnpm typecheck` passed.                                                                                                                                                                                                       |
| Unit/workflow suite              | 19 tests passed: six existing training tests and 13 agent/persistence tests.                                                                                                                                                   |
| Cloudflare D1 integration        | Isolated Miniflare D1 passed atomic plan/receipt save, repeated approval, stale revision and user isolation checks.                                                                                                            |
| HTTP smoke                       | Authenticated reads, unauthenticated denial, origin protection, stale-save protection and invalid input rejection passed.                                                                                                      |
| Live planning                    | An untouched future-week draft reached approval in 34 seconds / six model calls. The agent repaired an over-budget conditioning session after validator feedback.                                                              |
| Live draft persistence/rejection | GET recovered the pending draft; rejection left both training state and its revision unchanged.                                                                                                                                |
| Live human handoff               | The browser requested an emphasis preference; closing/reopening recovered the question. Answering resumed planning and produced a checked draft at seven total model calls, including another repaired duration error.         |
| Browser review                   | Draft details, activity log, approval and discard controls worked. At a 390px viewport the body had no horizontal overflow and the 352px dialog fit within the viewport. Approval and discard remained reachable by scrolling. |
| Secret handling                  | Existing local key reused server-side; `.env` remains ignored. No key is included in source or submission artifacts. Hosted AI needs its own server secret.                                                                    |

The workflow tests explicitly cover unknown/failed tools, missing required context, invalid drafts, a successful transient retry, repeated model failure, human handoff/resume, pending-tool recovery, the 12-call cap, equipment and unit rejection, empty-history honesty, approval replay, stale/rejected/started-week rejection, and lease takeover.

These results establish prototype control-flow behavior, not clinical safety or an 80% end-to-end usefulness rate. No ten-session human usability study has been completed. The first live timing measures draft readiness; human review time is not included. The browser test discarded its draft after inspection. Successful approval was verified against isolated test databases, not the builder's real program.

## Repeatable commands

```sh
pnpm typecheck
pnpm test
pnpm test:d1
# With a signed-in local app running on port 5173:
node tests/api-smoke.mjs
```

For live behavior, follow `docs/demo-script.md`. Model output varies; the same duration error is not guaranteed to recur. The deterministic test suite supplies repeatable failure scenarios without spending API credits.
