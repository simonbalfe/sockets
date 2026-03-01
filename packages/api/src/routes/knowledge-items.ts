import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";

import { z } from "zod";

import type { Env } from "../app";
import * as knowledgeItemRepo from "../db/repository/knowledge-item.repo";
import * as knowledgeLabelRepo from "../db/repository/knowledge-label.repo";
import { type KnowledgeItemType, knowledgeItemTypes } from "../db/schema";
import { deleteObject, generateDownloadUrl } from "../lib/r2";

const knowledgeItemTypeSchema = z.enum(knowledgeItemTypes);

const csvToArray = z
	.union([z.string(), z.array(z.string())])
	.optional()
	.transform((v) => (v ? (Array.isArray(v) ? v : v.split(",")) : undefined));

const searchQuerySchema = z.object({
	type: csvToArray,
	label: csvToArray,
});

const createKnowledgeLabelSchema = z.object({
	name: z.string().min(1).max(255),
	colourCode: z.string().min(1).max(12),
});

const updateKnowledgeLabelSchema = z.object({
	name: z.string().min(1).max(255),
	colourCode: z.string().min(1).max(12),
});

const createKnowledgeItemSchema = z.object({
	title: z.string().min(1).max(255),
	type: knowledgeItemTypeSchema,
	url: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	fileKey: z.string().nullable().optional(),
	fileSize: z.number().int().positive().nullable().optional(),
	mimeType: z.string().max(255).nullable().optional(),
});

const updateKnowledgeItemSchema = z
	.object({
		title: z.string().min(1).max(255).optional(),
		type: knowledgeItemTypeSchema.optional(),
		url: z.string().nullable().optional(),
		description: z.string().nullable().optional(),
		fileKey: z.string().nullable().optional(),
		fileSize: z.number().int().positive().nullable().optional(),
		mimeType: z.string().max(255).nullable().optional(),
	})
	.refine((data) => Object.keys(data).length >= 1, {
		message: "At least one field must be provided",
	});

const FILE_TYPES = new Set(["image", "video", "pdf", "audio"]);

async function attachFileUrls<
	T extends { fileKey: string | null; [key: string]: unknown },
>(items: T[]) {
	return Promise.all(
		items.map(async (item) => ({
			...item,
			fileUrl: item.fileKey ? await generateDownloadUrl(item.fileKey) : null,
		})),
	);
}

async function attachFileUrl<
	T extends { fileKey: string | null; [key: string]: unknown },
>(item: T) {
	return {
		...item,
		fileUrl: item.fileKey ? await generateDownloadUrl(item.fileKey) : null,
	};
}

