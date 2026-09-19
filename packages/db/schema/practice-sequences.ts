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
