import { and, eq, isNull } from "drizzle-orm";
import { generateUID } from "../../lib/utils";
import type { dbClient } from "../client";
import { resourceLabels } from "../schema";

export const getAllByUserId = async (db: dbClient, userId: string) => {
  return db.query.resourceLabels.findMany({
    columns: {
      id: true,
      publicId: true,
      name: true,
      colourCode: true,
    },
    where: and(
      eq(resourceLabels.createdBy, userId),
      isNull(resourceLabels.deletedAt),
    ),
  });
};

export const create = async (
  db: dbClient,
  input: {
    name: string;
    colourCode: string;
    createdBy: string;
  },
) => {
  const [result] = await db
    .insert(resourceLabels)
    .values({
      publicId: generateUID(),
      name: input.name,
      colourCode: input.colourCode,
      createdBy: input.createdBy,
    })
    .returning({
      publicId: resourceLabels.publicId,
      name: resourceLabels.name,
      colourCode: resourceLabels.colourCode,
    });

  return result;
};

export const update = async (
  db: dbClient,
  input: {
    publicId: string;
    name: string;
    colourCode: string;
  },
) => {
  const [result] = await db
    .update(resourceLabels)
    .set({
      name: input.name,
      colourCode: input.colourCode,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(resourceLabels.publicId, input.publicId),
        isNull(resourceLabels.deletedAt),
      ),
    )
    .returning({
      publicId: resourceLabels.publicId,
      name: resourceLabels.name,
      colourCode: resourceLabels.colourCode,
    });

  return result;
};

export const softDelete = async (
  db: dbClient,
  args: {
    publicId: string;
    deletedBy: string;
  },
) => {
  const [result] = await db
    .update(resourceLabels)
    .set({
      deletedAt: new Date(),
      deletedBy: args.deletedBy,
    })
    .where(
      and(
        eq(resourceLabels.publicId, args.publicId),
        isNull(resourceLabels.deletedAt),
      ),
    )
    .returning({
      publicId: resourceLabels.publicId,
    });

  return result;
};

export const getIdByPublicId = async (db: dbClient, publicId: string) => {
  const result = await db.query.resourceLabels.findFirst({
    columns: { id: true },
    where: and(
      eq(resourceLabels.publicId, publicId),
      isNull(resourceLabels.deletedAt),
    ),
  });

  return result ?? null;
};
