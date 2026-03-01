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

export const resourceItemTypes = [
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
export type ResourceItemType = (typeof resourceItemTypes)[number];
export const resourceItemTypeEnum = pgEnum(
  "knowledge_item_type",
  resourceItemTypes,
);

export const resourceItems = pgTable("knowledge_item", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicId: varchar("publicId", { length: 12 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: resourceItemTypeEnum("type").notNull().default("link"),
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

export const resourceItemsRelations = relations(
  resourceItems,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [resourceItems.createdBy],
      references: [users.id],
      relationName: "resourceItemsCreatedByUser",
    }),
    deletedBy: one(users, {
      fields: [resourceItems.deletedBy],
      references: [users.id],
      relationName: "resourceItemsDeletedByUser",
    }),
    labels: many(resourceItemsToLabels),
  }),
);

export const resourceLabels = pgTable("knowledge_label", {
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

export const resourceLabelsRelations = relations(
  resourceLabels,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [resourceLabels.createdBy],
      references: [users.id],
      relationName: "resourceLabelsCreatedByUser",
    }),
    deletedBy: one(users, {
      fields: [resourceLabels.deletedBy],
      references: [users.id],
      relationName: "resourceLabelsDeletedByUser",
    }),
    items: many(resourceItemsToLabels),
  }),
);

export const resourceItemsToLabels = pgTable(
  "_knowledge_item_labels",
  {
    knowledgeItemId: bigint("knowledgeItemId", { mode: "number" })
      .notNull()
      .references(() => resourceItems.id, { onDelete: "cascade" }),
    knowledgeLabelId: bigint("knowledgeLabelId", { mode: "number" })
      .notNull()
      .references(() => resourceLabels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.knowledgeItemId, t.knowledgeLabelId] })],
).enableRLS();

export const resourceItemsToLabelsRelations = relations(
  resourceItemsToLabels,
  ({ one }) => ({
    resourceItem: one(resourceItems, {
      fields: [resourceItemsToLabels.knowledgeItemId],
      references: [resourceItems.id],
    }),
    resourceLabel: one(resourceLabels, {
      fields: [resourceItemsToLabels.knowledgeLabelId],
      references: [resourceLabels.id],
    }),
  }),
);
