import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import type { Env } from "../app";
import { userApiKeys } from "../db/schema";

export const userApiKeyRouter = new Hono<Env>()
	.basePath("/user-api-keys")
	.get(
		"/",
		describeRoute({
			tags: ["API Keys"],
			summary: "List API keys",
			description: "List API keys for the authenticated user",
			responses: {
				200: { description: "List of API keys" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");

			const keys = await db
				.select({
					id: userApiKeys.id,
					key: userApiKeys.key,
					createdAt: userApiKeys.createdAt,
				})
				.from(userApiKeys)
				.where(eq(userApiKeys.userId, userId));

			return c.json(
				keys.map((k) => ({
					id: k.id,
					key: `${k.key.slice(0, 10)}${"•".repeat(20)}`,
					createdAt: k.createdAt,
				})),
			);
		},
	)
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
	)
	.delete(
		"/:id",
		describeRoute({
			tags: ["API Keys"],
			summary: "Revoke API key",
			description: "Revoke an API key by ID",
			responses: {
				200: { description: "Key revoked" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const id = c.req.param("id");

			await db
				.delete(userApiKeys)
				.where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, userId)));

			return c.json({ success: true });
		},
	);
