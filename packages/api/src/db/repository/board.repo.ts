import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import { generateUID } from "../../lib/utils";
import type { dbClient } from "../client";
import type { BoardVisibilityStatus } from "../schema";
import {
  boards,
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
    .from(boards)
    .where(isNull(boards.deletedAt));

  return result[0]?.count ?? 0;
};

export const getAllByUserId = async (
  db: dbClient,
  userId: string,
  opts?: { type?: "regular" | "template" },
) => {
  const boardsData = await db.query.boards.findMany({
    columns: {
      publicId: true,
      name: true,
    },
    with: {
      lists: {
        columns: {
          publicId: true,
          name: true,
          index: true,
        },
        orderBy: [asc(lists.index)],
      },
      labels: {
        columns: {
          publicId: true,
          name: true,
          colourCode: true,
        },
      },
    },
    where: and(
      eq(boards.createdBy, userId),
      isNull(boards.deletedAt),
      opts?.type ? eq(boards.type, opts.type) : undefined,
    ),
  });

  return boardsData.sort((a, b) => a.name.localeCompare(b.name));
};

export const getIdByPublicId = async (db: dbClient, boardPublicId: string) => {
  const board = await db.query.boards.findFirst({
    columns: {
      id: true,
      type: true,
    },
    where: eq(boards.publicId, boardPublicId),
  });

  return board;
};

interface DueDateFilter {
  startDate?: Date;
  endDate?: Date;
  hasNoDueDate?: boolean;
}

const buildDueDateWhere = (filters: DueDateFilter[]) => {
  if (!filters.length) return undefined;

  const clauses = filters
    .map((filter) => {
      const conditions: ReturnType<typeof and>[] = [];

      if (filter.hasNoDueDate) {
        conditions.push(isNull(cards.dueDate));
      } else {
        conditions.push(isNotNull(cards.dueDate));

        if (filter.startDate)
          conditions.push(gte(cards.dueDate, filter.startDate));

        if (filter.endDate) conditions.push(lt(cards.dueDate, filter.endDate));
      }

      return conditions.length > 0 ? and(...conditions) : undefined;
    })
    .filter((clause): clause is NonNullable<typeof clause> => !!clause);

  if (!clauses.length) return undefined;

  return or(...clauses);
};

export const getByPublicId = async (
  db: dbClient,
  boardPublicId: string,
  _userId: string,
  filters: {
    members: string[];
    labels: string[];
    lists: string[];
    dueDate: DueDateFilter[];
    type: "regular" | "template" | undefined;
  },
) => {
  let cardIds: string[] = [];

  if (filters.labels.length > 0) {
    const filteredCards = await db
      .select({
        publicId: cards.publicId,
      })
      .from(cards)
      .leftJoin(cardsToLabels, eq(cards.id, cardsToLabels.cardId))
      .leftJoin(labels, eq(cardsToLabels.labelId, labels.id))
      .where(
        and(isNull(cards.deletedAt), inArray(labels.publicId, filters.labels)),
      );

    cardIds = filteredCards.map((card) => card.publicId);
  }

  const board = await db.query.boards.findFirst({
    columns: {
      publicId: true,
      name: true,
      slug: true,
      visibility: true,
    },
    with: {
      labels: {
        columns: {
          publicId: true,
          name: true,
          colourCode: true,
        },
        where: isNull(labels.deletedAt),
      },
      lists: {
        columns: {
          publicId: true,
          name: true,
          boardId: true,
          index: true,
        },
        with: {
          cards: {
            columns: {
              publicId: true,
              title: true,
              description: true,
              listId: true,
              index: true,
              dueDate: true,
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
            },
            where: and(
              cardIds.length > 0 ? inArray(cards.publicId, cardIds) : undefined,
              isNull(cards.deletedAt),
              isNull(cards.archivedAt),
              buildDueDateWhere(filters.dueDate),
            ),
            orderBy: [asc(cards.index)],
          },
        },
        where: and(
          isNull(lists.deletedAt),
          filters.lists.length > 0
            ? inArray(lists.publicId, filters.lists)
            : undefined,
        ),
        orderBy: [asc(lists.index)],
      },
      allLists: {
        columns: {
          publicId: true,
          name: true,
        },
        where: isNull(lists.deletedAt),
        orderBy: [asc(lists.index)],
      },
    },
    where: and(
      eq(boards.publicId, boardPublicId),
      isNull(boards.deletedAt),
      eq(boards.type, filters.type ?? "regular"),
    ),
  });

  if (!board) return null;

  const formattedResult = {
    ...board,
    lists: board.lists.map((list) => ({
      ...list,
      cards: list.cards.map((card) => ({
        ...card,
        labels: card.labels.map((label) => label.label),
      })),
    })),
  };

  return formattedResult;
};

