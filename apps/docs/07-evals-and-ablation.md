# Evals and Ablation

Source folder: `apps/server/src/evals`

Here we check the agent against a fixed set of examples.

## `eval.json`

`eval.json` is the assignment rubric in data form.

Each case has:

- `id`
- `input_question`
- `expected_behavior`
- `reference_answer`
- `grading_notes`

`expected_behavior` can be either:

- `answer`: the agent should answer.
- `clarify`: the agent should ask a clarification question.
- `refuse`: the agent should avoid answering directly.

The cases cover paper Q&A, ambiguous paper names, medical refusal behavior, and calculator use.

## `runEval.ts`

This is the script that sends those cases to LangSmith and compares retrieval variants.

The script uses the same tools as the real agent. The only thing it swaps is the implementation of the `query_arxiv_paper_docs` tool, so each run uses a different retrieval strategy.

The script does this:

1. Read `eval.json`.
2. Connect to LangSmith with `new Client()`.
3. Delete the existing dataset named `eval` if it exists. (This was required to make edits to the eval.json file and have them reflect in the dataset)
4. Recreate the dataset.
5. Insert each JSON case as a LangSmith example.
6. Build three eval agents that differ only in retrieval.
7. Run each agent against the full dataset.
8. Take the last agent message as the answer.
9. Grade that answer with an LLM judge.
10. Print a comparison matrix and LangSmith links.

The three retrieval variants are:

- `namespace-top-k-lexical-rrf`: the current production retrieval tool, scoped to `paperId`, with vector retrieval, optional PostgreSQL lexical search, and Reciprocal Rank Fusion.
- `namespace-top-k`: vector top-k retrieval scoped to the resolved `paperId`.
- `global-top-k`: vector top-k retrieval across all indexed document chunks.

All three variants expose the same LangChain tool name:

```ts
name: "query_arxiv_paper_docs"
```

That keeps the same agent and only changes the retrieval technique.

## Ablation Tools

The ablation-only retrieval tools live in:

```text
apps/server/src/tools/ablation/queryArxivPaperDocs.ts
```

That file exports these tools:

- `globalTopKQueryArxivPaperDocs`
- `namespaceTopKQueryArxivPaperDocs`

The production tool remains in:

```text
apps/server/src/tools/queryArxivPaperDocs.ts
```

`runEval.ts` imports all three tools and chooses which one to attach to each eval agent.

## The Judge

The judge is created using `openevals`.

The prompt tells the judge to return JSON with:

```json
{
  "score": true,
  "reasoning": "Short explanation"
}
```

The feedback key is `assignment_score`, so that is the score name you see in LangSmith.

## What To Pay Attention To

These are LangSmith experiments. They run real agent loops, record traces, and then use another model call to judge if each answer matched the expected behavior.

At the end, the script prints:

- an ablation comparison matrix by eval case;
- a summary table with passed count, total count, accuracy, and LangSmith URL
