import { Hono } from "hono";
import { logger } from "hono/logger";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import type { dbClient } from "./db/client";
import { createDb } from "./db/client";
import { authRouter } from "./routes/auth";
import { boardRouter } from "./routes/boards";
import { cardRouter } from "./routes/cards";
import { checklistRouter } from "./routes/checklists";
import { healthRouter } from "./routes/health";
import { knowledgeItemRouter } from "./routes/knowledge-items";
import { labelRouter } from "./routes/labels";
import { listRouter } from "./routes/lists";
import { userApiKeyRouter } from "./routes/user-api-keys";
import { userRouter } from "./routes/users";

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
		c.set("db", db);
		c.set("userId", "28daa3f5-8e58-4cf4-973b-494cec5aabc1");
		await next();
	})
	.onError((err, c) => {
		console.error(`[API] ${c.req.method} ${c.req.path} ERROR:`, err);
		return c.json({ error: "Internal server error" }, 500);
	});

const appRouter = app
	.route("/", healthRouter)
	.route("/", authRouter)
	.route("/", boardRouter)
	.route("/", cardRouter)
	.route("/", checklistRouter)
	.route("/", knowledgeItemRouter)
	.route("/", labelRouter)
	.route("/", listRouter)
	.route("/", userApiKeyRouter)
	.route("/", userRouter);

interface OpenAPISchema {
	paths?: Record<string, unknown>;
	components?: {
		schemas?: Record<string, unknown>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

app.get("/app-openapi", async (c) => {
	const handler = openAPIRouteHandler(app, {
		documentation: {
			info: {
				title: "Kan API",
				version: "1.0.0",
			},
			servers: [
				{
					url: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
					description: "API server",
				},
			],
		},
	});
	return await handler(c, async () => {});
});

app.get("/openapi", async (c) => {
	const schema = (await (
		app.request("/api/app-openapi") as Promise<Response>
	).then((res) => res.json())) as OpenAPISchema;
	return c.json(schema);
});

app.get(
	"/docs",
	Scalar({
		theme: "saturn",
		url: "/api/openapi",
	}),
);

export type AppRouter = typeof appRouter;
