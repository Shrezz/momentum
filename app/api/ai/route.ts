import { chatOutput } from "@/lib/coach-schema";
import { coachInstructions } from "@/lib/coach-prompt";
import { apiError, bindings, boundedBody, identify, json } from "@/lib/server";
import { stateSchema, workoutSchema } from "@/lib/validation";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    await identify(request);
    const env = bindings();
    if (!env.OPENAI_API_KEY)
      return json(
        {
          error:
            "Live AI is not connected yet. You can use the starter program and log workouts while it is being set up.",
        },
        503,
      );
    const body = await boundedBody(request, 600_000);
    const parsed = stateSchema.safeParse(body.state);
    if (
      !parsed.success ||
      body.action !== "chat" ||
      typeof body.week !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.week) ||
      typeof body.message !== "string" ||
      body.message.length > 2000
    )
      return json({ error: "Please check the request and try again." }, 400);
    const s = parsed.data;
    const context = {
      profile: s.profile,
      energy: s.energy,
      week: body.week,
      currentPlan: s.plans[body.week] || null,
      previousPlans: Object.values(s.plans)
        .sort((a, b) => b.week.localeCompare(a.week))
        .slice(0, 3),
      sessions: s.sessions.slice(-20),
      conversation: s.messages
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text })),
    };
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        store: false,
        instructions: coachInstructions,
        input: JSON.stringify({
          action: body.action,
          request: body.message,
          context,
        }),
        max_output_tokens: 2500,
        text: {
          format: {
            type: "json_schema",
            name: "coach_reply",
            strict: true,
            schema: chatOutput,
          },
        },
      }),
    });
    if (!upstream.ok) {
      const status = upstream.status;
      return json(
        {
          error:
            status === 429
              ? "The AI service is at its usage or rate limit. Try again later or check API billing."
              : status === 401
                ? "The API key was rejected. Update the server key and try again."
                : "The AI service could not complete this request. Please try again.",
        },
        502,
      );
    }
    const response = (await upstream.json()) as {
      status?: string;
      output?: { content?: { type: string; text?: string }[] }[];
    };
    if (response.status !== "completed")
      return json(
        {
          error:
            "The AI response was incomplete. Your plan has not changed; try again.",
        },
        502,
      );
    const raw = response.output
      ?.flatMap((x) => x.content || [])
      .filter((x) => x.type === "output_text")
      .map((x) => x.text || "")
      .join("");
    if (!raw)
      return json(
        {
          error:
            "The coach could not provide that response. Try a more specific request.",
        },
        502,
      );
    let data;
    try {
      data = JSON.parse(raw);
      const result = z
        .object({
          message: z.string().min(1).max(6000),
          proposal: z
            .object({
              day: z.number().int().min(0).max(6),
              workout: workoutSchema,
              reason: z.string().max(1000),
            })
            .nullable(),
        })
        .parse(data);
      if (result.proposal) {
        const p = result.proposal;
        const original = s.plans[body.week]?.days[p.day];
        if (
          !original ||
          s.sessions.some((x) => x.week === body.week && x.day === p.day) ||
          p.workout.kind !== original.kind ||
          p.workout.kind === "rest" ||
          p.workout.minutes < 35 ||
          p.workout.minutes > s.profile.minutes ||
          !p.workout.exercises.length
        )
          throw new Error("Invalid proposal");
      }
      return json(result);
    } catch {
      return json(
        {
          error:
            "The coach’s draft did not match your program rules. Nothing was changed; please try again.",
        },
        502,
      );
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.name === "TimeoutError" || e.name === "AbortError")
    )
      return json(
        { error: "The coach took too long to respond. Please try again." },
        504,
      );
    return apiError(e);
  }
}
