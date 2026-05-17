import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email"),
  company: text("company"),
  phone: text("phone"),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leadMessages = pgTable("lead_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflows = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  type: text("type").notNull().default("lead_qualification"),
  status: text("status").notNull().default("active"),
  currentStep: text("current_step").notNull().default("message_received"),
  route: text("route"),
  lastMessageId: uuid("last_message_id").references(() => leadMessages.id),
  result: text("result"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflows.id),
  eventType: text("event_type").notNull(),
  step: text("step"),
  payload: text("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadsRelations = relations(leads, ({ many }) => ({
  messages: many(leadMessages),
  workflows: many(workflows),
}));

export const leadMessagesRelations = relations(leadMessages, ({ one }) => ({
  lead: one(leads, {
    fields: [leadMessages.leadId],
    references: [leads.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  lead: one(leads, {
    fields: [workflows.leadId],
    references: [leads.id],
  }),
  lastMessage: one(leadMessages, {
    fields: [workflows.lastMessageId],
    references: [leadMessages.id],
  }),
  events: many(workflowEvents),
}));

export const workflowEventsRelations = relations(workflowEvents, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowEvents.workflowId],
    references: [workflows.id],
  }),
}));
