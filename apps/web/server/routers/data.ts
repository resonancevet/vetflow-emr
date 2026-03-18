import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  clients,
  patients,
  appointments,
  appointmentTypes,
  invoices,
  invoiceItems,
  users,
} from "@openpims/db";

const adminProcedure = protectedProcedure.use(requireRole("admin"));

export const dataRouter = createRouter({
  // ── Export ──────────────────────────────────────────────────

  exportClients: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        address: clients.address,
        city: clients.city,
        state: clients.state,
        zip: clients.zip,
        emergencyContact: clients.emergencyContact,
        emergencyPhone: clients.emergencyPhone,
        preferredContactMethod: clients.preferredContactMethod,
        notes: clients.notes,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(
        and(
          eq(clients.practiceId, ctx.practiceId),
          isNull(clients.deletedAt)
        )
      );
    return rows;
  }),

  exportPatients: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        name: patients.name,
        species: patients.species,
        breed: patients.breed,
        sex: patients.sex,
        dob: patients.dob,
        color: patients.color,
        microchipNumber: patients.microchipNumber,
        status: patients.status,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .innerJoin(clients, eq(patients.clientId, clients.id))
      .where(
        and(
          eq(patients.practiceId, ctx.practiceId),
          isNull(patients.deletedAt)
        )
      );
    return rows;
  }),

  exportAppointments: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        notes: appointments.notes,
        patientName: patients.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        doctorName: users.name,
        appointmentType: appointmentTypes.name,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt)
        )
      );
    return rows;
  }),

  exportInvoices: adminProcedure.query(async ({ ctx }) => {
    const invoiceRows = await ctx.db
      .select({
        invoiceId: invoices.id,
        status: invoices.status,
        subtotal: invoices.subtotal,
        tax: invoices.tax,
        total: invoices.total,
        paidAmount: invoices.paidAmount,
        dueDate: invoices.dueDate,
        isEstimate: invoices.isEstimate,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        patientName: patients.name,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(clients, eq(invoices.clientId, clients.id))
      .leftJoin(patients, eq(invoices.patientId, patients.id))
      .where(
        and(
          eq(invoices.practiceId, ctx.practiceId),
          isNull(invoices.deletedAt)
        )
      );

    // Fetch items for each invoice
    const invoiceIds = invoiceRows.map((r) => r.invoiceId);
    let itemsByInvoice: Record<string, { description: string; quantity: number; unitPrice: string; total: string }[]> = {};

    if (invoiceIds.length > 0) {
      const allItems = await ctx.db
        .select({
          invoiceId: invoiceItems.invoiceId,
          description: invoiceItems.description,
          quantity: invoiceItems.quantity,
          unitPrice: invoiceItems.unitPrice,
          total: invoiceItems.total,
        })
        .from(invoiceItems)
        .where(isNull(invoiceItems.deletedAt));

      for (const item of allItems) {
        if (invoiceIds.includes(item.invoiceId)) {
          if (!itemsByInvoice[item.invoiceId]) {
            itemsByInvoice[item.invoiceId] = [];
          }
          itemsByInvoice[item.invoiceId].push({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          });
        }
      }
    }

    return invoiceRows.map((row) => ({
      ...row,
      items: itemsByInvoice[row.invoiceId] ?? [],
    }));
  }),

  // ── Import ──────────────────────────────────────────────────

  importClients: adminProcedure
    .input(
      z.object({
        clients: z.array(
          z.object({
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            email: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            zip: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.clients.length === 0) {
        return { imported: 0 };
      }

      const toInsert = input.clients.map((c) => ({
        practiceId: ctx.practiceId,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email || null,
        phone: c.phone || null,
        address: c.address || null,
        city: c.city || null,
        state: c.state || null,
        zip: c.zip || null,
      }));

      await ctx.db.insert(clients).values(toInsert);

      return { imported: toInsert.length };
    }),

  importPatients: adminProcedure
    .input(
      z.object({
        patients: z.array(
          z.object({
            clientEmail: z.string().min(1),
            name: z.string().min(1),
            species: z.enum([
              "canine",
              "feline",
              "avian",
              "rabbit",
              "reptile",
              "equine",
              "other",
            ]),
            breed: z.string().optional(),
            sex: z
              .enum(["male", "female", "male_neutered", "female_spayed"])
              .optional(),
            dob: z.string().optional(),
            color: z.string().optional(),
            microchipNumber: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.patients.length === 0) {
        return { imported: 0, errors: [] as string[] };
      }

      // Look up all unique client emails
      const uniqueEmails = [
        ...new Set(input.patients.map((p) => p.clientEmail)),
      ];
      const clientRows = await ctx.db
        .select({ id: clients.id, email: clients.email })
        .from(clients)
        .where(
          and(
            eq(clients.practiceId, ctx.practiceId),
            isNull(clients.deletedAt)
          )
        );

      const emailToClientId: Record<string, string> = {};
      for (const c of clientRows) {
        if (c.email) {
          emailToClientId[c.email.toLowerCase()] = c.id;
        }
      }

      const toInsert: {
        practiceId: string;
        clientId: string;
        name: string;
        species: "canine" | "feline" | "avian" | "rabbit" | "reptile" | "equine" | "other";
        breed: string | null;
        sex: "male" | "female" | "male_neutered" | "female_spayed" | null;
        dob: string | null;
        color: string | null;
        microchipNumber: string | null;
      }[] = [];
      const errors: string[] = [];

      for (let i = 0; i < input.patients.length; i++) {
        const p = input.patients[i];
        const clientId = emailToClientId[p.clientEmail.toLowerCase()];
        if (!clientId) {
          errors.push(
            `Row ${i + 1}: No client found with email "${p.clientEmail}"`
          );
          continue;
        }
        toInsert.push({
          practiceId: ctx.practiceId,
          clientId,
          name: p.name,
          species: p.species,
          breed: p.breed || null,
          sex: p.sex || null,
          dob: p.dob || null,
          color: p.color || null,
          microchipNumber: p.microchipNumber || null,
        });
      }

      if (toInsert.length > 0) {
        await ctx.db.insert(patients).values(toInsert);
      }

      return { imported: toInsert.length, errors };
    }),
});
