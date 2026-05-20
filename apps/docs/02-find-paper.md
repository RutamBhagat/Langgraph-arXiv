# Find Paper Tool

Source: `apps/server/src/tools/resolveArxivPaper.ts`

Tool name: `resolve_arxiv_paper`

## Purpose

`resolve_arxiv_paper` finds the most relevant ingested paper for a title, arXiv ID, bibliographic identifier, or broad paper query.

This tool does not download new papers. It only searches papers already stored in the database.

## Input

```json
{
  "query": "Attention Is All You Need"
}
```

The schema requires a non-empty `query`.

## Flow

1. Embed the query with the shared embedding model.
2. Compare the query embedding against `papers.summaryEmbedding`.
3. Rank papers by cosine similarity.
4. Return the top three candidate papers.

The agent prompt asks the model to pass only the title or ID when the user names a specific paper. Broader topic text should be used only when the user does not provide an exact paper identifier.

## Output

When matches exist, the tool returns:

```json
{
  "status": "resolved",
  "candidates": [
    {
      "paperId": "1706.03762",
      "title": "Attention Is All You Need",
      "similarity": 0.92
    }
  ]
}
```

If no papers exist in the index, it returns:

```json
{
  "status": "not_found"
}
```

## Downstream Use

The important value is `paperId`. The agent should pass that ID to `query_arxiv_paper_docs` before answering paper-specific questions.
