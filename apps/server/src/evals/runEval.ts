import { randomUUID } from "node:crypto";
import { ChatOpenAI } from "@langchain/openai";
import { env } from "@skyclad_langgraph/env/server";
import { evaluate } from "langsmith/evaluation";
import type { EvaluationResult } from "langsmith/evaluation";
import type { Example, Run } from "langsmith/schemas";
import { z } from "zod";
import { agent, globalTopKAgent, namespaceTopKAgent } from "../agent.js";
import { EVAL_PROMPT } from "./judge-prompt.js";

const judge = new ChatOpenAI({
  model: "gpt-5.5",
  ...(env.OPENAI_PROXY_BASE_URL
    ? {
        configuration: { baseURL: env.OPENAI_PROXY_BASE_URL },
        apiKey: env.OPENAI_API_KEY ?? "not-needed",
      }
    : {}),
});

const JUDGE_SCHEMA = z.object({
  score_0_to_10: z.number().int().min(1).max(10),
  reasoning: z.string(),
});

const structuredJudge = judge.withStructuredOutput(JUDGE_SCHEMA, {
  name: "judge_score",
  strict: true,
});

function createJudgeEvaluator(promptTemplate: string) {
  return async (run: Run, example?: Example): Promise<EvaluationResult[]> => {
    const prompt = promptTemplate
      .replaceAll("{{inputs}}", JSON.stringify(run.inputs ?? {}))
      .replaceAll("{{outputs}}", JSON.stringify(run.outputs ?? {}))
      .replaceAll(
        "{{reference_outputs}}",
        JSON.stringify(example?.outputs ?? {}),
      );

    const parsed = await structuredJudge.invoke(prompt);

    return [
      {
        key: "score",
        score: parsed.score_0_to_10,
        comment: parsed.reasoning,
      },
    ];
  };
}

type EvalInput = {
  input: string;
};

type EvalOutput = {
  answer: string;
};

const runGraph = async (
  graph: typeof agent,
  exampleInput: EvalInput,
): Promise<EvalOutput> => {
  const result = await graph.invoke(
    { messages: [{ role: "user", content: exampleInput.input }] },
    { configurable: { thread_id: randomUUID() } },
  );

  return {
    answer: String(result.messages.at(-1)?.content ?? ""),
  };
};

const runAgent = async (exampleInput: EvalInput): Promise<EvalOutput> => {
  return runGraph(agent, exampleInput);
};

const runNamespaceTopKAgent = async (
  exampleInput: EvalInput,
): Promise<EvalOutput> => {
  return runGraph(namespaceTopKAgent, exampleInput);
};

const runGlobalTopKAgent = async (
  exampleInput: EvalInput,
): Promise<EvalOutput> => {
  return runGraph(globalTopKAgent, exampleInput);
};

const evaluator = createJudgeEvaluator(EVAL_PROMPT.hallucination);

await Promise.all([
  evaluate(runAgent, {
    data: "eval",
    evaluators: [evaluator],
    experimentPrefix: "agent_eval",
  }),
  evaluate(runNamespaceTopKAgent, {
    data: "eval",
    evaluators: [evaluator],
    experimentPrefix: "namespace_top_k_eval",
  }),
  evaluate(runGlobalTopKAgent, {
    data: "eval",
    evaluators: [evaluator],
    experimentPrefix: "global_top_k_eval",
  }),
]);

console.log("Completed: eval (agent + namespace_top_k + global_top_k)");
