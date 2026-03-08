import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { generateUID } from "../../lib/utils";
import type { dbClient } from "../client";
import {
  cards,
  cardsToLabels,
  checklistItems,
  checklists,
  labels,
  lists,
} from "../schema";

export const getCount = async (db: dbClient) => {
  const result = await db
    .select({ count: count() })
    .from(cards)
    .where(and(isNull(cards.deletedAt), isNull(cards.archivedAt)));

  return result[0]?.count ?? 0;
};

export const create = async (
  db: dbClient,
  cardInput: {
    title: string;
    description: string;
    createdBy: string;
    listId: number;
    position: "start" | "end";
    dueDate?: Date | null;
  },
) => {
  return db.transaction(async (tx) => {
    let index = 0;

    if (cardInput.position === "end") {
      const lastCard = await tx.query.cards.findFirst({
        columns: { index: true },
        where: and(eq(cards.listId, cardInput.listId), isNull(cards.deletedAt), isNull(cards.archivedAt)),
        orderBy: desc(cards.index),
      });

      if (lastCard) index = lastCard.index + 1;
    }

    const getExistingCardAtIndex = async () =>
      tx.query.cards.findFirst({
        columns: { id: true },
        where: and(
          eq(cards.listId, cardInput.listId),
          eq(cards.index, index),
          isNull(cards.deletedAt),
          isNull(cards.archivedAt),
        ),
      });

    const existingCardAtIndex = await getExistingCardAtIndex();

    if (existingCardAtIndex?.id) {
      await tx.execute(sql`
        UPDATE card
        SET index = index + 1
        WHERE "listId" = ${cardInput.listId} AND index >= ${index} AND "deletedAt" IS NULL AND "archivedAt" IS NULL;
      `);
    }

    const result = await tx
      .insert(cards)
      .values({
        publicId: generateUID(),
        title: cardInput.title,
        description: cardInput.description,
        createdBy: cardInput.createdBy,
        listId: cardInput.listId,
        index: index,
        dueDate: cardInput.dueDate ?? null,
      })
      .returning({
        id: cards.id,
        listId: cards.listId,
        publicId: cards.publicId,
      });

    if (!result[0]) throw new Error("Unable to create card");

    const countExpr = sql<number>`COUNT(*)`.mapWith(Number);

    const duplicateIndices = await tx
      .select({
        index: cards.index,
        count: countExpr,
      })
      .from(cards)
      .where(and(eq(cards.listId, result[0].listId), isNull(cards.deletedAt), isNull(cards.archivedAt)))
      .groupBy(cards.listId, cards.index)
      .having(gt(countExpr, 1));

    if (duplicateIndices.length > 0) {
      await tx.execute(sql`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY "index", id) - 1 AS new_index
          FROM "card"
          WHERE "listId" = ${result[0].listId} AND "deletedAt" IS NULL AND "archivedAt" IS NULL
        )
        UPDATE "card" c
        SET "index" = o.new_index
        FROM ordered o
        WHERE c.id = o.id;
      `);

      const postFixDupes = await tx
        .select({ index: cards.index, count: countExpr })
        .from(cards)
        .where(and(eq(cards.listId, result[0].listId), isNull(cards.deletedAt), isNull(cards.archivedAt)))
        .groupBy(cards.listId, cards.index)
        .having(gt(countExpr, 1));

      if (postFixDupes.length > 0) {
        throw new Error(
          `Invariant violation: duplicate card indices remain after compaction in list ${result[0].listId}`,
        );
      }
    }

    return result[0];
  });
};

export const bulkCreateCardLabelRelationships = async (
  db: dbClient,
  cardLabelRelationshipInput: {
    cardId: number;
    labelId: number;
  }[],
) => {
  const result = await db
    .insert(cardsToLabels)
    .values(cardLabelRelationshipInput)
    .returning();

  return result;
};

export const update = async (
  db: dbClient,
  cardInput: {
    title?: string;
    description?: string;
    dueDate?: Date | null;
  },
  args: {
    cardPublicId: string;
  },
) => {
  const [result] = await db
    .update(cards)
    .set({
      title: cardInput.title,
      description: cardInput.description,
      dueDate: cardInput.dueDate !== undefined ? cardInput.dueDate : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(cards.publicId, args.cardPublicId), isNull(cards.deletedAt), isNull(cards.archivedAt)))
    .returning({
      id: cards.id,
      publicId: cards.publicId,
      title: cards.title,
      description: cards.description,
      dueDate: cards.dueDate,
    });

  return result;
};

