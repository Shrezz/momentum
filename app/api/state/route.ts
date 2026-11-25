import { apiError, bindings, boundedBody, identify, json } from "@/lib/server";
import { stateSchema } from "@/lib/validation";
export async function GET() {
  try {
    const user = await identify();
    const env = bindings();
    if (!env.DB)
      return json({ error: "Workout storage is not connected." }, 503);
    const row = await env.DB.prepare(
      "SELECT payload, revision FROM training_states WHERE user_id = ?",
    )
      .bind(user.userId)
      .first<{ payload: string; revision: number }>();
    return json({
      state: row ? JSON.parse(row.payload) : null,
      revision: row?.revision || 0,
      user: user.userId,
      aiConfigured: !!env.OPENAI_API_KEY,
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(request: Request) {
  try {
    const user = await identify(request);
    const body = await boundedBody(request);
    const parsed = stateSchema.safeParse(body.state);
    if (
      !parsed.success ||
      !Number.isInteger(body.revision) ||
      body.revision < 0
    )
      return json({ error: "The workout data could not be validated." }, 400);
    const db = bindings().DB;
    if (!db) return json({ error: "Workout storage is not connected." }, 503);
    const payload = JSON.stringify(parsed.data);
    const at = new Date().toISOString();
    const result =
      body.revision === 0
        ? await db
            .prepare(
              "INSERT OR IGNORE INTO training_states (user_id, payload, revision, updated_at) VALUES (?, ?, 1, ?)",
            )
            .bind(user.userId, payload, at)
            .run()
        : await db
            .prepare(
              "UPDATE training_states SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?",
            )
            .bind(payload, at, user.userId, body.revision)
            .run();
    if (!result.meta.changes)
      return json(
        {
          error:
            "Your data changed in another tab or device. Export your unsaved changes, then reload to get the latest version.",
        },
        409,
      );
    return json({ revision: body.revision + 1 });
  } catch (e) {
    return apiError(e);
  }
}
