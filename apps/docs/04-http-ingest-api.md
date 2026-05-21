# HTTP Ingest API

Source files:

- `apps/server/src/api/app.ts`
- `apps/server/.ingest/raw/ingest.sh`
- `apps/server/.ingest/raw/metadata.json`
- `apps/server/langgraph.json`

This is used to ingest papers programmatically.
The agent has the download tool, but for batch ingest we expose that same tool over HTTP.

## The Route

The route is:

```http
POST /tools/download-arxiv-paper
```

The body looks like:

```json
{
  "arxivId": "1706.03762"
}
```

## Raw Ingest Folder

`apps/server/.ingest/raw/metadata.json` is just a list of arXiv IDs.

`apps/server/.ingest/raw/ingest.sh` reads that list with `jq`.

For each row, it posts this body to:

```text
http://localhost:2024/tools/download-arxiv-paper
```

The script stops if any request fails. It also sleeps three seconds between requests because the arXiv api has rate limits.

## How LangGraph Exposes It

`apps/server/langgraph.json` has this section:

```json
{
  "http": {
    "app": "./src/api/app.ts:app"
  }
}
```

That tells the LangGraph server to import the Hono app and serve it with the graph API.

## What To Pay Attention To

Only the download tool is exposed over HTTP here.

Finding papers and querying paper chunks still happen through the agent tool loop.
