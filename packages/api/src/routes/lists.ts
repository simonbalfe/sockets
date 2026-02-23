import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";

import { z } from "zod";

import type { Env } from "../app";
import * as boardRepo from "../db/repository/board.repo";
import * as cardRepo from "../db/repository/card.repo";
import * as listRepo from "../db/repository/list.repo";

const createListSchema = z.object({
	name: z.string().min(1),
	boardPublicId: z.string(),
});

const updateListSchema = z
	.object({
		name: z.string().optional(),
		index: z.number().optional(),
	})
	.refine((data) => Object.keys(data).length >= 1, {
		message: "At least one field must be provided",
	});

export const listRouter = new Hono<Env>()
	.basePath("/lists")
	.post(
		"/",
		describeRoute({
			tags: ["Lists"],
			summary: "Create list",
			description: "Create a new list in a board",
			responses: {
				200: { description: "Created list" },
				404: { description: "Board not found" },
				500: { description: "Failed to create list" },
			},
		}),
		validator("json", createListSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const board = await boardRepo.getBoardIdByPublicId(
				db,
				body.boardPublicId,
			);
			if (!board) {
				return c.json({ error: "Board not found" }, 404);
			}

			const result = await listRepo.create(db, {
				name: body.name,
				createdBy: userId,
				boardId: board.id,
			});

			if (!result) {
				return c.json({ error: "Failed to create list" }, 500);
			}

			return c.json(result);
		},
	)

	.put(
		"/:listPublicId",
		describeRoute({
			tags: ["Lists"],
			summary: "Update list",
			description: "Update list name or reorder it",
			responses: {
				200: { description: "Updated list" },
				404: { description: "List not found" },
				500: { description: "Failed to update list" },
			},
		}),
		validator("json", updateListSchema),
		async (c) => {
			const db = c.var.db;
			const listPublicId = c.req.param("listPublicId");
			const body = c.req.valid("json");

			const list = await listRepo.getListIdByPublicId(db, listPublicId);
			if (!list) {
				return c.json({ error: "List not found" }, 404);
			}

			let result:
				| Awaited<ReturnType<typeof listRepo.update>>
				| Awaited<ReturnType<typeof listRepo.reorder>>
				| null = null;

			if (body.name !== undefined) {
				result = await listRepo.update(db, { name: body.name }, { listPublicId });
			}

			if (body.index !== undefined) {
				result = await listRepo.reorder(db, {
					listPublicId,
					newIndex: body.index,
				});
			}

			if (!result) {
				return c.json({ error: "Failed to update list" }, 500);
			}

			return c.json(result);
		},
	)

	.delete(
		"/:listPublicId",
		describeRoute({
			tags: ["Lists"],
			summary: "Delete list",
			description: "Soft delete a list and all its cards",
			responses: {
				200: { description: "List deleted" },
				404: { description: "List not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const listPublicId = c.req.param("listPublicId");

			const list = await listRepo.getListIdByPublicId(db, listPublicId);
			if (!list) {
				return c.json({ error: "List not found" }, 404);
			}

			const deletedAt = new Date();

			await listRepo.softDeleteById(db, {
				listId: list.id,
				deletedAt,
				deletedBy: userId,
			});

			await cardRepo.softDeleteAllByListIds(db, {
				listIds: [list.id],
				deletedAt,
				deletedBy: userId,
			});

			return c.json({ success: true });
		},
	);
