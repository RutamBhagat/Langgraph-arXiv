# Find Paper Tool

Source file: `apps/server/src/tools/resolveArxivPaper.ts`

Tool name: `resolve_arxiv_paper`

This is the lookup tool. Once papers are already indexed, this tool helps the agent figure out which paper the user is talking about.

If the paper is not already in the `papers` table, this tool cannot find it.

So this step is only about turning a title, arXiv ID, or short paper description into a `paperId`. It does not index papers or search inside their chunks.

## What Input Looks Like

```json
{
  "query": "Attention Is All You Need"
}
```

The input is just one non-empty string.

In the prompt, we tell the agent to pass a clean title or arXiv ID when the user gives one. So if the user says "According to Attention Is All You Need...", the agent should search for `Attention Is All You Need`, not the entire question.

## Walkthrough

The tool embeds the query first.

Then it compares that query embedding against `papers.summaryEmbedding`.

That `summaryEmbedding` was created by the download tool from the paper title, authors, and abstract. So this search is paper-level search, not chunk-level search.

The database query ranks rows by cosine similarity and returns the top three candidates.

## Return Values

When it finds matches, the shape is:

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

If there are no indexed papers, it returns:

```json
{
  "status": "not_found"
}
```

## What To Pay Attention To

The main output is `paperId`.

The agent should take that `paperId` and pass it into `query_arxiv_paper_docs`.
