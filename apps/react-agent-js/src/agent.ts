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
import { TOOLS } from "./tools.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { env } from "@skyclad_langgraph/env/server";

if (!env.GOOGLE_API_KEY) {
  throw new Error("Missing GOOGLE_API_KEY");
}

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
  // The model to use - supports "provider:model" format
  // Uses GOOGLE_API_KEY from environment
  model: "google_genai:gemini-2.5-flash",

  // Tools available to the agent
  tools: TOOLS,

  // System prompt defining agent behavior
  systemPrompt: SYSTEM_PROMPT,

  // Optional: Add middleware for advanced customization
  // middleware: [
  //   summarizationMiddleware({
  //     model: "google_genai:gemini-2.5-flash",
  //     trigger: { tokens: 4000 },
  //   }),
  //   humanInTheLoopMiddleware({
  //     interruptOn: { sensitive_tool: { allowedDecisions: ["approve", "reject"] } },
  //   }),
  // ],
});
