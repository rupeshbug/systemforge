import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  message: text("message").notNull(),
  status: text("status").notNull().default("received"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
