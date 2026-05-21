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
          title: papers.title,
          similarity,
        })
        .from(papers)
        .orderBy((table) => desc(table.similarity))
        .limit(3);

      if (candidates.length === 0) {
        return { status: "not_found" };
      }

      return { status: "candidates", candidates };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return `Error resolving arXiv paper: ${message}`;
    }
  },
  {
    name: "resolve_arxiv_paper",
    description:
      "Find candidate ingested arXiv papers for a paper title, arXiv ID, or bibliographic identifier. The returned candidates are nearest neighbors, not proof that the requested paper exists in the corpus. If the user explicitly names a paper, pass only that paper title or arXiv ID, not the full substantive question. Include broader topical query text only when no title or identifier is available.",
    schema: z.object({
      query: z
        .string()
        .min(1)
        .describe("Search query used to resolve the target arXiv paper"),
    }),
  },
);
