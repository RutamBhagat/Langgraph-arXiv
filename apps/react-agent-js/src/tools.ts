/**
 * Tools for the LangChain agent.
 *
 * Define your agent's tools here using the `tool` function from langchain.
 * Each tool should have a clear name, description, and schema to help
 * the model understand when and how to use it.
 */

import { tool } from "langchain";
import { ArxivRetriever } from "@langchain/community/retrievers/arxiv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nerdamer from "nerdamer-prime";
import { z } from "zod";

/**
 * A symbolic math evaluation tool (SymPy-like) for expression evaluation.
 */
export const calculator = tool(
  async ({ expression }) => {
    try {
      const result = nerdamer(expression).evaluate();
      return `${expression} = ${result.text()}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error evaluating expression: ${message}`;
    }
  },
  {
    name: "calculator",
    description:
      "Evaluate mathematical expressions using symbolic math syntax (e.g. '2+2', 'sin(pi/2)', 'x^2+2*x+1' with substitutions inline).",
    schema: z.object({
      expression: z
        .string()
        .min(1)
        .describe("A mathematical expression to evaluate"),
    }),
  },
);

/**
 * A tool that can search through a knowledge base.
 * This is a placeholder - replace with actual search functionality.
 */
export const searchKnowledge = tool(
  async ({ query, maxResults }) => {
    // Simulated search results - in production, connect to a vector store or search API
    const results = [
      {
        title: "Introduction to AI Agents",
        snippet:
          "AI agents are autonomous systems that can perceive, reason, and act...",
      },
      {
        title: "Building with LangChain",
        snippet:
          "LangChain provides tools and abstractions for building LLM applications...",
      },
      {
        title: "Tool Calling in LLMs",
        snippet:
          "Modern LLMs can use tools to extend their capabilities beyond text generation...",
      },
    ];

    const limitedResults = results.slice(0, maxResults);
    return `Found ${limitedResults.length} results for "${query}":\n\n${limitedResults
      .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}`)
      .join("\n\n")}`;
  },
  {
    name: "search_knowledge",
    description:
      "Search through the knowledge base for relevant information. Use this when the user asks questions that may require looking up information.",
    schema: z.object({
      query: z.string().describe("The search query to look for"),
      maxResults: z
        .number()
        .min(1)
        .max(10)
        .default(3)
        .describe("Maximum number of results to return"),
    }),
  },
);

export const downloadArxivPaper = tool(
  async ({ arxivId }) => {
    try {
      const retriever = new ArxivRetriever({
        getFullDocuments: true,
        maxSearchResults: 1,
      });
      const documents = await retriever.invoke(arxivId);

      if (documents.length === 0) {
        return `No arXiv paper found for id: ${arxivId}`;
      }

      const outputDir = path.resolve(process.cwd(), "downloads", "arxiv");
      await mkdir(outputDir, { recursive: true });

      const normalizedId = arxivId.trim();
      const safeFileId = normalizedId.replaceAll("/", "_");
      const filePath = path.join(outputDir, `${safeFileId}.json`);
      const payload = documents.map((doc) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }));
      await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

      return `Saved retriever output for ${normalizedId} to ${filePath}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error saving arXiv retriever output: ${message}`;
    }
  },
  {
    name: "download_arxiv_paper",
    description:
      "Fetch an arXiv paper by ID using LangChain's arXiv retriever and save the retriever output locally.",
    schema: z.object({
      arxivId: z
        .string()
        .min(1)
        .describe("The arXiv ID, e.g. '1706.03762' or '2401.12345'"),
    }),
  },
);

/**
 * All tools available to the agent.
 * Add or remove tools here to customize your agent's capabilities.
 */
export const TOOLS = [calculator, searchKnowledge, downloadArxivPaper];
