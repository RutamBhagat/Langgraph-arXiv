import { tool } from "langchain";
import nerdamer from "nerdamer-prime";
import { z } from "zod";
import { downloadArxivPaper } from "./downloadArxivPaper.js";
import { resolveArxivPaper } from "./resolveArxivPaper.js";
import { queryArxivPaperDocs } from "./queryArxivPaperDocs.js";

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

export const TOOLS = [
  calculator,
  downloadArxivPaper,
  resolveArxivPaper,
  queryArxivPaperDocs,
];
