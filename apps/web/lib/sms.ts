import Twilio from "twilio";

// ---------------------------------------------------------------------------
// Twilio client – initialised lazily so the module can be imported even when
// credentials are not set (local dev / CI).
// ---------------------------------------------------------------------------

let twilioClient: Twilio.Twilio | null = null;

function getTwilio(): Twilio.Twilio | null {
  if (twilioClient) return twilioClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  twilioClient = Twilio(accountSid, authToken);
  return twilioClient;
}

function getFromNumber(): string {
  return process.env.TWILIO_PHONE_NUMBER || "";
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

export async function sendSms(options: {
  to: string;
  body: string;
}): Promise<{ success: boolean; sid?: string; error?: string }> {
  const client = getTwilio();

  if (!client) {
    // Development fallback – log to console instead of sending
    console.log("──────────────────────────────────────────");
    console.log("[SMS] No Twilio credentials configured – logging SMS to console");
    console.log(`  To:   ${options.to}`);
    console.log(`  Body: ${options.body}`);
    console.log("──────────────────────────────────────────");
    return { success: true, sid: "dev-console" };
  }

  try {
    const message = await client.messages.create({
      to: options.to,
      from: getFromNumber(),
      body: options.body,
    });

    return { success: true, sid: message.sid };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown SMS error";
    console.error("[SMS] Twilio error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Appointment reminder SMS
// ---------------------------------------------------------------------------

export async function sendAppointmentReminderSms(data: {
  to: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  practiceName: string;
  practicePhone?: string;
}): Promise<{ success: boolean }> {
  const phoneInfo = data.practicePhone
    ? `Call ${data.practicePhone} to reschedule.`
    : "Contact us to reschedule.";

  const body = `Hi! Reminder: ${data.patientName} has an appointment on ${data.appointmentDate} at ${data.appointmentTime}. ${phoneInfo} - ${data.practiceName}`;

  const result = await sendSms({ to: data.to, body });
  return { success: result.success };
}

// ---------------------------------------------------------------------------
// Vaccination reminder SMS
// ---------------------------------------------------------------------------

export async function sendVaccinationReminderSms(data: {
  to: string;
  patientName: string;
  vaccineName: string;
  practiceName: string;
  practicePhone?: string;
}): Promise<{ success: boolean }> {
  const phoneInfo = data.practicePhone
    ? `Call ${data.practicePhone} to schedule.`
    : "Contact us to schedule.";

  const body = `Hi! ${data.patientName} is due for their ${data.vaccineName} vaccination. ${phoneInfo} - ${data.practiceName}`;

  const result = await sendSms({ to: data.to, body });
  return { success: result.success };
}
