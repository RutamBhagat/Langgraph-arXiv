import { Hono } from "hono";
import { downloadArxivPaper } from "../tools/downloadArxivPaper.js";

const requestSchema = {
  type: "object",
  properties: {
    arxivId: { type: "string", minLength: 1 },
  },
  required: ["arxivId"],
};

export const app = new Hono();

app.post("/tools/download-arxiv-paper", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        error: "Invalid JSON body",
      },
      400,
    );
  }

  const parsed = downloadArxivPaper.schema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid request body",
        schema: requestSchema,
        issues: parsed.error.issues,
      },
      400,
    );
  }

  const result = await downloadArxivPaper.invoke(parsed.data);
  return c.json(result);
});
