/**
 * LangChain Agent Graph
 *
 * This module exports the main agent using LangChain's createAgent.
 * The agent is built on LangGraph and supports:
 * - Tool calling
 * - Streaming responses
 * - Middleware for customization
 * - Human-in-the-loop workflows
 */

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TOOLS } from "./tools/index.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { env } from "@skyclad_langgraph/env/server";

export const model = env.OPENAI_PROXY_BASE_URL
  ? new ChatOpenAI({
      model: "gpt-5.4-mini",
      configuration: {
        baseURL: env.OPENAI_PROXY_BASE_URL,
      },
      // OpenAI SDK requires an apiKey value even when a local OpenAI-compatible proxy
      // handles auth via prior OAuth login and does not require a bearer key.
      apiKey: env.OPENAI_API_KEY ?? "not-needed",
    })
  : env.GOOGLE_API_KEY
    ? new ChatGoogleGenerativeAI({
        model: "gemini-flash-lite-latest",
        apiKey: env.GOOGLE_API_KEY,
      })
    : (() => {
        throw new Error(
          "No model provider configured. Set OPENAI_PROXY_BASE_URL (and optional OPENAI_API_KEY) or GOOGLE_API_KEY."
        );
      })();

/**
 * The main agent instance.
 *
 * Uses createAgent from LangChain, which provides:
 * - A simpler interface for building agents
 * - Built-in middleware support for customization
 * - Automatic tool binding and execution
 * - Runs on LangGraph for durable execution
 *
 * @example
 * ```typescript
 * const result = await agent.invoke({
 *   messages: [{ role: "user", content: "What's 2 + 2?" }],
 * });
 * console.log(result.content);
 * ```
 */
export const agent = createAgent({
  model,

  // Tools available to the agent
  tools: TOOLS,

  // System prompt defining agent behavior
  systemPrompt: SYSTEM_PROMPT,

  // Optional: Add middleware for advanced customization
  // middleware: [
  //   summarizationMiddleware({
  //     model: "google-genai:gemini-flash-lite-latest",
  //     trigger: { tokens: 4000 },
  //   }),
  //   humanInTheLoopMiddleware({
  //     interruptOn: { sensitive_tool: { allowedDecisions: ["approve", "reject"] } },
  //   }),
  // ],
});
