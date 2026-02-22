import { Hono } from "hono";

import type { Env } from "../app";
import { userApiKeys } from "../db/schema";

export const userApiKeyRoutes = () =>
  new Hono<Env>().post("/", async (c) => {
    const db = c.var.db;
    const userId = c.get("userId");

    const key = `kan_${crypto.randomUUID().replace(/-/g, "")}`;

    const [result] = await db
      .insert(userApiKeys)
      .values({ userId, key })
      .returning({ key: userApiKeys.key });

    return c.json({ key: result.key }, 201);
  });
