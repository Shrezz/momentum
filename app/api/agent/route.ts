import { z } from "zod";
import { apiError, bindings, boundedBody, identify, json } from "@/lib/server";
import { weekOf } from "@/lib/training";
import { createPlanningAgent } from "@/lib/agent/graph";
import { callModel } from "@/lib/agent/model";
import { newRun, trace, type AgentRun } from "@/lib/agent/types";
import {
  acquireRun,
  approveRun,
  checkpoint,
  getRun,
  getTraining,
  publicRun,
  releaseRun,
  type RunRow,
} from "@/lib/agent/store";

const inputSchema = z.object({
  action: z.enum(["start", "run", "answer", "approve", "reject"]),
  id: z.string().uuid(),
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  message: z.string().trim().max(1000).default(""),
});
export async function GET(request: Request) {
  try {
    const user = await identify();
    const week = new URL(request.url).searchParams.get("week");
    const db = bindings().DB;
    if (!db) return json({ error: "Workout storage is not connected." }, 503);
    const row = await db
      .prepare(
        "SELECT payload, lease_until FROM agent_runs WHERE user_id = ? AND week = ? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(user.userId, week || "")
      .first<RunRow>();
    return json({ run: row ? publicRun(row) : null });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await identify(request);
    const parsed = inputSchema.safeParse(await boundedBody(request, 5000));
    if (!parsed.success) return json({ error: "Invalid agent request." }, 400);
    const { action, id, week, message } = parsed.data;
    const env = bindings();
    const db = env.DB;
    if (!db) return json({ error: "Workout storage is not connected." }, 503);
    if (["start", "run", "answer"].includes(action) && !env.OPENAI_API_KEY)
      return json(
        {
          error:
            "Connect an OpenAI API key on the server to use the planning agent.",
        },
        503,
      );
    if (action === "start") {
      if (
        !week ||
        !Number.isFinite(Date.parse(week)) ||
        weekOf(new Date(`${week}T12:00:00`)) !== week
      )
        return json({ error: "Choose a valid week starting Monday." }, 400);
      const existing = await getRun(db, user.userId, id);
      if (existing) return json({ run: publicRun(existing) });
      const current = await getTraining(db, user.userId);
      if (!current)
        return json({ error: "Save your preferences before planning." }, 409);
      if (current.state.sessions.some((session) => session.week === week))
        return json(
          { error: "This week has started. Choose an untouched week." },
          409,
        );
      const run = newRun(
        id,
        week,
        message ||
          "Build a consistent week from my preferences and recent training.",
        current.state,
        current.revision,
      );
      await db
        .prepare(
          "INSERT OR IGNORE INTO agent_runs (id, user_id, week, payload, lease_until, created_at) VALUES (?, ?, ?, ?, 0, ?)",
        )
        .bind(id, user.userId, week, JSON.stringify(run), run.startedAt)
        .run();
      const saved = await getRun(db, user.userId, id);
      if (!saved)
        return json(
          { error: "Unable to start this run. Please try again." },
          409,
        );
      return json({ run: publicRun(saved) });
    }
    const token = crypto.randomUUID();
    if (!(await acquireRun(db, user.userId, id, token)))
      return json(
        {
          error:
            "This run is active elsewhere, or no longer exists. Refresh its progress.",
        },
        409,
      );
    try {
      const row = await getRun(db, user.userId, id);
      if (!row) return json({ error: "Run not found." }, 404);
      let run = JSON.parse(row.payload) as AgentRun;
      if (action === "approve") {
        try {
          run = await approveRun(db, user.userId, token, run);
        } catch (error) {
          if (error instanceof Error && error.message === "STALE")
            return json(
              {
                error:
                  "Your training changed after this draft started. Reload and create a new draft so no changes are lost.",
              },
              409,
            );
          if (error instanceof Error && error.message === "NOT_READY")
            return json(
              { error: "Only a checked draft awaiting approval can be saved." },
              409,
            );
          throw error;
        }
      } else if (action === "reject") {
        if (run.status === "approved")
          return json({ error: "This plan has already been approved." }, 409);
        run = {
          ...trace(
            run,
            "approval",
            "waiting",
            "You discarded this run. Your weekly plan is unchanged.",
          ),
          status: "rejected",
          finishedAt: new Date().toISOString(),
        };
        await checkpoint(db, user.userId, token, run);
      } else {
        if (action === "answer") {
          if (run.status !== "needs_input" || !message)
            return json(
              { error: "This run needs a response to its question." },
              409,
            );
          run = {
            ...trace(
              run,
              "answer",
              "ok",
              "Your clarification was added to this run.",
            ),
            status: "running",
            question: "",
            candidate: null,
            messages: [...run.messages, { role: "user", content: message }],
          };
        } else if (run.status === "failed" && run.modelCalls < 12) {
          run = { ...run, status: "running", error: "", finishedAt: null };
        }
        if (run.status === "running") {
          const graph = createPlanningAgent({
            decide: (state) =>
              callModel(state, env.OPENAI_API_KEY!, env.OPENAI_MODEL),
            checkpoint: (state) => checkpoint(db, user.userId, token, state),
          });
          run = (await graph.invoke({ run }, { recursionLimit: 32 })).run;
        }
      }
      return json({
        run: publicRun({ payload: JSON.stringify(run), lease_until: 0 }),
      });
    } finally {
      await releaseRun(db, user.userId, id, token);
    }
  } catch (error) {
    if (error instanceof SyntaxError)
      return json({ error: "Invalid JSON request." }, 400);
    return apiError(error);
  }
}
