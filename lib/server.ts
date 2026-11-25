import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function identify(request?: Request) {
  const user = await getChatGPTUser();
  if (!user) throw new Error("AUTH");
  if (request) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      throw new Error("ORIGIN");
  }
  return user;
}
export function bindings() {
  return env as typeof env & { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
}
export async function boundedBody(request: Request, max = 800_000) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new Error("SIZE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("BODY");
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error("SIZE");
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}
export function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "AUTH")
    return json({ error: "Please sign in to save your workouts." }, 401);
  if (code === "ORIGIN")
    return json({ error: "This request must come from Momentum." }, 403);
  if (code === "SIZE")
    return json({ error: "This request is too large." }, 413);
  return json(
    { error: "Something went wrong. Your current plan has not been changed." },
    500,
  );
}
