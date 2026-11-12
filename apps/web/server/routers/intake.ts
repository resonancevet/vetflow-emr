import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createRouter,
  protectedProcedure,
  publicProcedure,
  requireRole,
} from "../trpc";
import {
  clients,
  patients,
  patientAllergies,
  patientAlerts,
  practices,
  intakeInvites,
  intakeSubmissions,
  intakeSignatures,
  type IntakeHistoryPayload,
} from "@openpims/db";
import {
  allocateClientDisplayId,
  allocatePatientDisplayId,
} from "../lib/display-ids";
import {
  buildIntakeInviteUrl,
  generateIntakeInviteToken,
  generatePortalAccessToken,
  hashIntakeInviteToken,
  INTAKE_INVITE_TTL_MS,
} from "@/lib/portal-token";
import { sendIntakeInviteEmail } from "@/lib/email";
import { getEmailTemplatesFromSettings } from "@/lib/email-templates";
import {
  INTAKE_AGREEMENT_SECTIONS,
  INTAKE_AGREEMENT_TITLE,
  INTAKE_AGREEMENT_VERSION,
  INTAKE_MEDIA_CONSENT_TEXT,
} from "@/lib/intake-agreement";
import { rateLimit } from "@/lib/rate-limit";

const contactMethodSchema = z.enum(["phone", "email", "sms", "portal"]);

const speciesSchema = z.enum([
  "canine",
  "feline",
  "avian",
  "rabbit",
  "reptile",
  "equine",
  "other",
]);

const sexSchema = z.enum([
  "male",
  "female",
  "male_neutered",
  "female_spayed",
]);

const signatureSchema = z.object({
  section: z.enum(["agreement", "media", "registration"]),
  method: z.enum(["typed", "drawn"]),
  typedName: z.string().max(255).optional(),
  signatureData: z.string().max(200_000).optional(),
  signedAt: z.coerce.date().optional(),
});

const petSchema = z.object({
  name: z.string().min(1).max(128),
  species: speciesSchema,
  breed: z.string().max(128).optional(),
  color: z.string().max(64).optional(),
  sex: sexSchema.optional(),
  dob: z.string().optional(), // YYYY-MM-DD
  ageAsOfToday: z.string().max(64).optional(),
  microchipNumber: z.string().max(64).optional(),
  vaccinationHistory: z.string().max(5000).optional(),
  allergiesText: z.string().max(2000).optional(),
  currentMedications: z.string().max(2000).optional(),
  diet: z.string().max(2000).optional(),
  previousVeterinarian: z.string().max(500).optional(),
  pastIllnessesSurgeries: z.string().max(5000).optional(),
  behavioralConcerns: z.string().max(5000).optional(),
});

const clientRegistrationSchema = z.object({
  firstName: z.string().min(1).max(128),
  lastName: z.string().min(1).max(128),
  email: z.string().email().max(255),
  phone: z.string().max(32).optional(),
  phoneSecondary: z.string().max(32).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(128).optional(),
  state: z.string().max(64).optional(),
  zip: z.string().max(16).optional(),
  emergencyContact: z.string().max(255).optional(),
  emergencyPhone: z.string().max(32).optional(),
  preferredContactMethod: contactMethodSchema.optional(),
});

function splitAllergyLines(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^none$/i.test(s) && !/^n\/?a$/i.test(s));
}

async function getInviteByRawToken(db: any, rawToken: string) {
  const tokenHash = hashIntakeInviteToken(rawToken);
  const [invite] = await db
    .select()
    .from(intakeInvites)
    .where(
      and(eq(intakeInvites.tokenHash, tokenHash), isNull(intakeInvites.deletedAt))
    )
    .limit(1);

  if (!invite) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This intake link is invalid or has expired",
    });
  }
  if (invite.consumedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This intake form has already been submitted",
    });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This intake link has expired. Please ask the clinic to resend it.",
    });
  }
  return invite;
}

