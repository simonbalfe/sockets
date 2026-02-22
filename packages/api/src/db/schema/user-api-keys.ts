import { relations, sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const userApiKeys = pgTable("user_api_key", {
  id: uuid("id").notNull().primaryKey().default(sql`uuid_generate_v4()`),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [userApiKeys.userId],
    references: [users.id],
  }),
}));
