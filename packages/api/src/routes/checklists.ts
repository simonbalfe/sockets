import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";

import { z } from "zod";

import type { Env } from "../app";
import * as cardRepo from "../db/repository/card.repo";
import * as checklistRepo from "../db/repository/checklist.repo";

const createChecklistSchema = z.object({
	cardPublicId: z.string(),
	name: z.string().min(1).max(255),
});

const updateChecklistSchema = z.object({
	name: z.string().min(1).max(255),
});

const createChecklistItemSchema = z.object({
	title: z.string().min(1).max(500),
});

const updateChecklistItemSchema = z
	.object({
		title: z.string().optional(),
		completed: z.boolean().optional(),
		index: z.number().optional(),
	})
	.refine((data) => Object.keys(data).length >= 1, {
		message: "At least one field must be provided",
	});

export const checklistRouter = new Hono<Env>()
	.basePath("/checklists")
	.post(
		"/",
		describeRoute({
			tags: ["Checklists"],
			summary: "Create checklist",
			description: "Create a new checklist on a card",
			responses: {
				200: { description: "Created checklist" },
				404: { description: "Card not found" },
				500: { description: "Failed to create checklist" },
			},
		}),
		validator("json", createChecklistSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const card = await cardRepo.getCardIdByPublicId(db, body.cardPublicId);
			if (!card) {
				return c.json({ error: "Card not found" }, 404);
			}

			const result = await checklistRepo.create(db, {
				name: body.name,
				createdBy: userId,
				cardId: card.id,
			});

			if (!result?.id) {
				return c.json({ error: "Failed to create checklist" }, 500);
			}

			return c.json(result);
		},
	)

	.put(
		"/:checklistPublicId",
		describeRoute({
			tags: ["Checklists"],
			summary: "Update checklist",
			description: "Update checklist name",
			responses: {
				200: { description: "Updated checklist" },
				404: { description: "Checklist not found" },
				500: { description: "Failed to update checklist" },
			},
		}),
		validator("json", updateChecklistSchema),
		async (c) => {
			const db = c.var.db;
			const checklistPublicId = c.req.param("checklistPublicId");
			const body = c.req.valid("json");

			const checklist = await checklistRepo.getChecklistByPublicId(
				db,
				checklistPublicId,
			);
			if (!checklist) {
				return c.json({ error: "Checklist not found" }, 404);
			}

			const updated = await checklistRepo.updateChecklistById(db, {
				id: checklist.id,
				name: body.name,
			});

			if (!updated) {
				return c.json({ error: "Failed to update checklist" }, 500);
			}

			return c.json(updated);
		},
	)

	.delete(
		"/:checklistPublicId",
		describeRoute({
			tags: ["Checklists"],
			summary: "Delete checklist",
			description: "Soft delete a checklist and all its items",
			responses: {
				200: { description: "Checklist deleted" },
				404: { description: "Checklist not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const checklistPublicId = c.req.param("checklistPublicId");

			const checklist = await checklistRepo.getChecklistByPublicId(
				db,
				checklistPublicId,
			);
			if (!checklist) {
				return c.json({ error: "Checklist not found" }, 404);
			}

			await checklistRepo.softDeleteAllItemsByChecklistId(db, {
				checklistId: checklist.id,
				deletedAt: new Date(),
				deletedBy: userId,
			});

			await checklistRepo.softDeleteById(db, {
				id: checklist.id,
				deletedAt: new Date(),
				deletedBy: userId,
			});

			return c.json({ success: true });
		},
	)

	.post(
		"/:checklistPublicId/items",
		describeRoute({
			tags: ["Checklists"],
			summary: "Create checklist item",
			description: "Add an item to a checklist",
			responses: {
				200: { description: "Created checklist item" },
				404: { description: "Checklist not found" },
				500: { description: "Failed to create checklist item" },
			},
		}),
		validator("json", createChecklistItemSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const checklistPublicId = c.req.param("checklistPublicId");
			const body = c.req.valid("json");

			const checklist = await checklistRepo.getChecklistByPublicId(
				db,
				checklistPublicId,
			);
			if (!checklist) {
				return c.json({ error: "Checklist not found" }, 404);
			}

			const result = await checklistRepo.createItem(db, {
				title: body.title,
				createdBy: userId,
				checklistId: checklist.id,
			});

			if (!result?.id) {
				return c.json({ error: "Failed to create checklist item" }, 500);
			}

			return c.json(result);
		},
	)

	.patch(
		"/items/:checklistItemPublicId",
		describeRoute({
			tags: ["Checklists"],
			summary: "Update checklist item",
			description: "Update checklist item title, completion status, or position",
			responses: {
				200: { description: "Updated checklist item" },
				404: { description: "Checklist item not found" },
				500: { description: "Failed to update checklist item" },
			},
		}),
		validator("json", updateChecklistItemSchema),
		async (c) => {
			const db = c.var.db;
			const checklistItemPublicId = c.req.param("checklistItemPublicId");
			const body = c.req.valid("json");

			const item =
				await checklistRepo.getChecklistItemByPublicIdWithChecklist(
					db,
					checklistItemPublicId,
				);
			if (!item) {
				return c.json({ error: "Checklist item not found" }, 404);
			}

			let updatedItem:
				| Awaited<ReturnType<typeof checklistRepo.updateItemById>>
				| Awaited<ReturnType<typeof checklistRepo.reorderItem>>
				| null = null;

			if (body.title !== undefined || body.completed !== undefined) {
				updatedItem = await checklistRepo.updateItemById(db, {
					id: item.id,
					title: body.title,
					completed: body.completed,
				});
			}

			if (body.index !== undefined) {
				updatedItem = await checklistRepo.reorderItem(db, {
					itemId: item.id,
					newIndex: body.index,
				});
			}

			if (!updatedItem) {
				return c.json({ error: "Failed to update checklist item" }, 500);
			}

			return c.json(updatedItem);
		},
	)

	.delete(
		"/items/:checklistItemPublicId",
		describeRoute({
			tags: ["Checklists"],
			summary: "Delete checklist item",
			description: "Soft delete a checklist item",
			responses: {
				200: { description: "Checklist item deleted" },
				404: { description: "Checklist item not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const checklistItemPublicId = c.req.param("checklistItemPublicId");

			const item = await checklistRepo.getChecklistItemByPublicIdWithChecklist(
				db,
				checklistItemPublicId,
			);
			if (!item) {
				return c.json({ error: "Checklist item not found" }, 404);
			}

			await checklistRepo.softDeleteItemById(db, {
				id: item.id,
				deletedAt: new Date(),
				deletedBy: userId,
			});

			return c.json({ success: true });
		},
	);