export const intakeRouter = createRouter({
  getAgreementCopy: publicProcedure.query(() => ({
    version: INTAKE_AGREEMENT_VERSION,
    title: INTAKE_AGREEMENT_TITLE,
    sections: INTAKE_AGREEMENT_SECTIONS,
    mediaConsentText: INTAKE_MEDIA_CONSENT_TEXT,
  })),

  getInvite: publicProcedure
    .input(z.object({ token: z.string().min(16).max(128) }))
    .query(async ({ ctx, input }) => {
      const invite = await getInviteByRawToken(ctx.db, input.token);

      const [client] = await ctx.db
        .select({
          id: clients.id,
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
        })
        .from(clients)
        .where(
          and(eq(clients.id, invite.clientId), isNull(clients.deletedAt))
        )
        .limit(1);

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found for this invite",
        });
      }

      const [practice] = await ctx.db
        .select({ name: practices.name })
        .from(practices)
        .where(eq(practices.id, invite.practiceId))
        .limit(1);

      return {
        email: invite.email,
        expiresAt: invite.expiresAt,
        practiceName: practice?.name ?? "Your veterinary clinic",
        client,
        agreement: {
          version: INTAKE_AGREEMENT_VERSION,
          title: INTAKE_AGREEMENT_TITLE,
          sections: INTAKE_AGREEMENT_SECTIONS,
          mediaConsentText: INTAKE_MEDIA_CONSENT_TEXT,
        },
      };
    }),

  createInvite: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        clientId: z.string().uuid(),
        email: z.string().email().optional(),
        appointmentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [client] = await ctx.db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.practiceId, ctx.practiceId),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);

      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      const email = (input.email ?? client.email ?? "").trim().toLowerCase();
      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client needs an email address to send the intake invite",
        });
      }

      if (!client.email) {
        await ctx.db
          .update(clients)
          .set({ email, updatedAt: new Date() })
          .where(eq(clients.id, client.id));
      }

      const rawToken = generateIntakeInviteToken();
      const tokenHash = hashIntakeInviteToken(rawToken);
      const expiresAt = new Date(Date.now() + INTAKE_INVITE_TTL_MS);

      const [invite] = await ctx.db
        .insert(intakeInvites)
        .values({
          practiceId: ctx.practiceId,
          clientId: client.id,
          email,
          tokenHash,
          expiresAt,
          appointmentId: input.appointmentId ?? null,
          invitedBy: ctx.user.id,
        })
        .returning();

      const [practice] = await ctx.db
        .select({
          name: practices.name,
          phone: practices.phone,
          address: practices.address,
          settings: practices.settings,
        })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const templates = getEmailTemplatesFromSettings(
        practice?.settings as Record<string, unknown> | null
      );
      const intakeUrl = buildIntakeInviteUrl(rawToken);
      const expiresInDays = Math.round(INTAKE_INVITE_TTL_MS / (24 * 60 * 60 * 1000));

      const result = await sendIntakeInviteEmail(
        {
          to: email,
          clientName: `${client.firstName} ${client.lastName}`,
          practiceName: practice?.name ?? "Your veterinary clinic",
          practicePhone: practice?.phone ?? undefined,
          practiceAddress: practice?.address ?? undefined,
          intakeUrl,
          expiresInDays,
        },
        templates.intakeInvite
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Failed to send intake invite email",
        });
      }

      return {
        inviteId: invite!.id,
        email,
        expiresAt,
        intakeUrl,
        emailId: result.id ?? null,
      };
    }),

  getClientIntakeStatus: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [latestInvite] = await ctx.db
        .select({
          id: intakeInvites.id,
          email: intakeInvites.email,
          expiresAt: intakeInvites.expiresAt,
          consumedAt: intakeInvites.consumedAt,
          createdAt: intakeInvites.createdAt,
        })
        .from(intakeInvites)
        .where(
          and(
            eq(intakeInvites.clientId, input.clientId),
            eq(intakeInvites.practiceId, ctx.practiceId),
            isNull(intakeInvites.deletedAt)
          )
        )
        .orderBy(desc(intakeInvites.createdAt))
        .limit(1);

      const [latestSubmission] = await ctx.db
        .select({
          id: intakeSubmissions.id,
          submittedAt: intakeSubmissions.submittedAt,
          agreementVersion: intakeSubmissions.agreementVersion,
          mediaConsent: intakeSubmissions.mediaConsent,
        })
        .from(intakeSubmissions)
        .where(
          and(
            eq(intakeSubmissions.clientId, input.clientId),
            eq(intakeSubmissions.practiceId, ctx.practiceId),
            isNull(intakeSubmissions.deletedAt)
          )
        )
        .orderBy(desc(intakeSubmissions.submittedAt))
        .limit(1);

      let status: "not_sent" | "pending" | "completed" | "expired" = "not_sent";
      if (latestSubmission) {
        status = "completed";
      } else if (latestInvite) {
        if (latestInvite.consumedAt) status = "completed";
        else if (latestInvite.expiresAt.getTime() < Date.now()) status = "expired";
        else status = "pending";
      }

      return {
        status,
        latestInvite: latestInvite ?? null,
        latestSubmission: latestSubmission ?? null,
      };
    }),

  getSubmission: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [submission] = await ctx.db
        .select()
        .from(intakeSubmissions)
        .where(
          and(
            eq(intakeSubmissions.clientId, input.clientId),
            eq(intakeSubmissions.practiceId, ctx.practiceId),
            isNull(intakeSubmissions.deletedAt)
          )
        )
        .orderBy(desc(intakeSubmissions.submittedAt))
        .limit(1);

      if (!submission) return null;

      const signatures = await ctx.db
        .select()
        .from(intakeSignatures)
        .where(
          and(
            eq(intakeSignatures.submissionId, submission.id),
            isNull(intakeSignatures.deletedAt)
          )
        );

      return { ...submission, signatures };
    }),

  submit: publicProcedure
    .input(
      z.object({
        token: z.string().min(16).max(128),
        client: clientRegistrationSchema,
        mediaConsent: z.boolean(),
        pets: z.array(petSchema).min(1).max(12),
        signatures: z.array(signatureSchema).min(2).max(6),
        userAgent: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rl = rateLimit({
        key: `intake-submit:${ctx.ipAddress ?? "unknown"}`,
        limit: 10,
        windowMs: 60_000,
      });
      if (!rl.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many submissions. Please try again shortly.",
        });
      }

      const invite = await getInviteByRawToken(ctx.db, input.token);

      const agreementSig = input.signatures.find((s) => s.section === "agreement");
      const mediaSig = input.signatures.find((s) => s.section === "media");
      const registrationSig = input.signatures.find(
        (s) => s.section === "registration"
      );
      if (!agreementSig || !mediaSig) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Agreement and media consent signatures are required",
        });
      }
      for (const sig of [agreementSig, mediaSig, registrationSig].filter(Boolean)) {
        if (sig!.method === "typed" && !sig!.typedName?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Typed signature requires a printed name",
          });
        }
        if (sig!.method === "drawn" && !sig!.signatureData?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Drawn signature is empty",
          });
        }
      }

      const [existingClient] = await ctx.db
        .select()
        .from(clients)
        .where(
          and(eq(clients.id, invite.clientId), isNull(clients.deletedAt))
        )
        .limit(1);

      if (!existingClient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found",
        });
      }

      const notesParts: string[] = [];
      if (existingClient.notes?.trim()) notesParts.push(existingClient.notes.trim());
      if (input.client.phoneSecondary?.trim()) {
        notesParts.push(`Secondary phone: ${input.client.phoneSecondary.trim()}`);
      }

      let accessToken = existingClient.accessToken;
      if (!accessToken) {
        accessToken = generatePortalAccessToken();
      }

      let displayId = existingClient.displayId;
      if (!displayId) {
        displayId = await allocateClientDisplayId(ctx.db, invite.practiceId);
      }

      await ctx.db
        .update(clients)
        .set({
          firstName: input.client.firstName.trim(),
          lastName: input.client.lastName.trim(),
          email: input.client.email.trim().toLowerCase(),
          phone: input.client.phone?.trim() || existingClient.phone,
          address: input.client.address?.trim() || null,
          city: input.client.city?.trim() || null,
          state: input.client.state?.trim() || null,
          zip: input.client.zip?.trim() || null,
          emergencyContact: input.client.emergencyContact?.trim() || null,
          emergencyPhone: input.client.emergencyPhone?.trim() || null,
          preferredContactMethod:
            input.client.preferredContactMethod ??
            existingClient.preferredContactMethod ??
            "email",
          notes: notesParts.length ? notesParts.join("\n") : existingClient.notes,
          accessToken,
          displayId,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, existingClient.id));

      const createdPatientIds: string[] = [];

      for (const pet of input.pets) {
        const patientDisplayId = await allocatePatientDisplayId(
          ctx.db,
          invite.practiceId,
          existingClient.id
        );

        const intakeHistory: IntakeHistoryPayload = {
          vaccinationHistory: pet.vaccinationHistory?.trim() || undefined,
          allergiesText: pet.allergiesText?.trim() || undefined,
          currentMedications: pet.currentMedications?.trim() || undefined,
          diet: pet.diet?.trim() || undefined,
          previousVeterinarian: pet.previousVeterinarian?.trim() || undefined,
          pastIllnessesSurgeries: pet.pastIllnessesSurgeries?.trim() || undefined,
          behavioralConcerns: pet.behavioralConcerns?.trim() || undefined,
          ageAsOfToday: pet.ageAsOfToday?.trim() || undefined,
        };

        const [patient] = await ctx.db
          .insert(patients)
          .values({
            practiceId: invite.practiceId,
            clientId: existingClient.id,
            name: pet.name.trim(),
            species: pet.species,
            breed: pet.breed?.trim() || null,
            color: pet.color?.trim() || null,
            sex: pet.sex ?? null,
            dob: pet.dob?.trim() || null,
            microchipNumber: pet.microchipNumber?.trim() || null,
            intakeHistory,
            displayId: patientDisplayId,
            status: "active",
          })
          .returning({ id: patients.id });

        createdPatientIds.push(patient!.id);

        for (const allergen of splitAllergyLines(pet.allergiesText)) {
          await ctx.db.insert(patientAllergies).values({
            patientId: patient!.id,
            allergen: allergen.slice(0, 255),
            severity: "moderate",
          });
        }

        if (pet.behavioralConcerns?.trim()) {
          await ctx.db.insert(patientAlerts).values({
            practiceId: invite.practiceId,
            patientId: patient!.id,
            type: "behavior",
            severity: "warning",
            title: "Behavioral concerns (intake)",
            notes: pet.behavioralConcerns.trim().slice(0, 4000),
          });
        }
      }

      const [submission] = await ctx.db
        .insert(intakeSubmissions)
        .values({
          practiceId: invite.practiceId,
          inviteId: invite.id,
          clientId: existingClient.id,
          agreementVersion: INTAKE_AGREEMENT_VERSION,
          mediaConsent: input.mediaConsent,
          payload: {
            client: input.client,
            pets: input.pets,
            mediaConsent: input.mediaConsent,
          },
          submittedAt: new Date(),
          ipAddress: ctx.ipAddress,
          userAgent: input.userAgent ?? null,
        })
        .returning();

      for (const sig of input.signatures) {
        await ctx.db.insert(intakeSignatures).values({
          submissionId: submission!.id,
          section: sig.section,
          method: sig.method,
          typedName: sig.typedName?.trim() || null,
          signatureData: sig.signatureData || null,
          signedAt: sig.signedAt ?? new Date(),
        });
      }

      await ctx.db
        .update(intakeInvites)
        .set({ consumedAt: new Date(), updatedAt: new Date() })
        .where(eq(intakeInvites.id, invite.id));

      return {
        ok: true as const,
        clientId: existingClient.id,
        patientIds: createdPatientIds,
        portalUrl: `/portal/${accessToken}`,
        submissionId: submission!.id,
      };
    }),
});
