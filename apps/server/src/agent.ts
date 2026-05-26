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

export const TIMEOUT_MS = 180_000;

export const model = new ChatOpenAI({
  model: "gpt-5.4-mini",
  timeout: TIMEOUT_MS,
  maxRetries: 0,
  ...(env.OPENAI_PROXY_BASE_URL
    ? { configuration: { baseURL: env.OPENAI_PROXY_BASE_URL } }
    : {}),
  apiKey: env.OPENAI_API_KEY ?? "not-needed",
});

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
