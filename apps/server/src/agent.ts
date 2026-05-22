import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";
import { SystemMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  END,
  START,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { TOOLS } from "./tools/index.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { env } from "@skyclad_langgraph/env/server";

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

export type AgentTool = StructuredToolInterface;

const shouldContinue = (state: typeof MessagesAnnotation.State) => {
  const lastMessage = state.messages.at(-1);

  if (
    lastMessage &&
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }

  return END;
};

export function createAgentGraph(tools: AgentTool[]) {
  const modelWithTools = baseModel.bindTools(tools).withConfig({ metadata });

  const callModel = async (state: typeof MessagesAnnotation.State) => {
    const response = await modelWithTools.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      ...state.messages,
    ]);

    return {
      messages: [response],
    };
  };

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(tools))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent")
    .compile({ checkpointer: memory });
}

export const agent = createAgentGraph(TOOLS);
