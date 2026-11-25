import type { Plan, TrainingState } from "../training.ts";

export type RunStatus =
  | "running"
  | "needs_input"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "failed";
export type ToolCall = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};
export type TraceEvent = {
  at: string;
  name: string;
  outcome: "ok" | "error" | "waiting";
  detail: string;
};
export type AgentRun = {
  id: string;
  week: string;
  request: string;
  status: RunStatus;
  phase: "decide" | "tool";
  sourceRevision: number;
  snapshot: TrainingState;
  messages: Record<string, unknown>[];
  pending: ToolCall | null;
  completedTools: string[];
  candidate: Plan | null;
  draft: Plan | null;
  question: string;
  error: string;
  modelCalls: number;
  trace: TraceEvent[];
  startedAt: string;
  finishedAt: string | null;
};
export type PublicRun = Pick<
  AgentRun,
  | "id"
  | "week"
  | "status"
  | "draft"
  | "question"
  | "error"
  | "trace"
  | "modelCalls"
  | "startedAt"
  | "finishedAt"
> & { busy: boolean };
export function trace(
  run: AgentRun,
  name: string,
  outcome: TraceEvent["outcome"],
  detail: string,
): AgentRun {
  return {
    ...run,
    trace: [
      ...run.trace,
      { at: new Date().toISOString(), name, outcome, detail },
    ].slice(-80),
  };
}
export function newRun(
  id: string,
  week: string,
  request: string,
  snapshot: TrainingState,
  sourceRevision: number,
): AgentRun {
  return {
    id,
    week,
    request,
    snapshot,
    sourceRevision,
    status: "running",
    phase: "decide",
    messages: [
      {
        role: "user",
        content: `Plan the week starting ${week}. Request: ${request}`,
      },
    ],
    pending: null,
    completedTools: [],
    candidate: null,
    draft: null,
    question: "",
    error: "",
    modelCalls: 0,
    trace: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}
