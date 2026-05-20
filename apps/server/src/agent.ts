import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";
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
      apiKey: env.OPENAI_API_KEY ?? "not-needed",
      metadata: {
        ls_provider: "openai",
        ls_model_name: "gpt-5.4-mini",
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

export const agent = createAgent({
  model,
  tools: TOOLS,
  systemPrompt: SYSTEM_PROMPT,
});
