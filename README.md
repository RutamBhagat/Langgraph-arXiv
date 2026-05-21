# arXiv7

This is a LangGraph-based agentic RAG system for asking questions about indexed arXiv papers.

Let me explain what was built, why the major choices were made, and where the project boundaries are. The detailed local runbook lives in [apps/docs/00-setup.md](apps/docs/00-setup.md).

For setup, start there:

```bash
git clone git@github.com:RutamBhagat/skyclad_langgraph.git
cd skyclad_langgraph
pnpm i
pnpm run db:start
pnpm run db:migrate
pnpm run dev
```

Then follow [apps/docs/00-setup.md](apps/docs/00-setup.md) for environment variables, paper ingestion, LangSmith tracing, and eval execution.

## Architecture

The main graph is exported from `apps/server/src/agent.ts`.

`langgraphjs dev` loads that graph through `apps/server/langgraph.json`, and LangGraph Studio provides the conversational interface. I did not build a custom frontend because Studio already provides a strong chat UI plus tool-call inspection for this kind of agent.

The agent has four tools:

- `download_arxiv_paper`: fetch and index one arXiv paper.
- `resolve_arxiv_paper`: resolve a title, arXiv ID, or bibliographic hint to an indexed paper.
- `query_arxiv_paper_docs`: retrieve evidence chunks inside one resolved paper.
- `calculator`: evaluate math expressions with a deterministic tool.

Normal question-answering flow:

1. The user asks in LangGraph Studio.
2. The model decides if it should answer directly, ask a clarification, refuse, or call a tool.
3. For paper-grounded answers, it resolves the paper first.
4. It queries chunks only after it has a valid `paperId`.
5. It answers from the returned chunks, or refuses when the context is not enough.

Batch ingestion uses `POST /tools/download-arxiv-paper`, exposed by the Hono app in `apps/server/src/api/app.ts`. That route calls the same `download_arxiv_paper` tool the agent can call.

Storage is PostgreSQL with pgvector:

- `papers` stores arXiv metadata, abstract text, and a 1536-dimensional summary embedding.
- `paper_documents` stores chunks, chunk embeddings, and a generated `tsvector`.
- HNSW indexes handle cosine vector search.
- A GIN index handles PostgreSQL full-text search.

This gives two levels of retrieval: first resolve the paper, then search only inside that paper.

## Decisions Log

### Agent Framework

I used an explicit LangGraph `StateGraph` instead of the higher-level LangChain agent helper.

The core behavior is the agent decision loop around paper-grounded retrieval. The graph has an `agent` node that calls the tool-bound chat model, a conditional edge that checks the last assistant message for tool calls, and a `tools` node that executes those calls through `ToolNode`. Tool observations flow back into the `agent` node until the model returns a normal assistant answer.

This keeps the implementation small enough to audit while making the actual graph path visible in code and in LangGraph Studio.

### Model Selection

The server supports two model paths:

- OpenAI-compatible proxy path: `OPENAI_PROXY_BASE_URL` uses `gpt-5.5`.
- Google path: `GOOGLE_API_KEY` uses `gemini-3.1-flash-lite-preview`.

The proxy path exists so the project can be run through a local OpenAI-compatible OAuth proxy during development. The Google path is the simple API-key path for hosted or local runs. If neither provider is configured, startup fails.

### Corpus and Ingestion

The corpus is an equivalent technical-paper corpus of 50 famous and foundational arXiv papers rather than a last-90-days cs.AI scrape. I chose this because these papers are well-known enough to support meaningful hand-written evals, cover the core ideas behind modern LLM and agent systems, and make retrieval failures easier to inspect than a random recent-paper sample.

The ingest path uses LangChain's arXiv retriever with `getFullDocuments: true`. It gets metadata and paper text through LangChain's maintained integration and avoids a custom PDF or TeX extraction system.

Chunks are made with `RecursiveCharacterTextSplitter` at 3000 characters with 100 characters of overlap. That is simple and effective. The agent retrieves only three final chunks, so each chunk needs enough local context for an answer without flooding the model with unrelated paper text. This size is roughly one paragraph section of a paper.

### Retrieval Design

The retrieval design is not global top-k on all chunks.

First, `resolve_arxiv_paper` searches paper summaries. The summary embedding is made from title, authors, and abstract for choosing which paper the user needs.

Second, `query_arxiv_paper_docs` searches chunks only for that `paperId`. It runs vector search and optional PostgreSQL full-text search, then merges both rankings with Reciprocal Rank Fusion.

This is scoped hybrid retrieval, not just a simple cosine top-k over the whole corpus.

### Why No Reranker

I did not add reranking because it is the wrong first extra layer for this app.

A reranker is useful when the first-stage retriever returns a noisy candidate set and the generation step is one-shot. Here, the agent is already in a ReAct-style loop: it can resolve a paper, inspect tool output, adjust the question or lexical query, and call retrieval again. Adding a reranker before measuring a failure would add another model call and another latency/cost source while duplicating part of the agent's own relevance judgment.

