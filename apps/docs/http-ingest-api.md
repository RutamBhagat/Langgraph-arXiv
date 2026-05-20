# HTTP Ingest API

Sources:

- `apps/server/src/api/app.ts`
- `apps/server/.ingest/raw`
- `apps/server/langgraph.json`

## Purpose

The HTTP API exposes the download tool so raw paper metadata can be ingested without going through the chat agent.

Only `download_arxiv_paper` is exposed over HTTP in the current code.

## Route

```http
POST /tools/download-arxiv-paper
Content-Type: application/json
```

Request body:

```json
{
  "arxivId": "1706.03762"
}
```

## Flow

1. The Hono app receives the POST request.
2. It parses the JSON body.
3. It validates the body with `downloadArxivPaper.schema`.
4. It calls `downloadArxivPaper.invoke(parsed.data)`.
5. It returns the tool result as JSON.

Invalid JSON returns HTTP `400` with `Invalid JSON body`.

Schema validation failure returns HTTP `400` with the expected schema and Zod issues.

## Raw Ingest Script

`apps/server/.ingest/raw/metadata.json` contains a list of arXiv IDs.

`apps/server/.ingest/raw/ingest.sh` reads that file with `jq` and posts each ID to:

```text
http://localhost:2024/tools/download-arxiv-paper
```

The script stops on the first non-2xx response. It sleeps three seconds between requests to avoid hammering the endpoint.

## LangGraph Server Exposure

`apps/server/langgraph.json` exposes the Hono app through:

```json
{
  "http": {
    "app": "./src/api/app.ts:app"
  }
}
```

When the LangGraph dev server is running, this makes the Hono route available beside the graph API.
