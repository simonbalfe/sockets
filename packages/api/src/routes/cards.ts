import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";

import { z } from "zod";

import type { Env } from "../app";
import * as cardRepo from "../db/repository/card.repo";
import * as labelRepo from "../db/repository/label.repo";
import * as listRepo from "../db/repository/list.repo";
import { movePositionSchema } from "../lib/schemas";

const createCardSchema = z.object({
	title: z.string().min(1).max(2000),
	description: z.string().max(10000),
	listPublicId: z.string(),
	labelPublicIds: z.array(z.string()).optional(),
	position: movePositionSchema,
	dueDate: z.string().nullable().optional(),
});

const updateCardSchema = z
	.object({
		title: z.string().optional(),
		description: z.string().optional(),
		index: z.number().optional(),
		listPublicId: z.string().optional(),
		dueDate: z.string().nullable().optional(),
	})
	.refine((data) => Object.keys(data).length >= 1, {
		message: "At least one field must be provided",
	});

export const cardRouter = new Hono<Env>()
	.basePath("/cards")
	.post(
		"/",
		describeRoute({
			tags: ["Cards"],
			summary: "Create card",
			description: "Create a new card in a list",
			responses: {
				200: { description: "Created card" },
				404: { description: "List not found" },
				500: { description: "Failed to create card" },
			},
		}),
		validator("json", createCardSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const list = await listRepo.getListIdByPublicId(db, body.listPublicId);
			if (!list) {
				return c.json({ error: "List not found" }, 404);
			}

			const newCard = await cardRepo.create(db, {
				title: body.title,
				description: body.description,
				createdBy: userId,
				listId: list.id,
				position: body.position,
				dueDate: body.dueDate ? new Date(body.dueDate) : null,
			});

			if (!newCard?.id) {
				return c.json({ error: "Failed to create card" }, 500);
			}

			if (body.labelPublicIds?.length) {
				const labels = await labelRepo.getAllByPublicIds(
					db,
					body.labelPublicIds,
				);
				if (labels.length) {
					await cardRepo.bulkCreateCardLabelRelationships(
						db,
						labels.map((label) => ({
							cardId: newCard.id,
							labelId: label.id,
						})),
					);
				}
			}

			return c.json(newCard);
		},
	)

	.get(
		"/:cardPublicId",
		describeRoute({
			tags: ["Cards"],
			summary: "Get card",
			description: "Get a card by its public ID",
			responses: {
				200: { description: "Card details" },
				404: { description: "Card not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const cardPublicId = c.req.param("cardPublicId");

			const card = await cardRepo.getCardIdByPublicId(db, cardPublicId);
			if (!card) {
				return c.json({ error: "Card not found" }, 404);
			}

			const result = await cardRepo.getWithListAndMembersByPublicId(
				db,
				cardPublicId,
			);
			if (!result) {
				return c.json({ error: "Card not found" }, 404);
			}

			return c.json(result);
		},
	)

	.put(
		"/:cardPublicId",
		describeRoute({
			tags: ["Cards"],
			summary: "Update card",
			description: "Update card title, description, due date, or position",
			responses: {
				200: { description: "Updated card" },
				404: { description: "Card or list not found" },
				500: { description: "Failed to update card" },
			},
		}),
		validator("json", updateCardSchema),
		async (c) => {
			const db = c.var.db;
			const cardPublicId = c.req.param("cardPublicId");
			const body = c.req.valid("json");

			const card = await cardRepo.getCardIdByPublicId(db, cardPublicId);
			if (!card) {
				return c.json({ error: "Card not found" }, 404);
			}

			const existingCard = await cardRepo.getByPublicId(db, cardPublicId);
			if (!existingCard) {
				return c.json({ error: "Card not found" }, 404);
			}

			let newListId: number | undefined;
			if (body.listPublicId) {
				const newList = await listRepo.getByPublicId(db, body.listPublicId);
				if (!newList) {
					return c.json({ error: "List not found" }, 404);
				}
				newListId = newList.id;
			}

			let result:
				| Awaited<ReturnType<typeof cardRepo.update>>
				| Awaited<ReturnType<typeof cardRepo.reorder>>
				| null = null;

			if (
				body.title !== undefined ||
				body.description !== undefined ||
				body.dueDate !== undefined
			) {
				result = await cardRepo.update(
					db,
					{
						...(body.title !== undefined ? { title: body.title } : {}),
						...(body.description !== undefined
							? { description: body.description }
							: {}),
						...(body.dueDate !== undefined && {
							dueDate: body.dueDate ? new Date(body.dueDate) : null,
						}),
					},
					{ cardPublicId },
				);
			}

			if (body.index !== undefined) {
				result = await cardRepo.reorder(db, {
					cardId: existingCard.id,
					newIndex: body.index,
					newListId,
				});
			}

			if (!result) {
				return c.json({ error: "Failed to update card" }, 500);
			}

			return c.json(result);
		},
	)

	.delete(
		"/:cardPublicId",
		describeRoute({
			tags: ["Cards"],
			summary: "Delete card",
			description: "Soft delete a card",
			responses: {
				200: { description: "Card deleted" },
				404: { description: "Card not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const cardPublicId = c.req.param("cardPublicId");

			const card = await cardRepo.getCardIdByPublicId(db, cardPublicId);
			if (!card) {
				return c.json({ error: "Card not found" }, 404);
			}

			await cardRepo.softDelete(db, {
				cardId: card.id,
				deletedAt: new Date(),
				deletedBy: userId,
			});

			return c.json({ success: true });
		},
	)

	.put(
		"/:cardPublicId/archive",
		describeRoute({
			tags: ["Cards"],
			summary: "Archive card",
			description: "Archive a card so it is hidden from the board",
			responses: {
				200: { description: "Card archived" },
				404: { description: "Card not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const cardPublicId = c.req.param("cardPublicId");

			const card = await cardRepo.getByPublicId(db, cardPublicId);
			if (!card) {
				return c.json({ error: "Card not found" }, 404);
			}

			await cardRepo.archive(db, { cardId: card.id });
			return c.json({ success: true });
		},
	)

	.put(
		"/:cardPublicId/unarchive",
		describeRoute({
			tags: ["Cards"],
			summary: "Unarchive card",
			description: "Restore an archived card back to its list",
			responses: {
				200: { description: "Card unarchived" },
				404: { description: "Card not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const cardPublicId = c.req.param("cardPublicId");

			const card = await cardRepo.getByPublicId(db, cardPublicId);
			if (!card) {
				return c.json({ error: "Card not found" }, 404);
			}

			const result = await cardRepo.unarchive(db, {
				cardId: card.id,
				listId: card.listId,
			});
			return c.json(result);
		},
	)

	.put(
		"/:cardPublicId/labels/:labelPublicId",
		describeRoute({
			tags: ["Cards"],
			summary: "Toggle card label",
			description: "Add or remove a label from a card",
			responses: {
				200: { description: "Label toggled" },
				404: { description: "Card or label not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const cardPublicId = c.req.param("cardPublicId");
			const labelPublicId = c.req.param("labelPublicId");

			const card = await cardRepo.getCardIdByPublicId(db, cardPublicId);
			if (!card) {
				return c.json({ error: "Card not found" }, 404);
			}

			const label = await labelRepo.getByPublicId(db, labelPublicId);
			if (!label) {
				return c.json({ error: "Label not found" }, 404);
			}

			const cardLabelIds = { cardId: card.id, labelId: label.id };
			const existing = await cardRepo.getCardLabelRelationship(
				db,
				cardLabelIds,
			);

			if (existing) {
				await cardRepo.hardDeleteCardLabelRelationship(db, cardLabelIds);
				return c.json({ newLabel: false });
			}

			await cardRepo.createCardLabelRelationship(db, cardLabelIds);
			return c.json({ newLabel: true });
		},
	);
