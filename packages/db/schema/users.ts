import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { locations } from "./practices";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "veterinarian",
  "technician",
  "front_desk",
]);

export const users = pgTable("users", {
  ...baseColumns(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("front_desk"),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id),
  locationId: uuid("location_id").references(() => locations.id),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  licenseNumber: varchar("license_number", { length: 64 }),
  phone: varchar("phone", { length: 32 }),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
});

export const usersRelations = relations(users, ({ one }) => ({
  practice: one(practices, {
    fields: [users.practiceId],
    references: [practices.id],
  }),
  location: one(locations, {
    fields: [users.locationId],
    references: [locations.id],
  }),
}));
