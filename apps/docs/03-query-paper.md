# Query Paper Tool

Source: `apps/server/src/tools/queryArxivPaperDocs.ts`

Tool name: `query_arxiv_paper_docs`

## Purpose

`query_arxiv_paper_docs` retrieves the best evidence chunks from one ingested paper.

It does not search across papers. It needs a `paperId` that was already returned by `resolve_arxiv_paper`.

## Input

```json
{
  "paperId": "1706.03762",
  "question": "What problem does self-attention solve?",
  "lexicalQuery": "self-attention recurrent sequential"
}
```

`paperId` and `question` must be non-empty strings. `lexicalQuery` can be an empty string when exact terms are not useful.

## Flow

1. Embed the question.
2. Run semantic vector search against `paperDocuments.embedding` for the selected `paperId`.
3. Run PostgreSQL full-text search against `paperDocuments.pageContentSearch` when `lexicalQuery` is not empty.
4. Fuse semantic and lexical rankings with reciprocal rank fusion.
5. Keep the top three document chunks.
6. Fetch the chunk text and return chunks in fused-rank order.

## Retrieval Settings

Defined in `apps/server/src/tools/arxivShared.ts`:

- `DOCUMENT_VECTOR_LIMIT = 80`
- `LEXICAL_LIMIT = 80`
- `TOP_DOCUMENT_CHUNKS = 3`
- `RRF_K = 60`

## Output

When matches exist, the tool returns:

```json
{
  "status": "ok",
  "chunks": [
    {
      "id": "document-row-id",
      "paperId": "1706.03762",
      "chunkIndex": 4,
      "pageContent": "Relevant paper text..."
    }
  ]
}
```

If no chunks match, it returns:

```json
{
  "status": "no_matches",
  "chunks": []
}
```

## Agent Responsibility

The tool returns evidence. The agent still has to read the chunks, answer the user, and avoid answering when the retrieved evidence is not enough.
