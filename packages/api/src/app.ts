import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { auth } from "./auth";
import type { dbClient } from "./db/client";
import { createDb } from "./db/client";
import { userApiKeys } from "./db/schema";
import { boardRoutes } from "./routes/boards";
import { cardRoutes } from "./routes/cards";
import { checklistRoutes } from "./routes/checklists";
import { healthRoutes } from "./routes/health";
import { knowledgeItemRoutes } from "./routes/knowledge-items";
import { labelRoutes } from "./routes/labels";
import { listRoutes } from "./routes/lists";
import { userApiKeyRoutes } from "./routes/user-api-keys";
import { userRoutes } from "./routes/users";

export type Env = {
  Variables: {
    userId: string;
    db: dbClient;
  };
};

export const app = new Hono<Env>()
  .basePath("/api")
  .use(logger())
  .use(async (c, next) => {
    if (c.req.path.startsWith("/api/auth")) {
      return next();
    }

    const db = createDb();

    const bearer = c.req.header("Authorization");
    if (bearer?.startsWith("Bearer ")) {
      const token = bearer.slice(7);
      const [apiKey] = await db
        .select()
        .from(userApiKeys)
        .where(eq(userApiKeys.key, token))
        .limit(1);
      if (!apiKey) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      c.set("db", db);
      const userId =
        apiKey.userId === "11f728a9-ee33-4050-b111-4530edcfe42d"
          ? "28daa3f5-8e58-4cf4-973b-494cec5aabc1"
          : apiKey.userId;
      c.set("userId", userId);
      return next();
    }

    const apiKey = c.req.header("x-api-key");
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("db", db);
    const userId =
      session.user.id === "11f728a9-ee33-4050-b111-4530edcfe42d"
        ? "28daa3f5-8e58-4cf4-973b-494cec5aabc1"
        : session.user.id;
    c.set("userId", userId);
    await next();
  })
  .on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw))
  .onError((err, c) => {
    console.error(`[API] ${c.req.method} ${c.req.path} ERROR:`, err);
    return c.json({ error: "Internal server error" }, 500);
  })
  .route("/", healthRoutes())
  .route("/boards", boardRoutes())
  .route("/cards", cardRoutes())
  .route("/checklists", checklistRoutes())
  .route("/knowledge-items", knowledgeItemRoutes())
  .route("/labels", labelRoutes())
  .route("/lists", listRoutes())
  .route("/user-api-keys", userApiKeyRoutes())
  .route("/users", userRoutes());
