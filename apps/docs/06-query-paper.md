# Query Paper Tool

Source file: `apps/server/src/tools/queryArxivPaperDocs.ts`

Tool name: `query_arxiv_paper_docs`

This is the retrieval tool. It expects a specific `paperId`.

This tool searches inside one paper only. It does not choose between papers.

It takes a `paperId` and retrieves the chunks that look relevant to the question.

## What Input Looks Like

```json
{
  "paperId": "1706.03762",
  "question": "What problem does self-attention solve?",
  "lexicalQuery": "self-attention OR recurrent OR sequential"
}
```

`paperId` is the ID from the find-paper step.

`question` is the actual user question.

`lexicalQuery` is for exact keyword matching. It can be an empty string if there are no useful exact terms.

## Walkthrough

First, the tool embeds the question.

Then it runs vector search against `paperDocuments.embedding`, but only for rows with the selected `paperId`.

After that, it optionally runs PostgreSQL full-text search against `paperDocuments.pageContentSearch`. This only happens if `lexicalQuery` is not empty.

So we have two rankings:

- Semantic ranking from embeddings.
- Lexical ranking from exact text search.

The tool merges those rankings with reciprocal rank fusion. That gives one combined ranking that can reward chunks found by either search method.

Finally, it keeps the top three chunks and returns them in ranked order.

## Current Retrieval Settings

These constants live in `apps/server/src/tools/arxivShared.ts`:

- `DOCUMENT_VECTOR_LIMIT = 80`
- `LEXICAL_LIMIT = 80`
- `TOP_DOCUMENT_CHUNKS = 3`
- `RRF_K = 60`

## Return Values

When retrieval works, the tool returns:

```json
{
  "status": "ok",
  "chunks": [
    {
      "id": "document-row-id",
      "paperId": "1706.03762",
      "chunkIndex": 4,
      "pageContent": "Relevant paper text..."
    },
    ...
  ]
}
```

If nothing matches, it returns:

```json
{
  "status": "no_matches",
  "chunks": []
}
```

## What To Pay Attention To

This tool gives the agent additional context. It does not write the final answer.

The final answer still depends on the agent reading these chunks and deciding whether the context is enough.
