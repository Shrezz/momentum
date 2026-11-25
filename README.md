# Momentum

A small, mobile-friendly strength-training prototype. It opens on today's workout and supports weekly plans, set logging, rest timers, progress, affirmations, and an AI coach.

## Run locally

Requires Node 22.18+ and pnpm 11.25.0.

```sh
pnpm install
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_stale_corsair.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_slow_sister_grimm.sql
pnpm dev
```

These commands initialize a fresh local database. For an existing Momentum database that already has `training_states`, run only migration `0001`; do not replay migrations. Open the URL printed by the dev server and select **Sign in to Momentum**. Local development uses the starter's local test identity. Published private Sites use ChatGPT sign-in.

## Live AI

Put `OPENAI_API_KEY` in **this folder's `.env` file** (`workout/momentum/.env`). `.env.example` lists the supported names. Restart the dev server after adding or changing the key. The server defaults to `gpt-4.1-mini`; `OPENAI_MODEL` can override it with a compatible Responses API model.

Keys are server-only and ignored by Git. Do not use `NEXT_PUBLIC_` or `VITE_` prefixes. A local `.env` is not uploaded when publishing: a hosted version needs its own secret configured through Sites.

Without a key, the app clearly labels AI as disconnected. The starter template, workout logger, and progress screens remain usable. There are no simulated AI replies. AI requests send the profile, current and recent plans, recent session logs, and recent conversation to OpenAI, with response storage disabled.

## Code map

- `app/page.tsx` — screen selection and small user-action handlers.
- `components/` — one component per screen or dialog; plain native controls.
- `hooks/use-training.ts` — load and save the user's data; serialize saves and surface failures.
- `lib/training.ts` — types, starter program, calendar and progress functions.
- `lib/validation.ts` — request and generated-workout validation.
- `lib/coach-prompt.ts` / `lib/coach-schema.ts` — coach instructions and structured response shapes.
- `app/api/state/route.ts` — authenticated read/write of training data.
- `app/api/ai/route.ts` — authenticated OpenAI calls and validation; no automatic plan writes.
- `lib/agent/` — LangGraph decisions, six tools, prompts, run types, and D1 checkpoints/approval.
- `app/api/agent/route.ts` — authenticated run, resume, clarification, approval, and rejection.
- `components/AgentPlanner.tsx` — progress, human questions, and draft review.
- `db/schema.ts` / `drizzle/` — training documents and agent runs in two D1 tables.
- `scripts/`, `worker/`, `vite.config.ts`, and connector helper files — Sites platform infrastructure from its supplied starter.

## Keep it simple

Use small functions with descriptive names and explicit types. Keep UI in screen components and pure training rules in `lib/training.ts`. Prefer direct code over generic repositories, service classes, event buses, or speculative abstractions. Add a dependency only when an actual feature needs it. Format with Prettier before review.

The prototype stores one JSON training document per signed-in user. A revision number prevents a stale browser tab from silently overwriting newer changes. On a conflict, export unsaved changes and reload. This intentionally avoids a larger relational schema for an early personal prototype. Local and hosted databases are separate.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm test:d1
pnpm format
pnpm build
```

Tests cover week boundaries, weekly split validation, supported durations, honest progress counts, unit-aware previous performance, and invalid log values. Browser checks cover login, logging and reload, the weekly draft flow, and a 390px phone viewport.

## Prototype boundaries

- A starter plan is a fixed template, not individualized AI programming. It assumes dumbbells, a bench, and a treadmill; it never automatically increases weights.
- AI drafts require review. Full-week replacement is disabled after that week has a started session. The coach can propose changes to untouched individual workouts.
- Partial sessions count as showing up and are labeled partial in history.
- No wearable integrations, nutrition system, notifications, offline mode, or native app packaging yet.
- Live planning was verified with the configured key. Automated checks cover structure and workflow, not training suitability; review generated workouts before following them.
- Agent runs persist server-side until manually removed; there is no automated retention or deletion UI yet. The prototype catalogue is deliberately small.
- Equipment matching is conservative: use comma-separated inventory such as `bench, dumbbells, treadmill`. Ambiguous descriptions may omit equipment.
- A browser disconnect may stop execution; reopen planning and select Resume once the 90-second execution lease expires. There is no background job queue.

## Weekly planning agent

Open **My week → Plan this week** (or **Create a new draft**) for a week with no started sessions. The agent reads saved preferences and history, chooses tools, revises a draft when checks fail, and asks for clarification when needed. **Approve & save week** is the only agent workflow action that writes the plan. Discarding keeps existing training unchanged.

LangGraph controls a single decision/tool loop; direct OpenAI Responses calls supply tool choices. D1 stores application checkpoints before model calls and after each node. This is not a native LangGraph checkpointer or interrupt implementation. Keeping the explicit HTTP approval boundary avoids introducing another backend or persistence library. The existing Coach chat remains a separate supporting feature.

The [project brief](docs/agent-project.md) maps the course requirements to the implementation. See the [demo script](docs/demo-script.md) and [validation record](docs/validation.md) for submission preparation.
