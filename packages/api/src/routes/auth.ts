import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { auth } from "../auth";

export const authRouter = new Hono()
	.get(
		"/auth/**",
		describeRoute({
			tags: ["Auth"],
			summary: "Auth GET handler",
			description: "Handles authentication GET requests",
			responses: { 200: { description: "Auth response" } },
		}),
		(c) => auth.handler(c.req.raw),
	)
	.post(
		"/auth/**",
		describeRoute({
			tags: ["Auth"],
			summary: "Auth POST handler",
			description: "Handles authentication POST requests",
			responses: { 200: { description: "Auth response" } },
		}),
		(c) => auth.handler(c.req.raw),
	);
