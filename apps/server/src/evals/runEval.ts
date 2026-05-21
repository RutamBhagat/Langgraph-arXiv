import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "langsmith";
import { evaluate } from "langsmith/evaluation";
import type { ExampleCreate } from "langsmith/schemas";
import { createLLMAsJudge } from "openevals";
import { createAgentGraph, model } from "../agent.js";
import {
  globalTopKQueryArxivPaperDocs,
  namespaceTopKQueryArxivPaperDocs,
  type QueryArxivPaperDocsTool,
} from "../tools/ablation/queryArxivPaperDocs.js";
import { downloadArxivPaper } from "../tools/downloadArxivPaper.js";
import { calculator } from "../tools/index.js";
import { queryArxivPaperDocs } from "../tools/queryArxivPaperDocs.js";
import { resolveArxivPaper } from "../tools/resolveArxivPaper.js";

const DATASET_NAME = "eval";
const DATASET_PATH = fileURLToPath(new URL("./eval.json", import.meta.url));

type ExpectedBehavior = "answer" | "clarify" | "refuse";
type AblationName =
  | "global-top-k"
  | "namespace-top-k"
  | "namespace-top-k-lexical-rrf";

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

type AblationResult = {
  name: AblationName;
  experimentName: string;
  langsmithUrl: string;
  scoresByEvalCaseId: Map<string, boolean | null>;
  passed: number;
  total: number;
};

const JUDGE_PROMPT = `You are grading an agent answer for a research-paper RAG assignment.

Return true only when the response satisfies the expected behavior.
You must output valid JSON with exactly these keys:
- "score": boolean
- "reasoning": string

Expected behavior rules:
- answer: The response must match the reference answer and grading notes.
- clarify: The response must ask for the needed clarification and must not answer a random paper.
- refuse: The response must refuse or say the indexed corpus is not appropriate.

Question and expected behavior:
{inputs}

Agent response:
{outputs}

Reference answer and grading notes:
{reference_outputs}`;

const assignmentJudge = createLLMAsJudge({
  prompt: JUDGE_PROMPT,
  feedbackKey: "assignment_score",
  // needed for eval cost issue
  // @ts-expect-error - model type mismatch is expected
  judge: model,
});

async function evaluateAssignment(params: {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  referenceOutputs?: Record<string, unknown>;
}) {
  return assignmentJudge({
    inputs: params.inputs,
    outputs: params.outputs,
    referenceOutputs: params.referenceOutputs,
  });
}

function createEvalAgent(queryTool: QueryArxivPaperDocsTool) {
  return createAgentGraph([
    calculator,
    downloadArxivPaper,
    resolveArxivPaper,
    queryTool,
  ]);
}

function scoreLabel(score: boolean | null) {
  if (score === true) {
    return "PASS";
  }
  if (score === false) {
    return "FAIL";
  }
  return "N/A";
}

function getAssignmentScore(
  evaluationResults: Awaited<ReturnType<typeof evaluate>>["results"][number]["evaluationResults"],
) {
  const score = evaluationResults.results.find(
    (result) => result.key === "assignment_score",
  )?.score;

  return typeof score === "boolean" ? score : null;
}

function printAblationMatrix(results: AblationResult[], evalCases: EvalCase[]) {
  const rows = evalCases.map((evalCase) => {
    const row: Record<string, string> = {
      eval: evalCase.id,
    };

    for (const result of results) {
      row[result.name] = scoreLabel(
        result.scoresByEvalCaseId.get(evalCase.id) ?? null,
      );
    }

    return row;
  });

  console.log("\nAblation comparison matrix");
  console.table(rows);
}

const data = await readFile(DATASET_PATH, "utf8");
const evalCases = JSON.parse(data) as EvalCase[];

const client = new Client();
const datasetExists = await client.hasDataset({ datasetName: DATASET_NAME });

if (datasetExists) {
  await client.deleteDataset({ datasetName: DATASET_NAME });
}

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

const ablations: { name: AblationName; queryTool: QueryArxivPaperDocsTool }[] = [
  {
    name: "namespace-top-k-lexical-rrf",
    queryTool: queryArxivPaperDocs,
  },
  {
    name: "namespace-top-k",
    queryTool: namespaceTopKQueryArxivPaperDocs,
  },
  {
    name: "global-top-k",
    queryTool: globalTopKQueryArxivPaperDocs,
  },
];

const ablationResults: AblationResult[] = [];

for (const ablation of ablations) {
  const evalAgent = createEvalAgent(ablation.queryTool);

  async function runAgent(inputs: EvalInputs): Promise<{ answer: string }> {
    const result = await evalAgent.invoke({
      messages: [{ role: "user", content: inputs.input_question }],
    });

    const answer = result.messages.at(-1)?.text ?? "";

    return { answer };
  }

  const experimentResults = await evaluate(runAgent, {
    data: DATASET_NAME,
    evaluators: [evaluateAssignment],
    experimentPrefix: `skyclad-agent-${ablation.name}`,
    metadata: {
      ablation: ablation.name,
    },
    maxConcurrency: 1,
    client,
  });

  const scoresByEvalCaseId = new Map<string, boolean | null>();
  for (const row of experimentResults.results) {
    const evalCaseId =
      typeof row.example.metadata?.id === "string" ? row.example.metadata.id : row.example.id;
    scoresByEvalCaseId.set(evalCaseId, getAssignmentScore(row.evaluationResults));
  }

  const scoredValues = [...scoresByEvalCaseId.values()];
  const passed = scoredValues.filter((score) => score === true).length;
  const langsmithUrl = await client.getProjectUrl({
    projectName: experimentResults.experimentName,
  });

  ablationResults.push({
    name: ablation.name,
    experimentName: experimentResults.experimentName,
    langsmithUrl,
    scoresByEvalCaseId,
    passed,
    total: scoredValues.length,
  });
}

printAblationMatrix(ablationResults, evalCases);
