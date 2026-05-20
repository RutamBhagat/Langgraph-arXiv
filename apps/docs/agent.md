# Agent

Source: `apps/server/src/agent.ts`

## Purpose

`agent.ts` exports a simple LangChain/LangGraph agent with access to the project tools.

It is not a custom graph with many nodes. The code delegates the ReAct-style loop to `createAgent`.

## Model Selection

The model is selected from environment configuration:

- If `OPENAI_PROXY_BASE_URL` is set, use `ChatOpenAI` with `gpt-5.5`.
- Otherwise, if `GOOGLE_API_KEY` is set, use `ChatGoogle` with `gemini-3.1-flash-lite-preview`.
- If neither provider is configured, startup throws an error.

The OpenAI path sets LangSmith metadata for provider and model name. The Google path uses `.withConfig()` to attach equivalent metadata.

## Tool Access

The agent receives `TOOLS` from `apps/server/src/tools/index.ts`.

Current tools:

- `calculator`
- `download_arxiv_paper`
- `resolve_arxiv_paper`
- `query_arxiv_paper_docs`

## ReAct Loop

At runtime, the agent follows the normal tool-calling loop:

1. Read user messages and the system prompt.
2. Decide whether a tool call is needed.
3. Call a tool when needed.
4. Read the tool observation.
5. Continue reasoning or answer the user.

The loop is simple because the project does not hand-code graph nodes or edges. `createAgent` builds the runnable agent around the model, tools, and system prompt.

## System Prompt

`apps/server/src/prompts.ts` tells the agent to:

- Resolve papers before querying paper documents.
- Query document chunks after a valid `paperId` is known.
- Download only when the user explicitly asks to fetch or index a paper.
- Ask clarifying questions for ambiguous paper requests.
- Use the calculator for math.
- Refuse grounded-answer requests when relevant paper evidence is missing.

## Exports

`agent.ts` exports:

- `model`: reused by the eval LLM judge.
- `agent`: used by LangGraph Studio, LangGraph server, and eval runs.