### Memory

The useful memory for this project is conversation memory: the current message history in the LangGraph agent session. Follow-up questions can use the earlier paper mention, earlier clarification, and earlier tool observations.

I did not add semantic user memory or episodic long-term user memory. This is a paper-grounded RAG system, not a personal assistant. Persisting user facts would not improve deterministic answers about indexed papers, and it would create extra retrieval, privacy, freshness, and evaluation problems.

The paper context itself is the semantic memory. The agent trace is captured through LangSmith.

### Context and Cache Policy

Modern model context windows are large enough for this app's active chat state plus three retrieved chunks. Gemini and Claude have offered up to 1M-token context windows in recent API models. That does not mean "stuff everything forever"; the `Lost in the Middle` result shows long-context models can still use information less reliably depending on where it appears. But practically for the current conversation and retrieved context, we do not need a summarizing memory layer.

Dropping early messages can also make provider prompt caching worse. OpenAI's prompt caching depends on exact prefix matches, so removing or rewriting early turns changes the prefix. For agent sessions with stable system prompts and tool schemas, preserving the prefix is cheaper and faster than constantly compacting it or removing earlier turns to keep only last N turns.

## Evaluation

The eval harness is in `apps/server/src/evals`.

`eval.json` contains the fixed evaluation cases. The cases cover normal paper-grounded answers, ambiguous paper references, refusal behavior, and calculator use.

`runEval.ts` creates a LangSmith dataset, runs three variants of the same LangGraph agent, and grades each final answer with an LLM-as-judge evaluator from `openevals`. The feedback key is `assignment_score`.

The variants all use the same graph loop and expose the same `query_arxiv_paper_docs` tool name to the agent. Only the retrieval implementation changes:

- `namespace-top-k-lexical-rrf`: current production retrieval, scoped to `paperId`, using vector search, optional PostgreSQL lexical search, and Reciprocal Rank Fusion.
- `namespace-top-k`: vector top-k retrieval scoped to the resolved `paperId`.
- `global-top-k`: vector top-k retrieval across all indexed chunks.

The ablation-only tools are in `apps/server/src/tools/ablation/queryArxivPaperDocs.ts`, the production hybrid tool is in `apps/server/src/tools/queryArxivPaperDocs.ts`.

During the run, LangSmith prints experiment links for each variant. At the end, the script prints a per-case comparison matrix. The durable eval results live in the linked LangSmith experiment dashboards, including the agent traces, judge scores, feedback, timing, token usage, and provider metadata.

Run it with:

```bash
pnpm run eval
```

## Observability

LangGraph Studio is the interactive UI. Turn on tool-call display to see which tool the agent chose and what each tool returned.

LangSmith is the trace and eval layer. With the LangSmith environment variables, each chat run records the user input, model calls, tool calls, tool outputs, final response, timing, token usage, and provider metadata.

This is important because the agent's reasoning is inspectable through its observable decisions, not just a final answer.

## Failure Modes

If the user names an ambiguous paper, the agent should ask for identifying details instead of guessing. Useful details are title, authors, arXiv ID, link, etc.

If the paper is not indexed, `resolve_arxiv_paper` returns `not_found`.

If retrieved chunks are not enough, the agent should say it does not know from the indexed evidence. This is better than using general model memory for a grounded context question.

If the user asks an out-of-domain question, the agent should refuse direct advice and offer a safer general alternative when appropriate.

## Known Limitations

The corpus is only what has been ingested. This is intentional: normal QA should not silently download new papers unless the user explicitly asks to fetch or index them.

The architecture is intentionally close to Context7's retrieval shape, with modifications for paper-level resolution, arXiv ingestion, and the assignment's agent requirements.

Context7's two-step pattern works well for this problem: resolve the right source first, then retrieve within that source instead of searching every chunk globally.

## What I Would Do With Another Week

First, I would expand the retrieval ablations:

- try an answer-only variant that removes previous tool calls and tool observations from the response context before the model writes the final answer

- add reranking to the ablation to see if it actually makes the agent better at retrieving relevant information.

## Project Docs

- [Setup](apps/docs/00-setup.md)
- [Agent](apps/docs/01-agent.md)
- [Download arXiv paper tool](apps/docs/02-download-arxiv-paper.md)
- [Overall agent and LangSmith flow](apps/docs/03-overall-agent-and-langsmith.md)
- [HTTP ingest API](apps/docs/04-http-ingest-api.md)
- [Find paper tool](apps/docs/05-find-paper.md)
- [Query paper tool](apps/docs/06-query-paper.md)
- [Evals and ablation](apps/docs/07-evals-and-ablation.md)

## References

- [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching): cache hits require exact prompt-prefix matches.
- [Don't Break the Cache](https://arxiv.org/html/2601.06007v2): prompt caching can reduce agent API costs and time to first token.