export const getByPublicId = (db: dbClient, cardPublicId: string) => {
  return db.query.cards.findFirst({
    columns: {
      id: true,
      publicId: true,
      title: true,
      description: true,
      listId: true,
      dueDate: true,
    },
    where: eq(cards.publicId, cardPublicId),
  });
};

export const getCardLabelRelationship = async (
  db: dbClient,
  args: { cardId: number; labelId: number },
) => {
  return db.query.cardsToLabels.findFirst({
    where: and(
      eq(cardsToLabels.cardId, args.cardId),
      eq(cardsToLabels.labelId, args.labelId),
    ),
  });
};

export const createCardLabelRelationship = async (
  db: dbClient,
  cardLabelRelationshipInput: { cardId: number; labelId: number },
) => {
  const [result] = await db
    .insert(cardsToLabels)
    .values({
      cardId: cardLabelRelationshipInput.cardId,
      labelId: cardLabelRelationshipInput.labelId,
    })
    .returning();

  return result;
};

export const getWithListAndMembersByPublicId = async (
  db: dbClient,
  cardPublicId: string,
) => {
  const card = await db.query.cards.findFirst({
    columns: {
      id: true,
      publicId: true,
      title: true,
      description: true,
      dueDate: true,
      createdBy: true,
    },
    with: {
      labels: {
        with: {
          label: {
            columns: {
              publicId: true,
              name: true,
              colourCode: true,
            },
          },
        },
      },
      checklists: {
        columns: {
          publicId: true,
          name: true,
          index: true,
        },
        where: isNull(checklists.deletedAt),
        orderBy: asc(checklists.index),
        with: {
          items: {
            columns: {
              publicId: true,
              title: true,
              completed: true,
              index: true,
            },
            where: isNull(checklistItems.deletedAt),
            orderBy: asc(checklistItems.index),
          },
        },
      },
      list: {
        columns: {
          publicId: true,
          name: true,
        },
        with: {
          board: {
            columns: {
              publicId: true,
              name: true,
            },
            with: {
              labels: {
                columns: {
                  publicId: true,
                  colourCode: true,
                  name: true,
                },
                where: isNull(labels.deletedAt),
              },
              lists: {
                columns: {
                  publicId: true,
                  name: true,
                },
                where: isNull(lists.deletedAt),
                orderBy: asc(lists.index),
              },
            },
          },
        },
      },
    },
    where: and(eq(cards.publicId, cardPublicId), isNull(cards.deletedAt), isNull(cards.archivedAt)),
  });

  if (!card) return null;

  return {
    ...card,
    labels: card.labels.map((label) => label.label),
  };
};

