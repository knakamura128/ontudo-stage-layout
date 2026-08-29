import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull().unique(),
  schoolName: text("school_name").notNull(),
  programName: text("program_name").notNull(),
  performerTotal: integer("performer_total").notNull().default(0),
  status: text("status", { enum: ["draft", "submitted"] }).notNull().default("draft"),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
  submittedAt: text("submitted_at"),
});

export const submissionRevisions = sqliteTable("submission_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: integer("submission_id").notNull(),
  schoolName: text("school_name").notNull(),
  programName: text("program_name").notNull(),
  performerTotal: integer("performer_total").notNull().default(0),
  status: text("status", { enum: ["draft", "submitted"] }).notNull().default("draft"),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_submission_revisions_submission_id_created_at").on(table.submissionId, table.createdAt)]);
