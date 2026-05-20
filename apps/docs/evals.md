# Evals

Source folder: `apps/server/src/evals`

This folder is where we check whether the agent behaves correctly on a fixed set of examples.

There are two files to know:

- `eval.json`
- `runEval.ts`

## `eval.json`

Think of `eval.json` as the assignment rubric in data form.

Each case has:

- `id`
- `input_question`
- `expected_behavior`
- `reference_answer`
- `grading_notes`

`expected_behavior` is one of three values:

- `answer`: the agent should answer.
- `clarify`: the agent should ask a clarification question.
- `refuse`: the agent should avoid answering directly.

The cases cover paper QA, ambiguous paper names, medical refusal behavior, and calculator use.

## `runEval.ts`

This is the script that sends those cases to LangSmith.

At the top, it imports the real `agent` and `model` from `apps/server/src/agent.ts`. That part matters. We are not testing a fake agent path here.

The script does this:

1. Read `eval.json`.
2. Connect to LangSmith with `new Client()`.
3. Delete the existing dataset named `eval` if it exists.
4. Recreate the dataset.
5. Insert each JSON case as a LangSmith example.
6. Invoke the real agent with the example question.
7. Take the last agent message as the answer.
8. Grade that answer with an LLM judge.

## The Judge

The judge is created with `createLLMAsJudge` from `openevals`.

The prompt tells the judge to return JSON with:

```json
{
  "score": true,
  "reasoning": "Short explanation"
}
```

The feedback key is `assignment_score`, so that is the score name you see in LangSmith.

## What To Pay Attention To

These evals are not unit tests.

They are LangSmith experiments. They run the real agent, record traces, and then use another model call to judge whether the answer matched the expected behavior.

The experiment prefix is `skyclad-agent`.
