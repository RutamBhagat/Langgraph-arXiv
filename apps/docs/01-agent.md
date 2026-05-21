# Agent

Source file: `apps/server/src/agent.ts`

This is where we choose the chat model, attach the tools, and export the explicit graph that LangGraph runs.

## Model Setup

The first thing the file does is choose a model from environment variables.

If `OPENAI_PROXY_BASE_URL` exists, we use `ChatOpenAI` with `gpt-5.5`.

If that is not configured, but `GOOGLE_API_KEY` exists, we use `ChatGoogle` with `gemini-3.1-flash-lite-preview`.

If neither path is configured, the file throws during startup.

## LangSmith Metadata

The model config includes LangSmith metadata:

- `ls_provider`
- `ls_model_name`

This helps LangSmith label traces correctly.

## Tool Setup

The tools come from:

```ts
import { TOOLS } from "./tools/index.js";
```

Right now that list contains:

- `calculator`
- `download_arxiv_paper`
- `resolve_arxiv_paper`
- `query_arxiv_paper_docs`

So the model can do math, index papers, find papers, and retrieve chunks from a paper.

## Agent Loop

The actual graph is created with:

```ts
new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();
```

The graph uses a direct ReAct-style loop:

1. `agent` calls the tool-bound chat model with the system prompt and current message state.
2. `shouldContinue` checks the last assistant message for tool calls.
3. If there are tool calls, the graph routes to `tools`.
4. `ToolNode` runs the requested tools and appends tool observations.
5. The graph returns to `agent`.
6. If there are no tool calls, the graph ends.

## Prompt Contract

The prompt comes from `apps/server/src/prompts.ts`.

It tells the agent how to choose between the tools:

- Resolve a paper before querying its chunks.
- Query paper docs only after it has a valid `paperId`.
- Download only when the user explicitly asks to fetch or index.
- Ask for clarification when the paper request is ambiguous.
- Use the calculator for math.
- Refuse grounded-answer requests when it cannot find relevant papers.

The production `agent` is created by calling `createAgentGraph(TOOLS)`. The eval runner calls the same graph factory with a different `query_arxiv_paper_docs` implementation for each ablation.

## Exports

The file exports three things:

- `model`
- `createAgentGraph`
- `agent`

`agent` is what LangGraph Studio and the graph server run.

`createAgentGraph` is reused by the eval script so the evaluated path is the same graph loop as production.

`model` is reused by the eval script as the LLM judge model.
