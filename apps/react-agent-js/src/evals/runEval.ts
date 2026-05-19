import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import type { ExampleCreate } from "langsmith/schemas";
import { createLLMAsJudge } from "openevals";
import { agent } from "../agent.js";

const DATASET_NAME = "skyclad-agent-evals-v1";
const DATASET_PATH = fileURLToPath(
  new URL("./skyclad-agent-evals-v1.json", import.meta.url)
);

type ExpectedBehavior = "answer" | "clarify" | "refuse";

type EvalCase = {
  id: string;
  input_question: string;
  expected_behavior: ExpectedBehavior;
  reference_answer: string;
  grading_notes: string;
};

type EvalInputs = {
  input_question: string;
};

const JUDGE_PROMPT = `You are grading an agent answer for a research-paper RAG assignment.

Return true only when the response satisfies the expected behavior.

Expected behavior rules:
- answer: The response must match the reference answer and grading notes.
- clarify: The response must ask for the needed clarification and must not answer a random paper.
- refuse: The response must refuse or say the indexed corpus is not appropriate.

Question and expected behavior:
{inputs}

Agent response:
{outputs}

Reference answer and grading notes:
{referenceOutputs}`;

const assignmentJudge = createLLMAsJudge({
  prompt: JUDGE_PROMPT,
  feedbackKey: "assignment_score",
  model: "google-genai:gemini-flash-lite-latest",
});

const data = await readFile(DATASET_PATH, "utf8");
const evalCases = JSON.parse(data) as EvalCase[];

const client = new Client();
const datasetExists = await client.hasDataset({ datasetName: DATASET_NAME });

if (!datasetExists) {
  const createdDataset = await client.createDataset(DATASET_NAME, {
    description: "Hand-authored Skyclad agent evals for behavior scoring.",
  });

  const examples: ExampleCreate[] = evalCases.map((evalCase) => ({
    dataset_id: createdDataset.id,
    inputs: {
      input_question: evalCase.input_question,
    },
    outputs: {
      expected_behavior: evalCase.expected_behavior,
      reference_answer: evalCase.reference_answer,
      grading_notes: evalCase.grading_notes,
    },
    metadata: { id: evalCase.id },
  }));

  await client.createExamples(examples);
}

async function runAgent(inputs: EvalInputs): Promise<{ answer: string }> {
  const result = await agent.invoke({
    messages: [{ role: "user", content: inputs.input_question }],
  });

  const answer = result.messages.at(-1)?.text ?? "";

  return { answer };
}

await evaluate(runAgent, {
  data: DATASET_NAME,
  evaluators: [assignmentJudge],
  experimentPrefix: "skyclad-agent",
  maxConcurrency: 1,
  client,
});
