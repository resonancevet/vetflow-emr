import {
  pgTable,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { practices } from "./practices";

/** Per-practice counter for client display IDs (C0001, C0002, …). */
export const practiceClientSequences = pgTable("practice_client_sequences", {
  practiceId: uuid("practice_id")
    .primaryKey()
    .references(() => practices.id),
  /** Next sequence number to allocate (starts at 1). */
  nextSeq: integer("next_seq").notNull().default(1),
});

/** Per-practice counter for sequential invoice numbers (1, 2, 3, …). */
export const practiceInvoiceSequences = pgTable("practice_invoice_sequences", {
  practiceId: uuid("practice_id")
    .primaryKey()
    .references(() => practices.id),
  /** Next sequence number to allocate (starts at 1). */
  nextSeq: integer("next_seq").notNull().default(1),
});
