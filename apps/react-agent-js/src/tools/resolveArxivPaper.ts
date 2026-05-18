import { db, sql, cosineDistance, desc } from "@skyclad_langgraph/db";
import { papers } from "@skyclad_langgraph/db/schema/index";
import { tool } from "langchain";
import { z } from "zod";
import { embeddings } from "./arxivShared.js";

export const resolveArxivPaper = tool(
  async ({ query }) => {
    try {
      const queryEmbedding = await embeddings.embedQuery(query);
      const similarity = sql<number>`1 - (${cosineDistance(papers.summaryEmbedding, queryEmbedding)})`;
      const candidates = await db
        .select({
          paperId: papers.id,
          arxivId: papers.arxivId,
          title: papers.title,
          similarity,
        })
        .from(papers)
        .orderBy((table) => desc(table.similarity))
        .limit(1);

      if (candidates.length === 0) {
        return { status: "not_found" };
      }

      return { status: "resolved", ...candidates[0] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error resolving arXiv paper: ${message}`;
    }
  },
  {
    name: "resolve_arxiv_paper",
    description:
      "Resolve a question/query to the single most relevant ingested arXiv paper and return its paperId handle.",
    schema: z.object({
      query: z
        .string()
        .min(1)
        .describe("Search query used to resolve the target arXiv paper"),
    }),
  },
);
