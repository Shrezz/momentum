import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const trainingStates = sqliteTable("training_states", {
  userId: text("user_id").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  week: text("week").notNull(),
  payload: text("payload").notNull(),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