export const reorder = async (
  db: dbClient,
  args: {
    newListId: number | undefined;
    newIndex: number | undefined;
    cardId: number;
  },
) => {
  return db.transaction(async (tx) => {
    const card = await tx.query.cards.findFirst({
      columns: {
        id: true,
        index: true,
      },
      where: and(eq(cards.id, args.cardId), isNull(cards.deletedAt), isNull(cards.archivedAt)),
      with: {
        list: {
          columns: {
            id: true,
            index: true,
          },
        },
      },
    });

    if (!card?.list)
      throw new Error(`Card not found for public ID ${args.cardId}`);

    const currentList = card.list;
    const currentIndex = card.index;
    let newList:
      | { id: number; index: number; cards: { id: number; index: number }[] }
      | undefined;

    if (args.newListId) {
      newList = await tx.query.lists.findFirst({
        columns: {
          id: true,
          index: true,
        },
        with: {
          cards: {
            columns: {
              id: true,
              index: true,
            },
            orderBy: desc(cards.index),
            limit: 1,
          },
        },
        where: and(eq(lists.id, args.newListId), isNull(lists.deletedAt)),
      });

      if (!newList)
        throw new Error(`List not found for public ID ${args.newListId}`);
    }

    let newIndex = args.newIndex;

    if (newIndex === undefined) {
      const lastCardIndex = newList?.cards.length
        ? newList.cards[0]?.index
        : undefined;

      newIndex = lastCardIndex !== undefined ? lastCardIndex + 1 : 0;
    }

    if (currentList.id === newList?.id) {
      await tx.execute(sql`
        UPDATE card
        SET index =
          CASE
            WHEN index = ${currentIndex} THEN ${newIndex}
            WHEN ${currentIndex} < ${newIndex} AND index > ${currentIndex} AND index <= ${newIndex} THEN index - 1
            WHEN ${currentIndex} > ${newIndex} AND index >= ${newIndex} AND index < ${currentIndex} THEN index + 1
            ELSE index
          END
        WHERE "listId" = ${currentList.id} AND "deletedAt" IS NULL AND "archivedAt" IS NULL;
      `);
    } else {
      await tx.execute(sql`
        UPDATE card
        SET index = index + 1
        WHERE "listId" = ${newList?.id} AND index >= ${newIndex} AND "deletedAt" IS NULL AND "archivedAt" IS NULL;
      `);

      await tx.execute(sql`
        UPDATE card
        SET index = index - 1
        WHERE "listId" = ${currentList.id} AND index >= ${currentIndex} AND "deletedAt" IS NULL AND "archivedAt" IS NULL;
      `);

      await tx.execute(sql`
        UPDATE card
        SET "listId" = ${newList?.id}, index = ${newIndex}
        WHERE id = ${card.id} AND "deletedAt" IS NULL AND "archivedAt" IS NULL;
      `);
    }

    const countExpr = sql<number>`COUNT(*)`.mapWith(Number);

    const duplicateIndices = await tx
      .select({
        index: cards.index,
        count: countExpr,
      })
      .from(cards)
      .where(
        and(
          inArray(
            cards.listId,
            [currentList.id, newList?.id].filter((id) => id !== undefined),
          ),
          isNull(cards.deletedAt),
          isNull(cards.archivedAt),
        ),
      )
      .groupBy(cards.listId, cards.index)
      .having(gt(countExpr, 1));

    if (duplicateIndices.length > 0) {
      const affectedListIds = [currentList.id, newList?.id].filter(
        (id): id is number => id !== undefined,
      );

      if (affectedListIds.length === 1) {
        await tx.execute(sql`
          WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY "index", id) - 1 AS new_index
            FROM "card"
            WHERE "listId" = ${affectedListIds[0]} AND "deletedAt" IS NULL AND "archivedAt" IS NULL
          )
          UPDATE "card" c
          SET "index" = o.new_index
          FROM ordered o
          WHERE c.id = o.id;
        `);
      } else if (affectedListIds.length === 2) {
        await tx.execute(sql`
          WITH ordered AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY "listId" ORDER BY "index", id) - 1 AS new_index
            FROM "card"
            WHERE "listId" IN (${sql.join(affectedListIds, sql`,`)}) AND "deletedAt" IS NULL AND "archivedAt" IS NULL
          )
          UPDATE "card" c
          SET "index" = o.new_index
          FROM ordered o
          WHERE c.id = o.id;
        `);
      }

      const postFixDupes = await tx
        .select({ index: cards.index, count: countExpr })
        .from(cards)
        .where(
          and(inArray(cards.listId, affectedListIds), isNull(cards.deletedAt), isNull(cards.archivedAt)),
        )
        .groupBy(cards.listId, cards.index)
        .having(gt(countExpr, 1));

      if (postFixDupes.length > 0) {
        throw new Error(
          `Invariant violation: duplicate card indices remain after compaction for card ${card.id}`,
        );
      }
    }

    const updatedCard = await tx.query.cards.findFirst({
      columns: {
        id: true,
        publicId: true,
        title: true,
        description: true,
        dueDate: true,
      },
      where: eq(cards.id, card.id),
    });

    return updatedCard;
  });
};

export const softDelete = async (
  db: dbClient,
  args: {
    cardId: number;
    deletedAt: Date;
    deletedBy: string;
  },
) => {
  return db.transaction(async (tx) => {
    const [result] = await tx
      .update(cards)
      .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
      .where(eq(cards.id, args.cardId))
      .returning({
        id: cards.id,
        listId: cards.listId,
        index: cards.index,
      });

    if (!result)
      throw new Error(`Unable to soft delete card ID ${args.cardId}`);

    await tx.execute(sql`
      UPDATE card
      SET index = index - 1
      WHERE "listId" = ${result.listId} AND index > ${result.index} AND "deletedAt" IS NULL AND "archivedAt" IS NULL;
    `);

    const countExpr = sql<number>`COUNT(*)`.mapWith(Number);

    const duplicateIndices = await tx
      .select({
        index: cards.index,
        count: countExpr,
      })
      .from(cards)
      .where(and(eq(cards.listId, result.listId), isNull(cards.deletedAt), isNull(cards.archivedAt)))
      .groupBy(cards.listId, cards.index)
      .having(gt(countExpr, 1));

    if (duplicateIndices.length > 0) {
      throw new Error(
        `Duplicate indices found after soft deleting ${result.id}`,
      );
    }

    return result;
  });
};

