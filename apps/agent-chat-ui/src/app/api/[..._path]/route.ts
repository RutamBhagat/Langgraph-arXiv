import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
import { env } from "@skyclad_langgraph/env/server";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: env.LANGGRAPH_API_URL,
    apiKey: env.LANGSMITH_API_KEY,
    runtime: "edge", // default
  });
