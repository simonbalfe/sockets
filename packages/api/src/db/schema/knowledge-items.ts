import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const knowledgeItemTypes = [
  "link",
  "creator",
  "tweet",
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "image",
  "video",
  "pdf",
  "audio",
  "other",
] as const;
export type KnowledgeItemType = (typeof knowledgeItemTypes)[number];
export const knowledgeItemTypeEnum = pgEnum(
  "knowledge_item_type",
  knowledgeItemTypes,
);

export const knowledgeItems = pgTable("knowledge_item", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicId: varchar("publicId", { length: 12 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: knowledgeItemTypeEnum("type").notNull().default("link"),
  url: text("url"),
  fileKey: text("fileKey"),
  fileSize: integer("fileSize"),
  mimeType: varchar("mimeType", { length: 255 }),
  createdBy: uuid("createdBy").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt"),
  deletedAt: timestamp("deletedAt"),
  deletedBy: uuid("deletedBy").references(() => users.id, {
    onDelete: "set null",
  }),
}).enableRLS();

export const knowledgeItemsRelations = relations(
  knowledgeItems,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [knowledgeItems.createdBy],
      references: [users.id],
      relationName: "knowledgeItemsCreatedByUser",
    }),
    deletedBy: one(users, {
      fields: [knowledgeItems.deletedBy],
      references: [users.id],
      relationName: "knowledgeItemsDeletedByUser",
    }),
    labels: many(knowledgeItemsToLabels),
  }),
);

export const knowledgeLabels = pgTable("knowledge_label", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicId: varchar("publicId", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  colourCode: varchar("colourCode", { length: 12 }),
  createdBy: uuid("createdBy").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt"),
  deletedAt: timestamp("deletedAt"),
  deletedBy: uuid("deletedBy").references(() => users.id, {
    onDelete: "set null",
  }),
}).enableRLS();

export const knowledgeLabelsRelations = relations(
  knowledgeLabels,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [knowledgeLabels.createdBy],
      references: [users.id],
      relationName: "knowledgeLabelsCreatedByUser",
    }),
    deletedBy: one(users, {
      fields: [knowledgeLabels.deletedBy],
      references: [users.id],
      relationName: "knowledgeLabelsDeletedByUser",
    }),
    items: many(knowledgeItemsToLabels),
  }),
);

export const knowledgeItemsToLabels = pgTable(
  "_knowledge_item_labels",
  {
    knowledgeItemId: bigint("knowledgeItemId", { mode: "number" })
      .notNull()
      .references(() => knowledgeItems.id, { onDelete: "cascade" }),
    knowledgeLabelId: bigint("knowledgeLabelId", { mode: "number" })
      .notNull()
      .references(() => knowledgeLabels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.knowledgeItemId, t.knowledgeLabelId] })],
).enableRLS();

export const knowledgeItemsToLabelsRelations = relations(
  knowledgeItemsToLabels,
  ({ one }) => ({
    knowledgeItem: one(knowledgeItems, {
      fields: [knowledgeItemsToLabels.knowledgeItemId],
      references: [knowledgeItems.id],
    }),
    knowledgeLabel: one(knowledgeLabels, {
      fields: [knowledgeItemsToLabels.knowledgeLabelId],
      references: [knowledgeLabels.id],
    }),
  }),
);