export const softDeleteAllByListIds = async (
  db: dbClient,
  args: {
    listIds: number[];
    deletedAt: Date;
    deletedBy: string;
  },
) => {
  const updatedCards = await db
    .update(cards)
    .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
    .where(and(inArray(cards.listId, args.listIds), isNull(cards.deletedAt), isNull(cards.archivedAt)))
    .returning({
      id: cards.id,
    });

  return updatedCards;
};

export const hardDeleteCardLabelRelationship = async (
  db: dbClient,
  args: { cardId: number; labelId: number },
) => {
  const [result] = await db
    .delete(cardsToLabels)
    .where(
      and(
        eq(cardsToLabels.cardId, args.cardId),
        eq(cardsToLabels.labelId, args.labelId),
      ),
    )
    .returning();

  return result;
};

export const hardDeleteAllCardLabelRelationships = async (
  db: dbClient,
  labelId: number,
) => {
  const [result] = await db
    .delete(cardsToLabels)
    .where(eq(cardsToLabels.labelId, labelId))
    .returning();

  return result;
};

export const getCardIdByPublicId = async (
  db: dbClient,
  cardPublicId: string,
) => {
  const result = await db.query.cards.findFirst({
    columns: { id: true, createdBy: true },
    where: and(eq(cards.publicId, cardPublicId), isNull(cards.deletedAt), isNull(cards.archivedAt)),
    with: {
      list: {
        columns: {},
        with: {
          board: {
            columns: {
              visibility: true,
            },
          },
        },
      },
    },
  });

  return result
    ? {
        id: result.id,
        createdBy: result.createdBy,
        boardVisibility: result.list.board.visibility,
      }
    : null;
};

export const archive = async (
  db: dbClient,
  args: { cardId: number },
) => {
  return db.transaction(async (tx) => {
    const [result] = await tx
      .update(cards)
      .set({ archivedAt: new Date() })
      .where(and(eq(cards.id, args.cardId), isNull(cards.deletedAt), isNull(cards.archivedAt)))
      .returning({
        id: cards.id,
        listId: cards.listId,
        index: cards.index,
      });

    if (!result) throw new Error(`Unable to archive card ID ${args.cardId}`);

    await tx.execute(sql`
      UPDATE card
      SET index = index - 1
      WHERE "listId" = ${result.listId} AND index > ${result.index} AND "deletedAt" IS NULL AND "archivedAt" IS NULL;
    `);

    return result;
  });
};

export const unarchive = async (
  db: dbClient,
  args: { cardId: number; listId: number },
) => {
  return db.transaction(async (tx) => {
    const lastCard = await tx.query.cards.findFirst({
      columns: { index: true },
      where: and(eq(cards.listId, args.listId), isNull(cards.deletedAt), isNull(cards.archivedAt)),
      orderBy: desc(cards.index),
    });

    const newIndex = lastCard ? lastCard.index + 1 : 0;

    const [result] = await tx
      .update(cards)
      .set({ archivedAt: null, index: newIndex, listId: args.listId })
      .where(eq(cards.id, args.cardId))
      .returning({
        id: cards.id,
        publicId: cards.publicId,
        title: cards.title,
      });

    if (!result) throw new Error(`Unable to unarchive card ID ${args.cardId}`);

    return result;
  });
};

export const getArchivedByBoardId = async (
  db: dbClient,
  boardPublicId: string,
) => {
  const result = await db.query.cards.findMany({
    columns: {
      publicId: true,
      title: true,
      description: true,
      archivedAt: true,
    },
    with: {
      labels: {
        with: {
          label: {
            columns: {
              publicId: true,
              name: true,
              colourCode: true,
            },
          },
        },
      },
      list: {
        columns: {
          publicId: true,
          name: true,
        },
        with: {
          board: {
            columns: {
              publicId: true,
            },
          },
        },
      },
    },
    where: and(
      isNull(cards.deletedAt),
      sql`${cards.archivedAt} IS NOT NULL`,
    ),
    orderBy: desc(cards.archivedAt),
  });

  return result
    .filter((card) => card.list.board.publicId === boardPublicId)
    .map((card) => ({
      ...card,
      labels: card.labels.map((l) => l.label),
    }));
};
