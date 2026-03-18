import { NextResponse } from "next/server";
import { eq, and, isNull, gte, lte, inArray } from "drizzle-orm";
import { db } from "@openpims/db/client";
import {
  appointments,
  patients,
  clients,
  users,
  communications,
} from "@openpims/db";
import { sendAppointmentReminder } from "@/lib/email";

export async function GET(request: Request) {
  // Validate the cron secret to prevent unauthorized access
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find all upcoming appointments across all practices that are eligible for reminders
    const upcomingAppointments = await db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        practiceId: appointments.practiceId,
        patientName: patients.name,
        clientId: appointments.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        doctorName: users.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(
        and(
          isNull(appointments.deletedAt),
          gte(appointments.startTime, now),
          lte(appointments.startTime, in24h),
          inArray(appointments.status, ["scheduled", "confirmed"]),
        ),
      )
      .orderBy(appointments.startTime);

    let sent = 0;
    let failed = 0;

    for (const appt of upcomingAppointments) {
      if (!appt.clientEmail || !appt.clientId) {
        failed++;
        continue;
      }

      try {
        const startDate = new Date(appt.startTime);
        await sendAppointmentReminder({
          to: appt.clientEmail,
          clientName: `${appt.clientFirstName} ${appt.clientLastName}`,
          patientName: appt.patientName ?? "Unknown",
          appointmentDate: startDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          appointmentTime: startDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
          practiceName: "",
        });

        await db.insert(communications).values({
          practiceId: appt.practiceId,
          clientId: appt.clientId,
          channel: "email",
          direction: "outbound",
          subject: "Appointment Reminder",
          content: `Automated appointment reminder sent for ${appt.patientName} on ${appt.startTime.toISOString()}`,
          status: "sent",
        });

        sent++;
      } catch (error) {
        console.error(
          `Failed to send reminder for appointment ${appt.id}:`,
          error,
        );
        failed++;
      }
    }

    console.log(
      `Cron reminders completed: ${sent} sent, ${failed} failed out of ${upcomingAppointments.length} total`,
    );

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("Cron reminder job failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
