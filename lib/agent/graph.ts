import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ModelError } from "./model.ts";
import { executeTool } from "./tools.ts";
import { trace, type AgentRun, type ToolCall } from "./types.ts";

export type AgentDependencies = {
  decide: (run: AgentRun) => Promise<ToolCall>;
  checkpoint: (run: AgentRun) => Promise<void>;
  execute?: typeof executeTool;
  wait?: (milliseconds: number) => Promise<void>;
};
const GraphState = Annotation.Root({ run: Annotation<AgentRun>() });

export function createPlanningAgent(deps: AgentDependencies) {
  const persist = async (run: AgentRun) => {
    await deps.checkpoint(run);
    return { run };
  };
  async function decide({ run }: typeof GraphState.State) {
    if (run.modelCalls >= 12)
      return persist({
        ...trace(
          run,
          "budget",
          "error",
          "Stopped at the model-call limit. Review the activity log and start a smaller request.",
        ),
        status: "failed",
        error: "The agent reached its 12-call limit.",
        finishedAt: new Date().toISOString(),
      });
    for (let attempt = 0; attempt < 2; attempt++) {
      run = { ...run, modelCalls: run.modelCalls + 1 };
      await deps.checkpoint(run);
      try {
        const call = await deps.decide(run);
        return persist({
          ...run,
          pending: call,
          messages: [...run.messages, call],
          phase: "tool",
        });
      } catch (error) {
        const canRetry =
          error instanceof ModelError &&
          error.retryable &&
          attempt === 0 &&
          run.modelCalls < 12;
        run = trace(
          run,
          "model",
          "error",
          canRetry
            ? "Temporary model failure; retrying once."
            : "Model request stopped. Your workout plan is unchanged.",
        );
        if (!canRetry)
          return persist({
            ...run,
            status: "failed",
            error:
              error instanceof ModelError
                ? error.message
                : "Unexpected model failure.",
            finishedAt: new Date().toISOString(),
          });
        await deps.checkpoint(run);
        await (
          deps.wait ||
          ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
        )(1000);
      }
    }
    return { run };
  }
  async function tools({ run }: typeof GraphState.State) {
    const call = run.pending;
    if (!call)
      return persist({
        ...run,
        status: "failed",
        error: "The pending tool call is missing.",
      });
    let output: unknown;
    try {
      const result = await (deps.execute || executeTool)(
        run,
        call.name,
        JSON.parse(call.arguments),
      );
      const rejected =
        typeof result.output === "object" &&
        result.output !== null &&
        ("error" in result.output ||
          ("valid" in result.output && result.output.valid === false));
      run = trace(
        result.run,
        call.name,
        rejected ? "error" : result.run.status === "running" ? "ok" : "waiting",
        result.detail,
      );
      run.completedTools = [...new Set([...run.completedTools, call.name])];
      output = result.output;
    } catch {
      output = {
        error:
          "This tool failed. You may retry it or ask the user for help; do not invent its result.",
      };
      run = trace(
        run,
        call.name,
        "error",
        "Tool failed. Returning the error to the agent so it can choose its next step.",
      );
    }
    return persist({
      ...run,
      phase: "decide",
      pending: null,
      messages: [
        ...run.messages,
        {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        },
      ],
    });
  }
  return new StateGraph(GraphState)
    .addNode("decide", decide)
    .addNode("tools", tools)
    .addConditionalEdges(START, (state) =>
      state.run.phase === "tool" ? "tools" : "decide",
    )
    .addConditionalEdges("decide", (state) =>
      state.run.status === "running" ? "tools" : END,
    )
    .addConditionalEdges("tools", (state) =>
      state.run.status === "running" ? "decide" : END,
    )
    .compile();
}
