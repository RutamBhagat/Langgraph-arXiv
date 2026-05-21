# Overall Agent, Studio, and LangSmith Flow

Source files:

- `apps/server/langgraph.json`
- `apps/server/src/agent.ts`
- `apps/server/src/api/app.ts`
- `apps/server/src/evals/runEval.ts`

This is how everything connects.

The project has one chat agent graph, one small HTTP endpoint, and LangSmith to trace and evaluate the runs.

## What `langgraph.json` Does

It exposes the agent graph:

```json
{
  "graphs": {
    "agent": "./src/agent.ts:agent"
  }
}
```

That tells LangGraph where to import the runnable agent from.

It also exposes the HTTP app:

```json
{
  "http": {
    "app": "./src/api/app.ts:app"
  }
}
```

So there are two entry points:

- The graph entry point for chat and Studio.
- The HTTP entry point for raw paper ingestion.

LangGraph Studio reads the graph config and loads the `agent`.

When you send a message in Studio, Studio is running that graph.

Because the graph is built with `createAgent`, the flow is simple:

1. User message goes in.
2. Model decides what to do.
3. Tool calls run when needed.
4. Tool observations come back.
5. Model continues or returns the final answer.

In Studio, you can see model calls, tool calls, and the messages passed between them.

LangSmith is the observability layer.

When tracing environment variables are present, LangSmith records the run. For this project, it shows:

- User input.
- Model calls.
- Tool calls.
- Tool outputs.
- Final response.
- Timing.
- Metadata.

In `agent.ts`, the model is configured with:

- `ls_provider`
- `ls_model_name`

Those metadata fields help LangSmith label the run with the correct provider and model.

## Token Usage and Cost

Token usage comes from the model response metadata. Providers usually return input tokens, output tokens, and total tokens.

LangSmith can use that usage metadata plus provider/model information to show token counts and estimated cost.

`apps/server/src/evals/runEval.ts` runs the agent against fixed examples from `eval.json`.

It creates a LangSmith dataset named `eval`, inserts the examples, runs the real agent, and saves results under the experiment prefix `skyclad-agent`.

Then it grades each answer with an LLM-as-judge evaluator from `openevals`.

The judge checks the question, the agent answer, the expected behavior, the reference answer, and the grading notes.

The feedback key is:

```text
assignment_score
```

## End-to-End

The normal flow from ingest to evaluation:

First, `.ingest/raw/ingest.sh` reads arXiv IDs from `metadata.json`.

Then it posts each ID to the HTTP route:

```text
/tools/download-arxiv-paper
```

That route invokes the same `download_arxiv_paper` tool the agent can use.

The tool stores paper metadata, summary embeddings, document chunks, and chunk embeddings.

Later, the user can ask the agent a question in Studio or through the graph API.

The agent resolves the paper, retrieves chunks from that paper, and answers from the retrieved evidence.

LangSmith traces the run so we can inspect what happened.

The eval script can replay fixed examples and use an LLM judge to score if the behavior was correct.
