import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";

import type { Env } from "../app";
import * as boardRepo from "../db/repository/board.repo";
import * as cardRepo from "../db/repository/card.repo";
import * as labelRepo from "../db/repository/label.repo";
import { hexColourCodeSchema } from "../lib/schemas";

export const labelRouter = new Hono<Env>()
	.basePath("/labels")
	.get(
		"/:labelPublicId",
		describeRoute({
			tags: ["Labels"],
			summary: "Get label",
			description: "Get a label by its public ID",
			responses: {
				200: { description: "Label details" },
				404: { description: "Label not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const labelPublicId = c.req.param("labelPublicId");

			const label = await labelRepo.getByPublicId(db, labelPublicId);
			if (!label) {
				return c.json({ error: "Label not found" }, 404);
			}

			return c.json({
				publicId: label.publicId,
				name: label.name,
				colourCode: label.colourCode,
			});
		},
	)

	.post(
		"/",
		describeRoute({
			tags: ["Labels"],
			summary: "Create label",
			description: "Create a new label for a board",
			responses: {
				200: { description: "Created label" },
				404: { description: "Board not found" },
				500: { description: "Failed to create label" },
			},
		}),
		zValidator(
			"json",
			z.object({
				name: z.string().min(1).max(36),
				boardPublicId: z.string(),
				colourCode: hexColourCodeSchema,
			}),
		),
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

			const result = await labelRepo.create(db, {
				name: body.name,
				colourCode: body.colourCode,
				createdBy: userId,
				boardId: board.id,
			});

			if (!result) {
				return c.json({ error: "Failed to create label" }, 500);
			}

			return c.json({
				publicId: result.publicId,
				name: result.name,
				colourCode: result.colourCode,
			});
		},
	)

	.put(
		"/:labelPublicId",
		describeRoute({
			tags: ["Labels"],
			summary: "Update label",
			description: "Update label name and colour",
			responses: {
				200: { description: "Updated label" },
				404: { description: "Label not found" },
				500: { description: "Failed to update label" },
			},
		}),
		zValidator(
			"json",
			z.object({
				name: z.string().min(1).max(36),
				colourCode: hexColourCodeSchema,
			}),
		),
		async (c) => {
			const db = c.var.db;
			const labelPublicId = c.req.param("labelPublicId");
			const body = c.req.valid("json");

			const label = await labelRepo.getLabelIdByPublicId(db, labelPublicId);
			if (!label) {
				return c.json({ error: "Label not found" }, 404);
			}

			const result = await labelRepo.update(db, {
				labelPublicId,
				name: body.name,
				colourCode: body.colourCode,
			});

			if (!result) {
				return c.json({ error: "Failed to update label" }, 500);
			}

			return c.json({
				publicId: result.publicId,
				name: result.name,
				colourCode: result.colourCode,
			});
		},
	)

	.delete(
		"/:labelPublicId",
		describeRoute({
			tags: ["Labels"],
			summary: "Delete label",
			description: "Soft delete a label and remove all card associations",
			responses: {
				200: { description: "Label deleted" },
				404: { description: "Label not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const labelPublicId = c.req.param("labelPublicId");

			const label = await labelRepo.getLabelIdByPublicId(db, labelPublicId);
			if (!label) {
				return c.json({ error: "Label not found" }, 404);
			}

			await cardRepo.hardDeleteAllCardLabelRelationships(db, label.id);

			await labelRepo.softDelete(db, {
				labelId: label.id,
				deletedAt: new Date(),
				deletedBy: userId,
			});

			return c.json({ success: true });
		},
	);
