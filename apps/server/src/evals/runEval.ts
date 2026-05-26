import { randomUUID } from "node:crypto";
import { ChatOpenAI } from "@langchain/openai";
import { env } from "@skyclad_langgraph/env/server";
import { evaluate } from "langsmith/evaluation";
import type { EvaluationResult } from "langsmith/evaluation";
import type { Example, Run } from "langsmith/schemas";
import { z } from "zod";
import { agent, globalTopKAgent, namespaceTopKAgent, TIMEOUT_MS } from "../agent.js";
import { EVAL_PROMPT } from "./judge-prompt.js";

const DATASET_NAME = "eval";

const judge = new ChatOpenAI({
  model: "gpt-5.4-mini",
  timeout: TIMEOUT_MS,
  maxRetries: 0,
  ...(env.OPENAI_PROXY_BASE_URL
    ? { configuration: { baseURL: env.OPENAI_PROXY_BASE_URL } }
    : {}),
  apiKey: env.OPENAI_API_KEY ?? "not-needed",
});

const JUDGE_SCHEMA = z.object({
  score_0_to_10: z.number().int().min(1).max(10),
  reasoning: z.string(),
});

const structuredJudge = judge.withStructuredOutput(JUDGE_SCHEMA, {
  name: "judge_score",
  strict: true,
});

type EvalInput = {
  input: string;
};

type EvalOutput = {
  answer: string;
};

type EvalAgent = {
  invoke: typeof agent.invoke;
};

function createJudgeEvaluator() {
  return async (run: Run, example?: Example): Promise<EvaluationResult[]> => {
    const prompt = EVAL_PROMPT.hallucination
      .replaceAll("{{inputs}}", JSON.stringify(run.inputs ?? {}))
      .replaceAll("{{outputs}}", JSON.stringify(run.outputs ?? {}))
      .replaceAll(
        "{{reference_outputs}}",
        JSON.stringify(example?.outputs ?? {}),
      );

    const parsed = await structuredJudge.invoke(prompt);

    return [
      {
        key: "assignment_score",
        score: parsed.score_0_to_10,
        comment: parsed.reasoning,
      },
    ];
  };
}

function createAgentRunner(evalAgent: EvalAgent) {
  return async (exampleInput: EvalInput): Promise<EvalOutput> => {
    const result = await evalAgent.invoke(
      { messages: [{ role: "user", content: exampleInput.input }] },
      { configurable: { thread_id: randomUUID() } },
    );

    return {
      answer: String(result.messages[result.messages.length - 1]?.content ?? ""),
    };
  };
}

const experiments = [
  {
    name: "namespace-top-k-lexical-rrf",
    runner: createAgentRunner(agent),
  },
  {
    name: "namespace-top-k",
    runner: createAgentRunner(namespaceTopKAgent),
  },
  {
    name: "global-top-k",
    runner: createAgentRunner(globalTopKAgent),
  },
] as const;

for (const experiment of experiments) {
  await evaluate(experiment.runner, {
    data: DATASET_NAME,
    evaluators: [createJudgeEvaluator()],
    experimentPrefix: experiment.name,
  });

  console.log(`Completed ${experiment.name}`);
}
