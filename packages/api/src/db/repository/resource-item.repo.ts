import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { generateUID } from "../../lib/utils";
import type { dbClient } from "../client";
import type { ResourceItemType } from "../schema";
import { resourceItems, resourceItemsToLabels } from "../schema";

const itemColumns = {
  publicId: true,
  title: true,
  description: true,
  type: true,
  url: true,
  fileKey: true,
  fileSize: true,
  mimeType: true,
  createdAt: true,
} as const;

const withLabels = {
  labels: {
    with: {
      resourceLabel: {
        columns: { publicId: true, name: true, colourCode: true },
      },
    },
  },
} as const;

export const getAllByUserId = async (db: dbClient, userId: string) =>
  db.query.resourceItems.findMany({
    columns: itemColumns,
    with: withLabels,
    where: and(
      eq(resourceItems.createdBy, userId),
      isNull(resourceItems.deletedAt),
    ),
    orderBy: [desc(resourceItems.createdAt)],
  });

export const getFiltered = async (
  db: dbClient,
  userId: string,
  filters: { types?: ResourceItemType[]; labelPublicIds?: string[] },
) => {
  const conditions = [
    eq(resourceItems.createdBy, userId),
    isNull(resourceItems.deletedAt),
  ];
  if (filters.types?.length) {
    conditions.push(inArray(resourceItems.type, filters.types));
  }

  const items = await db.query.resourceItems.findMany({
    columns: itemColumns,
    with: withLabels,
    where: and(...conditions),
    orderBy: [desc(resourceItems.createdAt)],
  });

  if (!filters.labelPublicIds?.length) return items;

  const labelSet = new Set(filters.labelPublicIds);
  return items.filter((item) =>
    item.labels.some((l) => labelSet.has(l.resourceLabel.publicId)),
  );
};

export const getByPublicId = async (db: dbClient, publicId: string) =>
  db.query.resourceItems.findFirst({
    columns: itemColumns,
    with: withLabels,
    where: and(
      eq(resourceItems.publicId, publicId),
      isNull(resourceItems.deletedAt),
    ),
  });

export const getIdByPublicId = async (db: dbClient, publicId: string) => {
  const result = await db.query.resourceItems.findFirst({
    columns: { id: true },
    where: and(
      eq(resourceItems.publicId, publicId),
      isNull(resourceItems.deletedAt),
    ),
  });
  return result ?? null;
};

export const create = async (
  db: dbClient,
  input: {
    title: string;
    type: ResourceItemType;
    url?: string | null;
    description?: string | null;
    fileKey?: string | null;
    fileSize?: number | null;
    mimeType?: string | null;
    createdBy: string;
  },
) => {
  const [result] = await db
    .insert(resourceItems)
    .values({
      publicId: generateUID(),
      title: input.title,
      type: input.type,
      url: input.url ?? null,
      description: input.description ?? null,
      fileKey: input.fileKey ?? null,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      createdBy: input.createdBy,
    })
    .returning({
      publicId: resourceItems.publicId,
      title: resourceItems.title,
      type: resourceItems.type,
      url: resourceItems.url,
      description: resourceItems.description,
      fileKey: resourceItems.fileKey,
      fileSize: resourceItems.fileSize,
      mimeType: resourceItems.mimeType,
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
    type?: ResourceItemType;
    fileKey?: string | null;
    fileSize?: number | null;
    mimeType?: string | null;
  },
) => {
  const [result] = await db
    .update(resourceItems)
    .set({
      title: input.title,
      description: input.description,
      url: input.url,
      type: input.type,
      fileKey: input.fileKey,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(resourceItems.publicId, input.publicId),
        isNull(resourceItems.deletedAt),
      ),
    )
    .returning({
      publicId: resourceItems.publicId,
      title: resourceItems.title,
      type: resourceItems.type,
      url: resourceItems.url,
      description: resourceItems.description,
      fileKey: resourceItems.fileKey,
      fileSize: resourceItems.fileSize,
      mimeType: resourceItems.mimeType,
    });
  return result;
};

export const softDelete = async (
  db: dbClient,
  args: { publicId: string; deletedBy: string },
) => {
  const [result] = await db
    .update(resourceItems)
    .set({ deletedAt: new Date(), deletedBy: args.deletedBy })
    .where(
      and(
        eq(resourceItems.publicId, args.publicId),
        isNull(resourceItems.deletedAt),
      ),
    )
    .returning({ publicId: resourceItems.publicId });
  return result;
};

export const toggleLabel = async (
  db: dbClient,
  args: { knowledgeItemId: number; knowledgeLabelId: number },
) => {
  const existing = await db.query.resourceItemsToLabels.findFirst({
    where: and(
      eq(resourceItemsToLabels.knowledgeItemId, args.knowledgeItemId),
      eq(resourceItemsToLabels.knowledgeLabelId, args.knowledgeLabelId),
    ),
  });

  if (existing) {
    await db
      .delete(resourceItemsToLabels)
      .where(
        and(
          eq(resourceItemsToLabels.knowledgeItemId, args.knowledgeItemId),
          eq(resourceItemsToLabels.knowledgeLabelId, args.knowledgeLabelId),
        ),
      );
    return { added: false };
  }

  await db.insert(resourceItemsToLabels).values({
    knowledgeItemId: args.knowledgeItemId,
    knowledgeLabelId: args.knowledgeLabelId,
  });
  return { added: true };
};
