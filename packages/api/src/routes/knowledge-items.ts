import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../app";
import * as knowledgeItemRepo from "../db/repository/knowledge-item.repo";
import * as knowledgeLabelRepo from "../db/repository/knowledge-label.repo";
import { type KnowledgeItemType, knowledgeItemTypes } from "../db/schema";

const knowledgeItemTypeSchema = z.enum(knowledgeItemTypes);

const csvToArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (v ? (Array.isArray(v) ? v : v.split(",")) : undefined));

const searchQuerySchema = z.object({
  type: csvToArray,
  label: csvToArray,
});

export const knowledgeItemRoutes = () =>
  new Hono<Env>()
    .get("/", async (c) => {
      const db = c.var.db;
      const userId = c.get("userId");
      return c.json(await knowledgeItemRepo.getAllByUserId(db, userId));
    })

    .get("/labels/all", async (c) => {
      const db = c.var.db;
      const userId = c.get("userId");
      return c.json(await knowledgeLabelRepo.getAllByUserId(db, userId));
    })

    .post(
      "/labels",
      zValidator(
        "json",
        z.object({
          name: z.string().min(1).max(255),
          colourCode: z.string().min(1).max(12),
        }),
      ),
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
      zValidator(
        "json",
        z.object({
          name: z.string().min(1).max(255),
          colourCode: z.string().min(1).max(12),
        }),
      ),
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

    .delete("/labels/:labelPublicId", async (c) => {
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
    })

    .get("/search", zValidator("query", searchQuerySchema), async (c) => {
      const db = c.var.db;
      const userId = c.get("userId");
      const { type, label } = c.req.valid("query");

      const validTypes = type?.filter((t): t is KnowledgeItemType =>
        (knowledgeItemTypes as readonly string[]).includes(t),
      );

      return c.json(
        await knowledgeItemRepo.getFiltered(db, userId, {
          types: validTypes?.length ? validTypes : undefined,
          labelPublicIds: label,
        }),
      );
    })

    .get("/:publicId", async (c) => {
      const db = c.var.db;
      const publicId = c.req.param("publicId");

      const item = await knowledgeItemRepo.getByPublicId(db, publicId);
      if (!item) {
        return c.json({ error: "Knowledge item not found" }, 404);
      }

      return c.json(item);
    })

    .post(
      "/",
      zValidator(
        "json",
        z.object({
          title: z.string().min(1).max(255),
          type: knowledgeItemTypeSchema,
          url: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
        }),
      ),
      async (c) => {
        const db = c.var.db;
        const userId = c.get("userId");
        const body = c.req.valid("json");

        const result = await knowledgeItemRepo.create(db, {
          title: body.title,
          type: body.type,
          url: body.url,
          description: body.description,
          createdBy: userId,
        });

        if (!result) {
          return c.json({ error: "Failed to create knowledge item" }, 500);
        }

        return c.json(result);
      },
    )

    .put(
      "/:publicId",
      zValidator(
        "json",
        z
          .object({
            title: z.string().min(1).max(255).optional(),
            type: knowledgeItemTypeSchema.optional(),
            url: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
          })
          .refine((data) => Object.keys(data).length >= 1, {
            message: "At least one field must be provided",
          }),
      ),
      async (c) => {
        const db = c.var.db;
        const publicId = c.req.param("publicId");
        const body = c.req.valid("json");

        const existing = await knowledgeItemRepo.getByPublicId(db, publicId);
        if (!existing) {
          return c.json({ error: "Knowledge item not found" }, 404);
        }

        const result = await knowledgeItemRepo.update(db, {
          publicId,
          title: body.title,
          description: body.description,
          url: body.url,
          type: body.type,
        });

        if (!result) {
          return c.json({ error: "Failed to update knowledge item" }, 500);
        }

        return c.json(result);
      },
    )

    .delete("/:publicId", async (c) => {
      const db = c.var.db;
      const userId = c.get("userId");
      const publicId = c.req.param("publicId");

      const existing = await knowledgeItemRepo.getByPublicId(db, publicId);
      if (!existing) {
        return c.json({ error: "Knowledge item not found" }, 404);
      }

      await knowledgeItemRepo.softDelete(db, {
        publicId,
        deletedBy: userId,
      });

      return c.json({ success: true });
    })

    .put("/:publicId/labels/:labelPublicId", async (c) => {
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
    });
