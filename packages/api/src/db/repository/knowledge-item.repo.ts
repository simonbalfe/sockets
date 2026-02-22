import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { generateUID } from "../../lib/utils";
import type { dbClient } from "../client";
import type { KnowledgeItemType } from "../schema";
import { knowledgeItems, knowledgeItemsToLabels } from "../schema";

const itemColumns = {
  publicId: true,
  title: true,
  description: true,
  type: true,
  url: true,
  createdAt: true,
} as const;

const withLabels = {
  labels: {
    with: {
      knowledgeLabel: {
        columns: { publicId: true, name: true, colourCode: true },
      },
    },
  },
} as const;

export const getAllByUserId = async (db: dbClient, userId: string) =>
  db.query.knowledgeItems.findMany({
    columns: itemColumns,
    with: withLabels,
    where: and(
      eq(knowledgeItems.createdBy, userId),
      isNull(knowledgeItems.deletedAt),
    ),
    orderBy: [desc(knowledgeItems.createdAt)],
  });

export const getFiltered = async (
  db: dbClient,
  userId: string,
  filters: { types?: KnowledgeItemType[]; labelPublicIds?: string[] },
) => {
  const conditions = [
    eq(knowledgeItems.createdBy, userId),
    isNull(knowledgeItems.deletedAt),
  ];
  if (filters.types?.length) {
    conditions.push(inArray(knowledgeItems.type, filters.types));
  }

  const items = await db.query.knowledgeItems.findMany({
    columns: itemColumns,
    with: withLabels,
    where: and(...conditions),
    orderBy: [desc(knowledgeItems.createdAt)],
  });

  if (!filters.labelPublicIds?.length) return items;

  const labelSet = new Set(filters.labelPublicIds);
  return items.filter((item) =>
    item.labels.some((l) => labelSet.has(l.knowledgeLabel.publicId)),
  );
};

export const getByPublicId = async (db: dbClient, publicId: string) =>
  db.query.knowledgeItems.findFirst({
    columns: itemColumns,
    with: withLabels,
    where: and(
      eq(knowledgeItems.publicId, publicId),
      isNull(knowledgeItems.deletedAt),
    ),
  });

export const getIdByPublicId = async (db: dbClient, publicId: string) => {
  const result = await db.query.knowledgeItems.findFirst({
    columns: { id: true },
    where: and(
      eq(knowledgeItems.publicId, publicId),
      isNull(knowledgeItems.deletedAt),
    ),
  });
  return result ?? null;
};

export const create = async (
  db: dbClient,
  input: {
    title: string;
    type: KnowledgeItemType;
    url?: string | null;
    description?: string | null;
    createdBy: string;
  },
) => {
  const [result] = await db
    .insert(knowledgeItems)
    .values({
      publicId: generateUID(),
      title: input.title,
      type: input.type,
      url: input.url ?? null,
      description: input.description ?? null,
      createdBy: input.createdBy,
    })
    .returning({
      publicId: knowledgeItems.publicId,
      title: knowledgeItems.title,
      type: knowledgeItems.type,
      url: knowledgeItems.url,
      description: knowledgeItems.description,
    });
  return result;
};

export const update = async (
  db: dbClient,
  input: {
    publicId: string;
    title?: string;
    description?: string | null;
    url?: string | null;
    type?: KnowledgeItemType;
  },
) => {
  const [result] = await db
    .update(knowledgeItems)
    .set({
      title: input.title,
      description: input.description,
      url: input.url,
      type: input.type,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(knowledgeItems.publicId, input.publicId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .returning({
      publicId: knowledgeItems.publicId,
      title: knowledgeItems.title,
      type: knowledgeItems.type,
      url: knowledgeItems.url,
      description: knowledgeItems.description,
    });
  return result;
};

export const softDelete = async (
  db: dbClient,
  args: { publicId: string; deletedBy: string },
) => {
  const [result] = await db
    .update(knowledgeItems)
    .set({ deletedAt: new Date(), deletedBy: args.deletedBy })
    .where(
      and(
        eq(knowledgeItems.publicId, args.publicId),
        isNull(knowledgeItems.deletedAt),
      ),
    )
    .returning({ publicId: knowledgeItems.publicId });
  return result;
};

export const toggleLabel = async (
  db: dbClient,
  args: { knowledgeItemId: number; knowledgeLabelId: number },
) => {
  const existing = await db.query.knowledgeItemsToLabels.findFirst({
    where: and(
      eq(knowledgeItemsToLabels.knowledgeItemId, args.knowledgeItemId),
      eq(knowledgeItemsToLabels.knowledgeLabelId, args.knowledgeLabelId),
    ),
  });

  if (existing) {
    await db
      .delete(knowledgeItemsToLabels)
      .where(
        and(
          eq(knowledgeItemsToLabels.knowledgeItemId, args.knowledgeItemId),
          eq(knowledgeItemsToLabels.knowledgeLabelId, args.knowledgeLabelId),
        ),
      );
    return { added: false };
  }

  await db.insert(knowledgeItemsToLabels).values({
    knowledgeItemId: args.knowledgeItemId,
    knowledgeLabelId: args.knowledgeLabelId,
  });
  return { added: true };
};
