# Download Arxiv Paper Tool

Source file: `apps/server/src/tools/downloadArxivPaper.ts`

Tool name: `download_arxiv_paper`

This is the indexing tool. If a paper is not already in our database, this is the tool that fetches it from arXiv, breaks it into chunks, embeds it, and saves everything.

The important thing to remember is that this tool should not be used for normal question answering. The system prompt tells the agent to call it only when the user explicitly asks to download, fetch, or index a paper.

## This is what input looks like

```json
{
  "arxivId": "1706.03762"
}
```

We only need a non-empty arXiv ID.

## Walkthrough

First, the tool checks the `papers` table for the same ID. If the paper is already there, it returns `skipped_existing`. That makes repeated ingest safe and avoids creating duplicate chunks.

If the paper is not present, it uses LangChain's `ArxivRetriever` with `getFullDocuments: true`. That gives us the paper metadata plus full text content.

After that, it cleans null bytes from the title, authors, summary, and page content. This is important because null bytes break database writes.

Then it builds one summary string from:

- Title.
- Authors.
- Abstract.

That summary string is embedded and stored on the `papers` row as `summaryEmbedding`. Later, the find-paper tool searches against this field.

Next, the full paper text is split into chunks. The splitter lives in `apps/server/src/tools/arxivShared.ts` and currently uses 3000 characters with 100 characters of overlap.

Each chunk gets its own embedding, and the tool writes those chunks to `paperDocuments`.

The paper row and document chunks are written inside one transaction. So if the chunk insert fails, we do not leave behind a half-indexed paper.

Embeddings use local Ollama when `EMBEDDINGS_MODEL` is `qwen3-embedding:8b`. Otherwise the code uses Gemini embeddings when `GOOGLE_API_KEY` is configured.

## Return Values

For a new paper, expect something like:

```json
{
  "status": "ingested",
  "paperId": "1706.03762",
  "title": "Attention Is All You Need"
}
```

If the paper already exists, the status is `skipped_existing`.

If arXiv does not return a document, the status is `not_found`.
