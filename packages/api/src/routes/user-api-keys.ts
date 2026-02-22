import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import type { Env } from "../app";
import { userApiKeys } from "../db/schema";

export const userApiKeyRouter = new Hono<Env>()
	.basePath("/user-api-keys")
	.post(
		"/",
		describeRoute({
			tags: ["API Keys"],
			summary: "Generate API key",
			description: "Generate a new API key for the authenticated user",
			responses: {
				201: { description: "Generated API key" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");

			const key = `kan_${crypto.randomUUID().replace(/-/g, "")}`;

			const [result] = await db
				.insert(userApiKeys)
				.values({ userId, key })
				.returning({ key: userApiKeys.key });

			if (!result) {
				return c.json({ error: "Failed to generate API key" }, 500);
			}

			return c.json({ key: result.key }, 201);
		},
	);
