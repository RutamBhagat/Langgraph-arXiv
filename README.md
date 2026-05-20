# Skyclad LangGraph Agentic RAG

This is a LangGraph-based agentic RAG system for asking questions about indexed arXiv papers.

The root README is intentionally the review document: it explains what was built, why the major choices were made, and where the boundaries are. The detailed local runbook lives in [apps/docs/setup.md](apps/docs/setup.md).

For setup, start there:

```bash
pnpm i
pnpm run db:start
pnpm run db:migrate
pnpm run dev
```

Then follow [apps/docs/setup.md](apps/docs/setup.md) for environment variables, paper ingestion, LangSmith tracing, and eval execution.

## Architecture

The main graph is exported from `apps/server/src/agent.ts`.

`langgraphjs dev` loads that graph through `apps/server/langgraph.json`, and LangGraph Studio provides the conversational interface. I did not build a custom frontend because the assignment says frontend prettiness is not graded; Studio already gives a clear chat UI plus tool-call inspection.

The agent has four tools:

- `download_arxiv_paper`: fetch and index one arXiv paper.
- `resolve_arxiv_paper`: resolve a title, arXiv ID, or bibliographic hint to an indexed paper.
- `query_arxiv_paper_docs`: retrieve evidence chunks inside one resolved paper.
- `calculator`: evaluate math expressions with a deterministic tool.

Normal question-answering flow:

1. The user asks in LangGraph Studio.
2. The model decides whether to answer directly, ask a clarification, refuse, or call a tool.
3. For paper-grounded answers, it resolves the paper first.
4. It queries chunks only after it has a valid `paperId`.
5. It answers from the returned chunks, or refuses when the evidence is not enough.

Batch ingestion uses `POST /tools/download-arxiv-paper`, exposed by the Hono app in `apps/server/src/api/app.ts`. That route invokes the same `download_arxiv_paper` tool the agent can call, so ingestion has one real code path instead of a separate script-only implementation.

Storage is PostgreSQL with pgvector:

- `papers` stores arXiv metadata, abstract text, and a 1536-dimensional summary embedding.
- `paper_documents` stores chunks, chunk embeddings, and a generated `tsvector`.
- HNSW indexes handle cosine vector search.
- A GIN index handles PostgreSQL full-text search.
- `paper_documents.paper_id` has a foreign key with cascade delete.

This gives two levels of retrieval: first resolve the paper, then search only inside that paper.

## Decisions Log

### Agent Framework

I used LangChain `createAgent` running under LangGraph.

The point of the assignment is the agent decision loop, not a hosted RAG product. `createAgent` still runs the local tool loop over the tools defined in this repo: model call, tool call, tool observation, then another model call until no tool is needed. LangChain's current docs describe `createAgent` as the standard agent interface with that model/tool/finish loop.

This keeps the implementation small enough to audit while still exposing real agent behavior in LangGraph Studio and LangSmith.

### Model Selection

The server supports two model paths:

- OpenAI-compatible proxy path: `OPENAI_PROXY_BASE_URL` uses `gpt-5.5`.
- Google path: `GOOGLE_API_KEY` uses `gemini-3.1-flash-lite-preview`.

The proxy path exists so the project can be run through a local OpenAI-compatible OAuth proxy during development. The Google path is the simple API-key path for reviewers. If neither provider is configured, startup fails immediately because a silent no-model fallback would hide configuration errors.

### Corpus and Ingestion

The ingest path uses LangChain's arXiv retriever with `getFullDocuments: true`. For this assignment version, that is the direct choice: it gets metadata and paper text through one maintained integration and avoids a second custom PDF or TeX extraction system.

Chunks are made with `RecursiveCharacterTextSplitter` at 3000 characters with 100 characters of overlap. That is deliberately boring. The agent retrieves only three final chunks, so the chunk size needs enough local context for an answer without flooding the model with unrelated paper text.

### Retrieval Design

The retrieval design is not global top-k over all chunks.

First, `resolve_arxiv_paper` searches paper summaries. The summary embedding is made from title, authors, and abstract, which are the right fields for choosing which paper the user means.

Second, `query_arxiv_paper_docs` searches chunks only for that `paperId`. It runs vector search and optional PostgreSQL full-text search, then merges both rankings with Reciprocal Rank Fusion.

This is the implemented non-naive retrieval technique: scoped hybrid retrieval, not a bare cosine top-k over the whole corpus.

### Why No Reranker

I did not add reranking because it is the wrong first extra layer for this shape of app.

A reranker is useful when the first-stage retriever returns a noisy candidate set and the generation step is one-shot. Here, the agent is already in a ReAct-style loop: it can resolve a paper, inspect tool output, adjust the question or lexical query, and call retrieval again. Adding a reranker before measuring a failure would add another model call and another latency/cost source while duplicating part of the agent's own relevance judgment.

If evals show retrieved chunks are consistently close but misordered, reranking is the next experiment. It is not the first coherent implementation.

### Memory

The useful memory for this assignment is conversation memory: the current message history in the LangGraph agent session. Follow-up questions can use the prior paper mention, prior clarification, and prior tool observations.