export const getBySlug = async (
  db: dbClient,
  boardSlug: string,
  filters: {
    members: string[];
    labels: string[];
    lists: string[];
    dueDate: DueDateFilter[];
  },
) => {
  let cardIds: string[] = [];

  if (filters.labels.length) {
    const filteredCards = await db
      .select({
        publicId: cards.publicId,
      })
      .from(cards)
      .leftJoin(cardsToLabels, eq(cards.id, cardsToLabels.cardId))
      .leftJoin(labels, eq(cardsToLabels.labelId, labels.id))
      .where(
        and(
          isNull(cards.deletedAt),
          filters.labels.length > 0
            ? inArray(labels.publicId, filters.labels)
            : undefined,
        ),
      );

    cardIds = filteredCards.map((card) => card.publicId);
  }

  const board = await db.query.boards.findFirst({
    columns: {
      publicId: true,
      name: true,
      slug: true,
      visibility: true,
    },
    with: {
      labels: {
        columns: {
          publicId: true,
          name: true,
          colourCode: true,
        },
        where: isNull(labels.deletedAt),
      },
      lists: {
        columns: {
          publicId: true,
          name: true,
          boardId: true,
          index: true,
        },
        with: {
          cards: {
            columns: {
              publicId: true,
              title: true,
              description: true,
              listId: true,
              index: true,
              dueDate: true,
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
            },
            where: and(
              cardIds.length > 0 ? inArray(cards.publicId, cardIds) : undefined,
              isNull(cards.deletedAt),
              isNull(cards.archivedAt),
              buildDueDateWhere(filters.dueDate),
            ),
            orderBy: [asc(cards.index)],
          },
        },
        where: and(
          isNull(lists.deletedAt),
          filters.lists.length > 0
            ? inArray(lists.publicId, filters.lists)
            : undefined,
        ),
        orderBy: [asc(lists.index)],
      },
      allLists: {
        columns: {
          publicId: true,
          name: true,
        },
        where: isNull(lists.deletedAt),
        orderBy: [asc(lists.index)],
      },
    },
    where: and(
      eq(boards.slug, boardSlug),
      isNull(boards.deletedAt),
      eq(boards.visibility, "public"),
    ),
  });

  if (!board) return null;

  const formattedResult = {
    ...board,
    lists: board.lists.map((list) => ({
      ...list,
      cards: list.cards.map((card) => ({
        ...card,
        labels: card.labels.map((label) => label.label),
      })),
    })),
  };

  return formattedResult;
};

export const getWithListIdsByPublicId = (
  db: dbClient,
  boardPublicId: string,
) => {
  return db.query.boards.findFirst({
    columns: {
      id: true,
      createdBy: true,
    },
    with: {
      lists: {
        columns: {
          id: true,
        },
      },
    },
    where: eq(boards.publicId, boardPublicId),
  });
};

export const create = async (
  db: dbClient,
  boardInput: {
    publicId?: string;
    name: string;
    createdBy: string;
    slug: string;
    type?: "regular" | "template";
    sourceBoardId?: number;
  },
) => {
  const [result] = await db
    .insert(boards)
    .values({
      publicId: boardInput.publicId ?? generateUID(),
      name: boardInput.name,
      createdBy: boardInput.createdBy,
      slug: boardInput.slug,
      type: boardInput.type ?? "regular",
      sourceBoardId: boardInput.sourceBoardId,
    })
    .returning({
      id: boards.id,
      publicId: boards.publicId,
      name: boards.name,
    });

  return result;
};

export const update = async (
  db: dbClient,
  boardInput: {
    name: string | undefined;
    slug: string | undefined;
    visibility: BoardVisibilityStatus | undefined;
    boardPublicId: string;
  },
) => {
  const [result] = await db
    .update(boards)
    .set({
      name: boardInput.name,
      slug: boardInput.slug,
      visibility: boardInput.visibility,
      updatedAt: new Date(),
    })
    .where(eq(boards.publicId, boardInput.boardPublicId))
    .returning({
      publicId: boards.publicId,
      name: boards.name,
    });

  return result;
};

export const softDelete = async (
  db: dbClient,
  args: {
    boardId: number;
    deletedAt: Date;
    deletedBy: string;
  },
) => {
  const [result] = await db
    .update(boards)
    .set({ deletedAt: args.deletedAt, deletedBy: args.deletedBy })
    .where(and(eq(boards.id, args.boardId), isNull(boards.deletedAt)))
    .returning({
      publicId: boards.publicId,
      name: boards.name,
    });

  return result;
};

export const isSlugUnique = async (db: dbClient, args: { slug: string }) => {
  const result = await db.query.boards.findFirst({
    columns: {
      slug: true,
    },
    where: and(eq(boards.slug, args.slug), isNull(boards.deletedAt)),
  });

  return result === undefined;
};

