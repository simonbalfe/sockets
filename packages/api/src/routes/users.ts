import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";

import type { Env } from "../app";
import * as userRepo from "../db/repository/user.repo";

export const userRouter = new Hono<Env>()
	.basePath("/users")
	.get(
		"/me",
		describeRoute({
			tags: ["Users"],
			summary: "Get current user",
			description: "Get the authenticated user's profile",
			responses: {
				200: { description: "User profile" },
				404: { description: "User not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");

			const result = await userRepo.getById(db, userId);
			if (!result) {
				return c.json({ error: "User not found" }, 404);
			}

			return c.json(result);
		},
	)
	.put(
		"/",
		describeRoute({
			tags: ["Users"],
			summary: "Update user",
			description: "Update the authenticated user's name or image",
			responses: {
				200: { description: "Updated user" },
				404: { description: "User not found" },
			},
		}),
		zValidator(
			"json",
			z
				.object({
					name: z.string().optional(),
					image: z.string().optional(),
				})
				.refine((data) => Object.keys(data).length >= 1, {
					message: "At least one field must be provided",
				}),
		),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const result = await userRepo.update(db, userId, body);
			if (!result) {
				return c.json({ error: "User not found" }, 404);
			}

			return c.json(result);
		},
	);
