import { Hono } from "hono";
import { logger } from "hono/logger";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { auth } from "./auth";

import type { dbClient } from "./db/client";
import { createDb } from "./db/client";
import { boardRouter } from "./routes/boards";
import { cardRouter } from "./routes/cards";
import { checklistRouter } from "./routes/checklists";
import { healthRouter } from "./routes/health";
import { resourceItemRouter } from "./routes/resource-items";
import { labelRouter } from "./routes/labels";
import { listRouter } from "./routes/lists";
import { userApiKeyRouter } from "./routes/user-api-keys";
import { uploadRouter } from "./routes/uploads";
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
	.use("/auth/*", (c) => auth.handler(c.req.raw))
	.use(async (c, next) => {
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
	.route("/", boardRouter)
	.route("/", cardRouter)
	.route("/", checklistRouter)
	.route("/", resourceItemRouter)
	.route("/", labelRouter)
	.route("/", listRouter)
	.route("/", uploadRouter)
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
				title: "Sockets API",
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
	const [appSchema, authSchema] = await Promise.all([
		(app.request("/api/app-openapi") as Promise<Response>).then((res) =>
			res.json(),
		) as Promise<OpenAPISchema>,
		auth.api.generateOpenAPISchema(),
	]);

	return c.json({
		...appSchema,
		paths: { ...appSchema.paths, ...(authSchema as OpenAPISchema).paths },
		components: {
			...appSchema.components,
			schemas: {
				...appSchema.components?.schemas,
				...((authSchema as OpenAPISchema).components?.schemas ?? {}),
			},
		},
	});
});

app.get("/docs", Scalar({ theme: "saturn", url: "/api/openapi" }));

export type AppRouter = typeof appRouter;
