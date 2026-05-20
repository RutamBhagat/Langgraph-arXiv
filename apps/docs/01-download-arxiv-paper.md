# Download Arxiv Paper Tool

Source: `apps/server/src/tools/downloadArxivPaper.ts`

Tool name: `download_arxiv_paper`

## Purpose

`download_arxiv_paper` fetches one arXiv paper by ID and indexes it into the database so the agent can resolve and query it later.

Use this tool only when the user explicitly asks to download, fetch, or index a paper.

## Input

```json
{
  "arxivId": "1706.03762"
}
```

The schema requires a non-empty `arxivId`.

## Flow

1. Check `papers` for an existing row with the same arXiv ID.
2. If the paper already exists, return `skipped_existing`.
3. Fetch the full arXiv document with `ArxivRetriever`.
4. Clean null bytes from metadata and page content before database writes.
5. Build summary text from title, authors, and abstract.
6. Embed the summary and store it in `papers.summaryEmbedding`.
7. Split the full paper text into 3000-character chunks with 100-character overlap.
8. Embed every chunk and write the chunks to `paperDocuments`.
9. Commit the paper row and document chunks in one database transaction.

## Output

Successful ingestion returns:

```json
{
  "status": "ingested",
  "paperId": "1706.03762",
  "title": "Attention Is All You Need"
}
```

If the paper already exists, it returns `skipped_existing`. If arXiv returns no document, it returns `not_found`.

## Shared Dependencies

The tool uses `apps/server/src/tools/arxivShared.ts` for:

- Embedding model selection.
- Document splitting settings.
- Date parsing.

Embeddings come from Ollama `qwen3-embedding:8b` when configured, otherwise Gemini embeddings are used when `GOOGLE_API_KEY` is available.
