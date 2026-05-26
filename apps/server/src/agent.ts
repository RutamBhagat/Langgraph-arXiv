import { ChatGoogle } from "@langchain/google";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";

import { env } from "@skyclad_langgraph/env/server";
import {
  globalTopKQueryArxivPaperDocs,
  namespaceTopKQueryArxivPaperDocs,
} from "./tools/ablation/queryArxivPaperDocs.js";
import { downloadArxivPaper } from "./tools/downloadArxivPaper.js";
import { TOOLS, calculator } from "./tools/index.js";
import { resolveArxivPaper } from "./tools/resolveArxivPaper.js";
import { SYSTEM_PROMPT } from "./prompts.js";

const memory = new MemorySaver();

const metadata = env.OPENAI_PROXY_BASE_URL
  ? {
      ls_provider: "openai",
      ls_model_name: "gpt-5.5",
    }
  : {
      ls_provider: "google",
      ls_model_name: "gemini-3.1-flash-lite-preview",
    };

const baseModel = env.OPENAI_PROXY_BASE_URL
  ? new ChatOpenAI({
      model: "gpt-5.5",
      configuration: {
        baseURL: env.OPENAI_PROXY_BASE_URL,
      },
      // OpenAI SDK requires an apiKey value even when a local OpenAI-compatible proxy
      apiKey: env.OPENAI_API_KEY ?? "not-needed",
    })
  : env.GOOGLE_API_KEY
    ? new ChatGoogle({
        model: "gemini-3.1-flash-lite-preview",
        apiKey: env.GOOGLE_API_KEY,
      })
    : (() => {
        throw new Error(
          "No model provider configured. Set OPENAI_PROXY_BASE_URL (and optional OPENAI_API_KEY) or GOOGLE_API_KEY.",
        );
      })();

export const model = baseModel.withConfig({ metadata });

export const agent = createAgent({
  model,
  tools: TOOLS,
  systemPrompt: SYSTEM_PROMPT,
  checkpointer: memory,
});

export const namespaceTopKAgent = createAgent({
  model,
  tools: [
    calculator,
    downloadArxivPaper,
    resolveArxivPaper,
    namespaceTopKQueryArxivPaperDocs,
  ],
  systemPrompt: SYSTEM_PROMPT,
  checkpointer: memory,
});

export const globalTopKAgent = createAgent({
  model,
  tools: [
    calculator,
    downloadArxivPaper,
    resolveArxivPaper,
    globalTopKQueryArxivPaperDocs,
  ],
  systemPrompt: SYSTEM_PROMPT,
  checkpointer: memory,
});
