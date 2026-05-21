# Overall Agent, Studio, and LangSmith Flow

Source files:

- `apps/server/langgraph.json`
- `apps/server/src/agent.ts`
- `apps/server/src/api/app.ts`
- `apps/server/src/evals/runEval.ts`

This is how everything connects.

The project has one chat agent graph, one small HTTP endpoint, and LangSmith to trace and evaluate the runs.

The main pieces are:

- `01-agent.md`: model selection, tools, prompt contract, and agent export.
- `02-download-arxiv-paper.md`: one-paper ingest internals.
- `04-http-ingest-api.md`: batch ingest route and script.
- `05-find-paper.md`: paper-level lookup.
- `06-query-paper.md`: chunk retrieval inside one paper.
- `07-evals-and-ablation.md`: LangSmith eval runs and retrieval comparisons.

## What `langgraph.json` Does

`apps/server/langgraph.json` exposes two entry points.

The graph entry point imports the compiled chat graph:

```json
{
  "graphs": {
    "agent": "./src/agent.ts:agent"
  }
}
```

The HTTP entry point imports the Hono app:

```json
{
  "http": {
    "app": "./src/api/app.ts:app"
  }
}
```

Studio and graph API traffic use the graph entry point. Batch ingest uses the HTTP entry point.

## Runtime Paths

For chat:

1. LangGraph loads `agent` from `apps/server/src/agent.ts`.
2. The user sends a message through Studio or the graph API.
3. The `agent` node calls the chat model with the system prompt and message state.
4. If the assistant message contains tool calls, the graph routes to `tools`.
5. `ToolNode` executes the tools and sends observations back to `agent`.
6. When the assistant message has no tool calls, the final assistant message is returned.

For batch ingest:

1. `apps/server/.ingest/raw/ingest.sh` reads arXiv IDs from `metadata.json`.
2. The script posts each ID to `/tools/download-arxiv-paper`.
3. The HTTP route invokes the same download tool available to the agent.
4. Paper metadata, summary embeddings, chunks, and chunk embeddings are stored.

For evals:

1. `apps/server/src/evals/runEval.ts` reads examples from `eval.json`.
2. It runs the same model, prompt, and tool set against those examples.
3. It swaps only the retrieval tool implementation for ablation runs.
4. It records the runs and judge feedback in LangSmith.

## LangSmith

LangSmith is the observability layer.

When tracing environment variables are present, LangSmith records the run. For this project, it shows:

- User input.
- Model calls.
- Tool calls.
- Tool outputs.
- Final response.
- Timing.
- Metadata.

Studio is useful for stepping through a single graph run. LangSmith is useful for comparing traces across runs and eval experiments.

Token usage comes from the model response metadata. Providers usually return input tokens, output tokens, and total tokens.

LangSmith can use that usage metadata plus provider/model information to show token counts and estimated cost.
