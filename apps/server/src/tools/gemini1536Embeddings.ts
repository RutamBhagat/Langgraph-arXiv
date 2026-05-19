import { GoogleGenAI } from "@google/genai";
import { Embeddings } from "@langchain/core/embeddings";

export class Gemini1536Embeddings extends Embeddings {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor({
    apiKey,
    model = "gemini-embedding-2",
  }: {
    apiKey: string;
    model?: string;
  }) {
    super({});
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await this.ai.models.embedContent({
      model: this.model,
      contents: text,
      config: {
        outputDimensionality: 1536,
      },
    });

    const values = response.embeddings?.[0]?.values;
    if (!values) {
      throw new Error("No embedding returned from Gemini.");
    }

    return values;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}
