import { env } from "@skyclad_langgraph/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();
export { eq, sql, cosineDistance, desc } from "drizzle-orm";
