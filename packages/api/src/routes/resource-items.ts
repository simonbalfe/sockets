import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";

import { z } from "zod";

import type { Env } from "../app";
import * as resourceItemRepo from "../db/repository/resource-item.repo";
import * as resourceLabelRepo from "../db/repository/resource-label.repo";
import { type ResourceItemType, resourceItemTypes } from "../db/schema";
import { deleteObject, generateDownloadUrl } from "../lib/r2";

const resourceItemTypeSchema = z.enum(resourceItemTypes);

const csvToArray = z
	.union([z.string(), z.array(z.string())])
	.optional()
	.transform((v) => (v ? (Array.isArray(v) ? v : v.split(",")) : undefined));

const searchQuerySchema = z.object({
	type: csvToArray,
	label: csvToArray,
});

const createResourceLabelSchema = z.object({
	name: z.string().min(1).max(255),
	colourCode: z.string().min(1).max(12),
});

const updateResourceLabelSchema = z.object({
	name: z.string().min(1).max(255),
	colourCode: z.string().min(1).max(12),
});

const createResourceItemSchema = z.object({
	title: z.string().min(1).max(255),
	type: resourceItemTypeSchema,
	url: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	fileKey: z.string().nullable().optional(),
	fileSize: z.number().int().positive().nullable().optional(),
	mimeType: z.string().max(255).nullable().optional(),
});

const updateResourceItemSchema = z
	.object({
		title: z.string().min(1).max(255).optional(),
		type: resourceItemTypeSchema.optional(),
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

export const resourceItemRouter = new Hono<Env>()
	.basePath("/resources")
	.get(
		"/",
		describeRoute({
			tags: ["Resources"],
			summary: "List resources",
			description: "List all resources for the authenticated user",
			responses: { 200: { description: "List of resources" } },
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const items = await resourceItemRepo.getAllByUserId(db, userId);
			return c.json(await attachFileUrls(items));
		},
	)

	.get(
		"/labels/all",
		describeRoute({
			tags: ["Resources"],
			summary: "List resource labels",
			description: "List all resource labels for the authenticated user",
			responses: { 200: { description: "List of resource labels" } },
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			return c.json(await resourceLabelRepo.getAllByUserId(db, userId));
		},
	)

	.post(
		"/labels",
		describeRoute({
			tags: ["Resources"],
			summary: "Create resource label",
			description: "Create a new label for resources",
			responses: {
				200: { description: "Created label" },
				500: { description: "Failed to create label" },
			},
		}),
		validator("json", createResourceLabelSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const result = await resourceLabelRepo.create(db, {
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
			tags: ["Resources"],
			summary: "Update resource label",
			description: "Update a resource label name and colour",
			responses: {
				200: { description: "Updated label" },
				404: { description: "Label not found" },
			},
		}),
		validator("json", updateResourceLabelSchema),
		async (c) => {
			const db = c.var.db;
			const labelPublicId = c.req.param("labelPublicId");
			const body = c.req.valid("json");

			const result = await resourceLabelRepo.update(db, {
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
			tags: ["Resources"],
			summary: "Delete resource label",
			description: "Soft delete a resource label",
			responses: {
				200: { description: "Label deleted" },
				404: { description: "Label not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const labelPublicId = c.req.param("labelPublicId");

			const result = await resourceLabelRepo.softDelete(db, {
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
			tags: ["Resources"],
			summary: "Search resources",
			description: "Filter resources by type and labels",
			responses: { 200: { description: "Filtered resources" } },
		}),
		validator("query", searchQuerySchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const { type, label } = c.req.valid("query");

			const validTypes = type?.filter((t): t is ResourceItemType =>
				(resourceItemTypes as readonly string[]).includes(t),
			);

			const items = await resourceItemRepo.getFiltered(db, userId, {
				types: validTypes?.length ? validTypes : undefined,
				labelPublicIds: label,
			});
			return c.json(await attachFileUrls(items));
		},
	)

	.get(
		"/:publicId",
		describeRoute({
			tags: ["Resources"],
			summary: "Get resource",
			description: "Get a resource by its public ID",
			responses: {
				200: { description: "Resource details" },
				404: { description: "Resource not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const publicId = c.req.param("publicId");

			const item = await resourceItemRepo.getByPublicId(db, publicId);
			if (!item) {
				return c.json({ error: "Resource not found" }, 404);
			}

			return c.json(await attachFileUrl(item));
		},
	)

	.post(
		"/",
		describeRoute({
			tags: ["Resources"],
			summary: "Create resource",
			description: "Create a new resource",
			responses: {
				200: { description: "Created resource" },
				500: { description: "Failed to create resource" },
			},
		}),
		validator("json", createResourceItemSchema),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const body = c.req.valid("json");

			const result = await resourceItemRepo.create(db, {
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
				return c.json({ error: "Failed to create resource" }, 500);
			}

			return c.json(await attachFileUrl(result));
		},
	)

	.put(
		"/:publicId",
		describeRoute({
			tags: ["Resources"],
			summary: "Update resource",
			description: "Update a resource's fields",
			responses: {
				200: { description: "Updated resource" },
				404: { description: "Resource not found" },
				500: { description: "Failed to update resource" },
			},
		}),
		validator("json", updateResourceItemSchema),
		async (c) => {
			const db = c.var.db;
			const publicId = c.req.param("publicId");
			const body = c.req.valid("json");

			const existing = await resourceItemRepo.getByPublicId(db, publicId);
			if (!existing) {
				return c.json({ error: "Resource not found" }, 404);
			}

			const effectiveType = body.type ?? existing.type;
			const isFile = FILE_TYPES.has(effectiveType);

			if (isFile && body.fileKey && existing.fileKey && body.fileKey !== existing.fileKey) {
				await deleteObject(existing.fileKey).catch(() => {});
			}

			const result = await resourceItemRepo.update(db, {
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
				return c.json({ error: "Failed to update resource" }, 500);
			}

			return c.json(await attachFileUrl(result));
		},
	)

	.delete(
		"/:publicId",
		describeRoute({
			tags: ["Resources"],
			summary: "Delete resource",
			description: "Soft delete a resource",
			responses: {
				200: { description: "Resource deleted" },
				404: { description: "Resource not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const userId = c.get("userId");
			const publicId = c.req.param("publicId");

			const existing = await resourceItemRepo.getByPublicId(db, publicId);
			if (!existing) {
				return c.json({ error: "Resource not found" }, 404);
			}

			if (existing.fileKey) {
				await deleteObject(existing.fileKey).catch(() => {});
			}

			await resourceItemRepo.softDelete(db, {
				publicId,
				deletedBy: userId,
			});

			return c.json({ success: true });
		},
	)

	.put(
		"/:publicId/labels/:labelPublicId",
		describeRoute({
			tags: ["Resources"],
			summary: "Toggle resource label",
			description: "Add or remove a label from a resource",
			responses: {
				200: { description: "Label toggled" },
				404: { description: "Resource or label not found" },
			},
		}),
		async (c) => {
			const db = c.var.db;
			const publicId = c.req.param("publicId");
			const labelPublicId = c.req.param("labelPublicId");

			const item = await resourceItemRepo.getIdByPublicId(db, publicId);
			if (!item) {
				return c.json({ error: "Resource not found" }, 404);
			}

			const label = await resourceLabelRepo.getIdByPublicId(db, labelPublicId);
			if (!label) {
				return c.json({ error: "Label not found" }, 404);
			}

			const result = await resourceItemRepo.toggleLabel(db, {
				knowledgeItemId: item.id,
				knowledgeLabelId: label.id,
			});

			return c.json(result);
		},
	);