export const knowledgeItemRouter = new Hono<Env>()
	.basePath("/knowledge-items")
	.get(
		"/",
		describeRoute({
			tags: ["Knowledge"],
			summary: "List knowledge items",
			description: "List all knowledge items for the authenticated user",
			responses: { 200: { description: "List of knowledge items" } },
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const items = await knowledgeItemRepo.getAllByUserId(db, userId);
			return c.json(await attachFileUrls(items));
		},
	)

	.get(
		"/labels/all",
		describeRoute({
			tags: ["Knowledge"],
			summary: "List knowledge labels",
			description: "List all knowledge labels for the authenticated user",
			responses: { 200: { description: "List of knowledge labels" } },
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			return c.json(await knowledgeLabelRepo.getAllByUserId(db, userId));
		},
	)

	.post(
		"/labels",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Create knowledge label",
			description: "Create a new label for knowledge items",
			responses: {
				200: { description: "Created label" },
				500: { description: "Failed to create label" },
			},
		}),
		validator("json", createKnowledgeLabelSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const result = await knowledgeLabelRepo.create(db, {
				name: body.name,
				colourCode: body.colourCode,
				createdBy: userId,
			});

			if (!result) {
				return c.json({ error: "Failed to create label" }, 500);
			}

			return c.json(result);
		},
	)

	.put(
		"/labels/:labelPublicId",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Update knowledge label",
			description: "Update a knowledge label name and colour",
			responses: {
				200: { description: "Updated label" },
				404: { description: "Label not found" },
			},
		}),
		validator("json", updateKnowledgeLabelSchema),
		async (c) => {
			const db = c.var.db;
			const labelPublicId = c.req.param("labelPublicId");
			const body = c.req.valid("json");

			const result = await knowledgeLabelRepo.update(db, {
				publicId: labelPublicId,
				name: body.name,
				colourCode: body.colourCode,
			});

			if (!result) {
				return c.json({ error: "Label not found" }, 404);
			}

			return c.json(result);
		},
	)

	.delete(
		"/labels/:labelPublicId",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Delete knowledge label",
			description: "Soft delete a knowledge label",
			responses: {
				200: { description: "Label deleted" },
				404: { description: "Label not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const labelPublicId = c.req.param("labelPublicId");

			const result = await knowledgeLabelRepo.softDelete(db, {
				publicId: labelPublicId,
				deletedBy: userId,
			});

			if (!result) {
				return c.json({ error: "Label not found" }, 404);
			}

			return c.json({ success: true });
		},
	)

	.get(
		"/search",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Search knowledge items",
			description: "Filter knowledge items by type and labels",
			responses: { 200: { description: "Filtered knowledge items" } },
		}),
		validator("query", searchQuerySchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const { type, label } = c.req.valid("query");

			const validTypes = type?.filter((t): t is KnowledgeItemType =>
				(knowledgeItemTypes as readonly string[]).includes(t),
			);

			const items = await knowledgeItemRepo.getFiltered(db, userId, {
				types: validTypes?.length ? validTypes : undefined,
				labelPublicIds: label,
			});
			return c.json(await attachFileUrls(items));
		},
	)

	.get(
		"/:publicId",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Get knowledge item",
			description: "Get a knowledge item by its public ID",
			responses: {
				200: { description: "Knowledge item details" },
				404: { description: "Knowledge item not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const publicId = c.req.param("publicId");

			const item = await knowledgeItemRepo.getByPublicId(db, publicId);
			if (!item) {
				return c.json({ error: "Knowledge item not found" }, 404);
			}

			return c.json(await attachFileUrl(item));
		},
	)

	.post(
		"/",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Create knowledge item",
			description: "Create a new knowledge item",
			responses: {
				200: { description: "Created knowledge item" },
				500: { description: "Failed to create knowledge item" },
			},
		}),
		validator("json", createKnowledgeItemSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const result = await knowledgeItemRepo.create(db, {
				title: body.title,
				type: body.type,
				url: FILE_TYPES.has(body.type) ? null : body.url,
				description: body.description,
				fileKey: FILE_TYPES.has(body.type) ? body.fileKey : null,
				fileSize: FILE_TYPES.has(body.type) ? body.fileSize : null,
				mimeType: FILE_TYPES.has(body.type) ? body.mimeType : null,
				createdBy: userId,
			});

			if (!result) {
				return c.json({ error: "Failed to create knowledge item" }, 500);
			}

			return c.json(await attachFileUrl(result));
		},
	)

	.put(
		"/:publicId",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Update knowledge item",
			description: "Update a knowledge item's fields",
			responses: {
				200: { description: "Updated knowledge item" },
				404: { description: "Knowledge item not found" },
				500: { description: "Failed to update knowledge item" },
			},
		}),
		validator("json", updateKnowledgeItemSchema),
		async (c) => {
			const db = c.var.db;
			const publicId = c.req.param("publicId");
			const body = c.req.valid("json");

			const existing = await knowledgeItemRepo.getByPublicId(db, publicId);
			if (!existing) {
				return c.json({ error: "Knowledge item not found" }, 404);
			}

			const effectiveType = body.type ?? existing.type;
			const isFile = FILE_TYPES.has(effectiveType);

			if (isFile && body.fileKey && existing.fileKey && body.fileKey !== existing.fileKey) {
				await deleteObject(existing.fileKey).catch(() => {});
			}

			const result = await knowledgeItemRepo.update(db, {
				publicId,
				title: body.title,
				description: body.description,
				url: isFile ? null : body.url,
				type: body.type,
				fileKey: isFile ? body.fileKey : null,
				fileSize: isFile ? body.fileSize : null,
				mimeType: isFile ? body.mimeType : null,
			});

			if (!result) {
				return c.json({ error: "Failed to update knowledge item" }, 500);
			}

			return c.json(await attachFileUrl(result));
		},
	)

	.delete(
		"/:publicId",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Delete knowledge item",
			description: "Soft delete a knowledge item",
			responses: {
				200: { description: "Knowledge item deleted" },
				404: { description: "Knowledge item not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const publicId = c.req.param("publicId");

			const existing = await knowledgeItemRepo.getByPublicId(db, publicId);
			if (!existing) {
				return c.json({ error: "Knowledge item not found" }, 404);
			}

			if (existing.fileKey) {
				await deleteObject(existing.fileKey).catch(() => {});
			}

			await knowledgeItemRepo.softDelete(db, {
				publicId,
				deletedBy: userId,
			});

			return c.json({ success: true });
		},
	)

	.put(
		"/:publicId/labels/:labelPublicId",
		describeRoute({
			tags: ["Knowledge"],
			summary: "Toggle knowledge item label",
			description: "Add or remove a label from a knowledge item",
			responses: {
				200: { description: "Label toggled" },
				404: { description: "Knowledge item or label not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const publicId = c.req.param("publicId");
			const labelPublicId = c.req.param("labelPublicId");

			const item = await knowledgeItemRepo.getIdByPublicId(db, publicId);
			if (!item) {
				return c.json({ error: "Knowledge item not found" }, 404);
			}

			const label = await knowledgeLabelRepo.getIdByPublicId(db, labelPublicId);
			if (!label) {
				return c.json({ error: "Label not found" }, 404);
			}

			const result = await knowledgeItemRepo.toggleLabel(db, {
				knowledgeItemId: item.id,
				knowledgeLabelId: label.id,
			});

			return c.json(result);
		},
	);
