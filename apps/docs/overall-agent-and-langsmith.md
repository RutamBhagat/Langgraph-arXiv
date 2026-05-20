# Overall Agent, Studio, and LangSmith Flow

Sources:

- `apps/server/langgraph.json`
- `apps/server/src/agent.ts`
- `apps/server/src/api/app.ts`
- `apps/server/src/evals/runEval.ts`

## Runtime Shape

The server exposes two things through `langgraph.json`:

- Graph: `agent` from `./src/agent.ts:agent`
- HTTP app: `app` from `./src/api/app.ts:app`

The graph is the chat/research agent. The HTTP app is the ingest API used by `.ingest/raw`.

## LangGraph Studio

LangGraph Studio works from `langgraph.json`.

The important graph entry is:

```json
{
  "graphs": {
    "agent": "./src/agent.ts:agent"
  }
}
```

That tells the LangGraph server where to import the runnable graph. Studio can then load the `agent` graph, send messages to it, inspect runs, and show tool calls as the agent loops through model calls and tool observations.

Because this project uses `createAgent`, Studio sees a straightforward agent graph instead of a custom multi-node workflow.

## LangSmith Tracing

LangSmith tracing records model calls, tool calls, inputs, outputs, timings, and metadata for agent runs when LangSmith environment variables are configured.

The model metadata in `agent.ts` helps LangSmith identify the provider and model:

- `ls_provider`
- `ls_model_name`

This is especially useful when the OpenAI path uses a proxy or when the Google model is wrapped with `.withConfig()`.

## Token Usage and Cost

LangSmith cost tracking depends on model usage metadata. Chat model responses usually include token usage fields such as input tokens, output tokens, and total tokens.

LangSmith uses provider/model metadata plus token usage metadata to display token counts and estimated costs when the provider integration supports it.

In this project, `agent.ts` explicitly sets LangSmith provider and model metadata so traced runs are easier to attribute.

## Evals in LangSmith

`apps/server/src/evals/runEval.ts` creates a LangSmith dataset from `eval.json`, runs the real `agent`, and creates an experiment with prefix `skyclad-agent`.

Each example is graded by an LLM-as-judge evaluator from `openevals`.

The evaluator receives:

- The original input question.
- The agent answer.
- The expected behavior.
- The reference answer.
- The grading notes.

The feedback key is `assignment_score`, so LangSmith shows pass/fail judge feedback on each evaluated run.

## End-to-End Path

1. `.ingest/raw/ingest.sh` posts arXiv IDs to the HTTP ingest route.
2. The HTTP route invokes `download_arxiv_paper`.
3. Downloaded papers and chunks are stored with embeddings.
4. The user asks the agent a question in Studio or through the graph API.
5. The agent resolves a paper, queries chunks, and answers from retrieved evidence.
6. LangSmith traces the run, token usage, tool calls, and metadata.
7. `runEval.ts` can replay fixed cases and score answers with an LLM judge.
