import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";

import type { Env } from "../app";
import { generateUploadUrl } from "../lib/r2";
import { generateUID } from "../lib/utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const allowedMimePatterns = [
	/^image\//,
	/^video\//,
	/^audio\//,
	/^application\/pdf$/,
];

const presignSchema = z.object({
	fileName: z.string().min(1).max(255),
	mimeType: z.string().min(1).max(255),
	fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
});

export const uploadRouter = new Hono<Env>()
	.basePath("/uploads")
	.post(
		"/presign",
		describeRoute({
			tags: ["Uploads"],
			summary: "Get presigned upload URL",
			description:
				"Generate a presigned URL for direct file upload to R2 storage",
			responses: {
				200: { description: "Presigned upload URL and file key" },
				400: { description: "Invalid input" },
			},
		}),
		validator("json", presignSchema),
		async (c) => {
			const userId = c.get("userId");
			const { fileName, mimeType, fileSize } = c.req.valid("json");

			if (!allowedMimePatterns.some((p) => p.test(mimeType))) {
				return c.json({ error: "File type not allowed" }, 400);
			}

			const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
			const fileKey = `${generateUID()}_${sanitizedFileName}`;

			const uploadUrl = await generateUploadUrl(fileKey, mimeType);

			return c.json({ uploadUrl, fileKey, fileSize });
		},
	);
