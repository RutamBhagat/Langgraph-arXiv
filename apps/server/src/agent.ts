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
import { ChatGoogle } from "@langchain/google";
import { TOOLS } from "./tools/index.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { env } from "@skyclad_langgraph/env/server";

export const model = env.OPENAI_PROXY_BASE_URL
  ? new ChatOpenAI({
      model: "gpt-5.5",
      configuration: {
        baseURL: env.OPENAI_PROXY_BASE_URL,
      },
      // OpenAI SDK requires an apiKey value even when a local OpenAI-compatible proxy
      // handles auth via prior OAuth login and does not require a bearer key.
      apiKey: env.OPENAI_API_KEY ?? "not-needed",
      metadata: {
        ls_provider: "openai",
        ls_model_name: "gpt-5.5",
      },
    })
  : env.GOOGLE_API_KEY
    ? new ChatGoogle({
        model: "gemini-3.1-flash-lite-preview",
        // model: "gemini-2.5-flash-lite",
        apiKey: env.GOOGLE_API_KEY,
      }).withConfig({
        metadata: {
          ls_provider: "google",
          ls_model_name: "gemini-3.1-flash-lite-preview",
          // ls_model_name: "gemini-2.5-flash-lite",
        },
      })
    : (() => {
        throw new Error(
          "No model provider configured. Set OPENAI_PROXY_BASE_URL (and optional OPENAI_API_KEY) or GOOGLE_API_KEY.",
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
  //     model: "google-genai:gemini-3.1-flash-lite",
  //     trigger: { tokens: 3000 },
  //   }),
  //   humanInTheLoopMiddleware({
  //     interruptOn: { sensitive_tool: { allowedDecisions: ["approve", "reject"] } },
  //   }),
  // ],
});
