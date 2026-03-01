import { relations, sql } from "drizzle-orm";
import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { boards } from "./boards";
import { cards } from "./cards";
import { resourceItems, resourceLabels } from "./resource-items";
import { lists } from "./lists";
import { userApiKeys } from "./user-api-keys";

export const users = pgTable("user", {
  id: uuid("id").notNull().primaryKey().default(sql`uuid_generate_v4()`),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: varchar("image", { length: 255 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}).enableRLS();

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(userApiKeys),
  deletedBoards: many(boards, {
    relationName: "boardDeletedByUser",
  }),
  boards: many(boards, {
    relationName: "boardCreatedByUser",
  }),
  deletedCards: many(cards, {
    relationName: "cardsDeletedByUser",
  }),
  cards: many(cards, {
    relationName: "cardsCreatedByUser",
  }),
  deletedLists: many(lists, {
    relationName: "listsDeletedByUser",
  }),
  lists: many(lists, {
    relationName: "listsCreatedByUser",
  }),
  resourceItems: many(resourceItems, {
    relationName: "resourceItemsCreatedByUser",
  }),
  deletedResourceItems: many(resourceItems, {
    relationName: "resourceItemsDeletedByUser",
  }),
  resourceLabels: many(resourceLabels, {
    relationName: "resourceLabelsCreatedByUser",
  }),
  deletedResourceLabels: many(resourceLabels, {
    relationName: "resourceLabelsDeletedByUser",
  }),
}));
