# Agent

Source file: `apps/server/src/agent.ts`

This file is intentionally small.

If you are new to the project, read this file as the place where we choose the chat model, attach the tools, and export the agent that LangGraph runs.

## Model Setup

The first thing the file does is choose a model from environment variables.

If `OPENAI_PROXY_BASE_URL` exists, we use `ChatOpenAI` with `gpt-5.4-mini`.

If that is not configured, but `GOOGLE_API_KEY` exists, we use `ChatGoogle` with `gemini-3.1-flash-lite-preview`.

If neither path is configured, the file throws during startup. That is intentional because the agent cannot run without a model provider.

## LangSmith Metadata

The model config includes LangSmith metadata:

- `ls_provider`
- `ls_model_name`

This helps LangSmith label traces correctly, especially when the OpenAI path is going through a proxy.

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

## The Agent Loop

The actual agent is created with:

```ts
createAgent({
  model,
  tools: TOOLS,
  systemPrompt: SYSTEM_PROMPT,
});
```

That is the main idea of this file.

We are not manually building graph nodes and edges here. `createAgent` gives us the standard ReAct-style loop:

1. The model reads the user message and system prompt.
2. The model decides whether to call a tool.
3. The tool runs and returns an observation.
4. The model reads the observation.
5. The model either calls another tool or answers the user.

## System Prompt

The prompt comes from `apps/server/src/prompts.ts`.

It tells the agent the policy for tool use:

- Resolve a paper before querying its chunks.
- Query paper docs only after it has a valid `paperId`.
- Download only when the user explicitly asks to fetch or index.
- Ask for clarification when the paper request is ambiguous.
- Use the calculator for math.
- Refuse grounded-answer requests when it cannot find relevant paper evidence.

## Exports

The file exports two things:

- `model`
- `agent`

`agent` is what LangGraph Studio and the graph server run.

`model` is also reused by the eval script as the LLM judge model.
