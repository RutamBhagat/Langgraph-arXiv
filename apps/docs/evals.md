# Evals

Source: `apps/server/src/evals`

## Files

- `eval.json`: hand-written evaluation cases.
- `runEval.ts`: loads the dataset, runs the agent, and grades outputs in LangSmith.

## Dataset Shape

Each eval case contains:

- `id`
- `input_question`
- `expected_behavior`: `answer`, `clarify`, or `refuse`
- `reference_answer`
- `grading_notes`

The cases cover paper QA, ambiguity handling, refusal behavior, and exact calculator use.

## Runtime Flow

1. Read `eval.json`.
2. Delete the existing LangSmith dataset named `eval` if it exists.
3. Recreate the dataset with the current cases.
4. Insert each case as a LangSmith example.
5. Invoke the agent with `input_question`.
6. Take the final agent message as `{ answer }`.
7. Grade the answer with an LLM-as-judge evaluator.
8. Store results under a LangSmith experiment prefix of `skyclad-agent`.

## Judge

`createLLMAsJudge` from `openevals` is used with a custom rubric prompt.

The judge returns JSON with:

```json
{
  "score": true,
  "reasoning": "Short explanation"
}
```

The feedback key is `assignment_score`, so LangSmith shows the score under that name.

## Important Detail

The eval runner uses the same exported `agent` and `model` from `apps/server/src/agent.ts`. That means evals exercise the real tool-access agent path instead of a separate mock implementation.
