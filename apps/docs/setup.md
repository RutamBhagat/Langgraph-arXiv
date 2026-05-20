prerequisites
- pnpm
- google api key
- langsmith api key
- docker

1. Clone the repo
```bash
git clone git@github.com:RutamBhagat/skyclad_langgraph.git
cd skyclad_langgraph
```

2. Open it in your ide
3. Install dependencies
```bash
pnpm i
```

4. DB setup
```bash
pnpm run db:start
pnpm run db:migrate
pnpm run db:studio
# Allow it to connect to your localhost if on chrome
```

5. Local Embeddings Setup (optional)
```bash
# If you want local embeddings and want to use your codex cli subscription for api calls
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3-embedding:8b
ollama ps
# make sure you have a strong gpu, otherwise this will run on cpu and will be slow
# change env vars in `apps/server/.env`
# EMBEDDINGS_MODEL=gemini-embedding-2
EMBEDDINGS_MODEL=qwen3-embedding:8b
```

6. Local Openai Oauth Reverse Proxy Setup (optional)
```bash
bunx @openai/codex login
# Login the browser
bunx openai-oauth
# Proxy will start on http://127.0.0.1:10531/v1
# change env vars in `apps/server/.env`
OPENAI_API_KEY=""
OPENAI_PROXY_BASE_URL=http://127.0.0.1:10531/v1
# GOOGLE_API_KEY="xxx"

# NOTE: you will not be able to track usage costs in evals if you use the proxy instead of api key
```

If you do not want the local setup then GOOGLE_API_KEY is enough (free tier has rate limits for embeddings, api calls and evals)

7. Ingestion
```bash
cd apps/server/.ingest/raw
chmod +x ingest.sh && ./ingest.sh
# Let the ingestion run to completion, it is deliberately sleeping for 3 seconds in between each ingestion in order to prevent rate limiting from arXiv
# If you see `"Error retrieving documents from arXiv.` That means you are rate limited by arXiv, wait for a while and try again
```

8. Langsmith setup
```bash
# change env vars in `apps/server/.env`
# fill your api key for langsmith from your dashboard https://smith.langchain.com/o/xxx/settings/apikeys
LANGSMITH_API_KEY=xxx
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=skyclad-langsmith
# create the project in langsmith dashboard if it doesn't exist
```

9. Langsmith setup
```bash
pnpm run dev
# Note if you are not already logged in to langsmith, a popup will open up in your browser to login to langsmith
# Allow it to connect to your localhost if on chrome
# Langchain studio graph interface should open up after logging in
# Switch to chat interface
# Toggle show tool calls
```

10. Manual UI test
- You can test the ui manually by asking questions from `apps/server/src/evals/eval.json` or any other questions you can come up with


11. Evals - LLM as a judge Evaluator
```bash
pnpm run eval
# Open the link in your browser to view the eval results
# Let the eval finish running
# After the eval is finished running it will grade the llm's responses
# If you have selected the openai proxy, you will not be able to track usage costs and token consumption in the evals 
# but it will still evaluate the responses
```