I did not add semantic user memory or episodic long-term memory. This is a paper-grounded RAG system, not a personal assistant. Persisting user facts would not improve answers about indexed papers, and it would create extra retrieval, privacy, freshness, and evaluation problems.

The paper corpus itself is the semantic memory. The agent trace is the episodic record for debugging, captured through LangSmith rather than injected back into future answers.

### Context and Cache Policy

Modern model context windows are large enough for this app's active chat state plus three retrieved chunks. Gemini documents 1M-token contexts for many models, and Claude documents up to 1M tokens for recent API models. That does not mean "stuff everything forever"; the `Lost in the Middle` result shows long-context models can still use information less reliably depending on where it appears.

The practical policy is: keep the current conversation and retrieved evidence, do not invent a summarizing memory layer until the evals prove a need.

Dropping early messages can also make provider prompt caching worse. OpenAI's prompt caching depends on exact prefix matches, so removing or rewriting early turns changes the prefix. For agent sessions with stable system prompts and tool schemas, preserving the prefix can be cheaper and faster than constantly compacting it.

## Evaluation

The eval harness lives in `apps/server/src/evals`.

`eval.json` contains the fixed assignment cases. The cases cover normal paper-grounded answers, ambiguous paper references, refusal behavior, a long-context failure-mode question, and calculator use.

`runEval.ts` creates a LangSmith dataset, runs three agent variants, and grades each final answer with an LLM-as-judge evaluator from `openevals`. The feedback key is `assignment_score`.

The variants all expose the same `query_arxiv_paper_docs` tool name to the agent. Only the retrieval implementation changes:

- `namespace-top-k-lexical-rrf`: current production retrieval, scoped to `paperId`, using vector search, optional PostgreSQL lexical search, and Reciprocal Rank Fusion.
- `namespace-top-k`: vector top-k retrieval scoped to the resolved `paperId`.
- `global-top-k`: vector top-k retrieval across all indexed chunks.

The ablation-only tools live in `apps/server/src/tools/ablation/queryArxivPaperDocs.ts`; the production hybrid tool remains in `apps/server/src/tools/queryArxivPaperDocs.ts`.

At the end, the script prints a per-case comparison matrix plus a summary table with pass counts, accuracy, and LangSmith project links for each variant.

Run it with:

```bash
pnpm run eval
```

## Observability

LangGraph Studio is the interactive debug UI. Turn on tool-call display to see which tool the agent chose and what each tool returned.

LangSmith is the durable trace and eval layer. With the LangSmith environment variables configured, each run records the user input, model calls, tool calls, tool outputs, final response, timing, token usage, and provider metadata.

This matters because the agent's reasoning should be inspectable through its observable decisions, not trusted as a hidden final answer.

## Failure Modes

If the user names an ambiguous paper, the agent should ask for identifying details instead of guessing. Useful details are title, authors, arXiv ID, link, venue, or research domain.

If the paper is not indexed, `resolve_arxiv_paper` returns `not_found`. The agent can then ask the user to index a paper or refuse to answer as though the paper exists locally.

If retrieved chunks are not enough, the agent should say it does not know from the indexed evidence. This is better than using general model memory for a grounded corpus question.

If the user asks a high-stakes or out-of-domain question, the agent should refuse direct advice and offer a safer general alternative when appropriate.

## Known Limitations

The eval harness now runs an automated retrieval ablation matrix, but it still uses one judge style for all behavior types. The calculator case would be better as deterministic exact-match scoring, while answer, clarify, and refuse cases can stay LLM-judged with strict grading notes.

The agent depends on the model following tool instructions. Tool schemas and the system prompt reduce mistakes, and LangSmith makes mistakes visible, but model tool choice is still probabilistic.

The corpus is only what has been ingested. This is intentional: normal QA should not silently download new papers unless the user explicitly asks to fetch or index them.

## What I Would Do With Another Week

First, I would expand the retrieval ablations:

- `TOP_DOCUMENT_CHUNKS` values of 3, 5, and 8.
- lexical-only retrieval inside the resolved paper.
- hybrid retrieval with and without agent-authored lexical queries.

Second, I would split eval scoring by behavior type. The calculator case should be deterministic exact-match scoring, while answer/clarify/refuse cases can stay LLM-judged with strict grading notes.

Third, I would add reranking only if the ablation shows the right chunks are retrieved but ordered poorly. If recall is the problem, reranking is the wrong fix.

## Project Docs

- [Setup](apps/docs/setup.md)
- [Agent](apps/docs/agent.md)
- [Download arXiv paper tool](apps/docs/01-download-arxiv-paper.md)
- [Find paper tool](apps/docs/02-find-paper.md)
- [Query paper tool](apps/docs/03-query-paper.md)
- [HTTP ingest API](apps/docs/http-ingest-api.md)
- [Evals](apps/docs/evals.md)
- [Overall agent and LangSmith flow](apps/docs/overall-agent-and-langsmith.md)

## References

- [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching): cache hits require exact prompt-prefix matches.
- [Don't Break the Cache](https://arxiv.org/html/2601.06007v2): prompt caching can reduce agent API costs and time to first token.
