# HTTP Ingest API

Source files:

- `apps/server/src/api/app.ts`
- `apps/server/.ingest/raw/ingest.sh`
- `apps/server/.ingest/raw/metadata.json`
- `apps/server/langgraph.json`

This part exists so we can ingest papers without chatting with the agent.

The agent has the download tool, but for batch ingest we expose that same tool over HTTP.

## The Route

The route is:

```http
POST /tools/download-arxiv-paper
Content-Type: application/json
```

The body looks like:

```json
{
  "arxivId": "1706.03762"
}
```

## Walkthrough

Open `apps/server/src/api/app.ts`.

You will see a small Hono app. It has one route.

When a request comes in, the route first tries to parse JSON. If the body is not valid JSON, it returns HTTP `400`.

Then it validates the body using `downloadArxivPaper.schema`. That is the same schema declared on the LangChain tool, so the HTTP path and agent tool path agree on input shape.

If validation passes, the route calls:

```ts
downloadArxivPaper.invoke(parsed.data)
```

Then it returns the tool result as JSON.

## Raw Ingest Folder

`apps/server/.ingest/raw/metadata.json` is just a list of arXiv IDs.

`apps/server/.ingest/raw/ingest.sh` reads that list with `jq`.

For each row, it posts this body to:

```text
http://localhost:2024/tools/download-arxiv-paper
```

The script stops if any request fails. It also sleeps three seconds between requests so we do not spam the local server or upstream arXiv flow.

## How LangGraph Exposes It

`apps/server/langgraph.json` has this section:

```json
{
  "http": {
    "app": "./src/api/app.ts:app"
  }
}
```

That tells the LangGraph server to import the Hono app and serve it beside the graph API.

## What To Pay Attention To

Only the download tool is exposed over HTTP here.

Finding papers and querying paper chunks still happen through the agent tool loop.