export const getBoardIdByPublicId = async (
  db: dbClient,
  boardPublicId: string,
) => {
  const result = await db.query.boards.findFirst({
    columns: {
      id: true,
      createdBy: true,
    },
    where: eq(boards.publicId, boardPublicId),
  });

  return result;
};

export const isBoardSlugAvailable = async (db: dbClient, boardSlug: string) => {
  const result = await db.query.boards.findFirst({
    columns: {
      id: true,
    },
    where: and(eq(boards.slug, boardSlug), isNull(boards.deletedAt)),
  });

  return result === undefined;
};

export const createFromSnapshot = async (
  db: dbClient,
  args: {
    source: {
      name: string;
      labels: { publicId: string; name: string; colourCode: string | null }[];
      lists: {
        name: string;
        index: number;
        cards: {
          title: string;
          description: string | null;
          index: number;
          labels: {
            publicId: string;
            name: string;
            colourCode: string | null;
          }[];
          checklists?: {
            publicId: string;
            name: string;
            index: number;
            items: {
              publicId: string;
              title: string;
              completed: boolean;
              index: number;
            }[];
          }[];
        }[];
      }[];
    };
    createdBy: string;
    slug: string;
    name?: string;
    type: "regular" | "template";
    sourceBoardId?: number;
  },
) => {
  return db.transaction(async (tx) => {
    const [newBoard] = await tx
      .insert(boards)
      .values({
        publicId: generateUID(),
        name: args.name ?? args.source.name,
        slug: args.slug,
        createdBy: args.createdBy,
        type: args.type,
        sourceBoardId: args.sourceBoardId,
      })
      .returning({
        id: boards.id,
        publicId: boards.publicId,
        name: boards.name,
      });

    if (!newBoard) throw new Error("Failed to create board");

    const srcLabels = args.source.labels;
    const labelMap = new Map<string, number>();

    if (srcLabels.length) {
      const inserted = await tx
        .insert(labels)
        .values(
          srcLabels.map((l) => ({
            publicId: generateUID(),
            name: l.name,
            colourCode: l.colourCode ?? null,
            createdBy: args.createdBy,
            boardId: newBoard.id,
          })),
        )
        .returning({ id: labels.id });

      for (let i = 0; i < srcLabels.length; i++) {
        const src = srcLabels[i];
        if (!src) throw new Error("Source label not found");
        const created = inserted[i];
        if (created) labelMap.set(src.publicId, created.id);
      }
    }

    const listIndexToId = new Map<number, number>();
    const srcLists = [...args.source.lists].sort((a, b) => a.index - b.index);
    if (srcLists.length) {
      const insertedLists = await tx
        .insert(lists)
        .values(
          srcLists.map((list) => ({
            publicId: generateUID(),
            name: list.name,
            createdBy: args.createdBy,
            boardId: newBoard.id,
            index: list.index,
          })),
        )
        .returning({ id: lists.id, index: lists.index });

      for (const list of insertedLists) listIndexToId.set(list.index, list.id);
    }

    for (const list of srcLists) {
      const newListId = listIndexToId.get(list.index);
      if (!newListId) continue;
      const sortedCards = [...list.cards].sort((a, b) => a.index - b.index);

      for (const card of sortedCards) {
        const [createdCard] = await tx
          .insert(cards)
          .values({
            publicId: generateUID(),
            title: card.title,
            description: card.description ?? "",
            createdBy: args.createdBy,
            listId: newListId,
            index: card.index,
          })
          .returning({ id: cards.id });

        if (!createdCard) throw new Error("Failed to create card");

        if (card.labels.length) {
          const cardLabels: { cardId: number; labelId: number }[] = [];
          for (const label of card.labels) {
            const newLabelId = labelMap.get(label.publicId);
            if (newLabelId)
              cardLabels.push({ cardId: createdCard.id, labelId: newLabelId });
          }
          if (cardLabels.length) {
            await tx.insert(cardsToLabels).values(cardLabels);
          }
        }

        if (card.checklists?.length) {
          const sortedChecklists = [...card.checklists].sort(
            (a, b) => a.index - b.index,
          );
          for (const checklist of sortedChecklists) {
            const [createdChecklist] = await tx
              .insert(checklists)
              .values({
                publicId: generateUID(),
                name: checklist.name,
                createdBy: args.createdBy,
                cardId: createdCard.id,
                index: checklist.index,
              })
              .returning({ id: checklists.id });

            if (!createdChecklist) continue;

            if (checklist.items.length) {
              const itemValues = [...checklist.items]
                .sort((a, b) => a.index - b.index)
                .map((checklistItem) => ({
                  publicId: generateUID(),
                  title: checklistItem.title,
                  createdBy: args.createdBy,
                  checklistId: createdChecklist.id,
                  index: checklistItem.index,
                  completed: !!checklistItem.completed,
                }));

              if (itemValues.length) {
                await tx.insert(checklistItems).values(itemValues);
              }
            }
          }
        }
      }
    }

    return newBoard;
  });
};
