import { Resend } from "resend";
import {
  bodyToHtml,
  ctaButtonHtml,
  DEFAULT_EMAIL_TEMPLATES,
  infoCardHtml,
  subjectFromTemplate,
  type EmailTemplateContent,
} from "@/lib/email-templates";

// ---------------------------------------------------------------------------
// Resend client – initialised lazily so the module can be imported even when
// RESEND_API_KEY is not set (local dev / CI).
// ---------------------------------------------------------------------------
let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  resend = new Resend(apiKey);
  return resend;
}

/** Prefer EMAIL_FROM (e.g. "NH Mobile Vet <noreply@mail.nhmobilevet.com>"). */
function getDefaultFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "noreply@openpims.dev";
}

// ---------------------------------------------------------------------------
// Shared layout helpers
// ---------------------------------------------------------------------------

function emailLayout(practiceName: string, body: string, footer?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${practiceName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0d9488;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.01em;">${practiceName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              ${footer || `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">This email was sent by ${practiceName}. If you received this in error, please disregard it.</p>`}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function practiceFooter(opts: { practiceName: string; practicePhone?: string; practiceAddress?: string }): string {
  const lines: string[] = [];
  lines.push(opts.practiceName);
  if (opts.practicePhone) lines.push(opts.practicePhone);
  if (opts.practiceAddress) lines.push(opts.practiceAddress);
  return `<p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">${lines.join("<br/>")}</p>`;
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = getResend();
  const from = options.from || getDefaultFrom();

  if (!client) {
    console.error(
      "[Email] RESEND_API_KEY is not available in this process – email was NOT sent.",
      { to: options.to, from, subject: options.subject }
    );
    return {
      success: false,
      error:
        "RESEND_API_KEY is not configured on the server. Add it to the repo-root .env and restart pnpm dev (or set it in Vercel env and redeploy).",
    };
  }

  try {
    console.log("[Email] Sending via Resend", {
      to: options.to,
      from,
      subject: options.subject,
    });
    const { data, error } = await client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log("[Email] Resend accepted", { id: data?.id });
    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    console.error("[Email] Exception:", message);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Appointment reminder
// ---------------------------------------------------------------------------

export async function sendAppointmentReminder(
  data: {
    to: string;
    clientName: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    practiceName: string;
    practicePhone?: string;
    practiceAddress?: string;
  },
  template: EmailTemplateContent = DEFAULT_EMAIL_TEMPLATES.appointmentReminder
): Promise<{ success: boolean; error?: string; id?: string }> {
  const textVars = {
    clientName: data.clientName,
    patientName: data.patientName,
    appointmentDate: data.appointmentDate,
    appointmentTime: data.appointmentTime,
    practiceName: data.practiceName,
    practicePhone: data.practicePhone ?? "",
  };
  const htmlVars = {
    appointmentCard: infoCardHtml(
      [
        { label: "Date", value: data.appointmentDate },
        { label: "Time", value: data.appointmentTime },
      ],
      "teal"
    ),
  };
  const body = bodyToHtml(template.body, textVars, htmlVars);
  const html = emailLayout(
    data.practiceName,
    body,
    practiceFooter({
      practiceName: data.practiceName,
      practicePhone: data.practicePhone,
      practiceAddress: data.practiceAddress,
    })
  );

  const result = await sendEmail({
    to: data.to,
    subject: subjectFromTemplate(template.subject, textVars),
    html,
  });

  return { success: result.success, error: result.error, id: result.id };
}

// ---------------------------------------------------------------------------
// Appointment confirmation (portal request approved)
// ---------------------------------------------------------------------------

export async function sendAppointmentConfirmation(
  data: {
    to: string;
    clientName: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    practiceName: string;
    practicePhone?: string;
    practiceAddress?: string;
  },
  template: EmailTemplateContent = DEFAULT_EMAIL_TEMPLATES.appointmentConfirmation
): Promise<{ success: boolean; error?: string; id?: string }> {
  const textVars = {
    clientName: data.clientName,
    patientName: data.patientName,
    appointmentDate: data.appointmentDate,
    appointmentTime: data.appointmentTime,
    practiceName: data.practiceName,
    practicePhone: data.practicePhone ?? "",
  };
  const htmlVars = {
    appointmentCard: infoCardHtml(
      [
        { label: "Date", value: data.appointmentDate },
        { label: "Time", value: data.appointmentTime },
      ],
      "teal"
    ),
  };
  const body = bodyToHtml(template.body, textVars, htmlVars);
  const html = emailLayout(
    data.practiceName,
    body,
    practiceFooter({
      practiceName: data.practiceName,
      practicePhone: data.practicePhone,
      practiceAddress: data.practiceAddress,
    })
  );

  const result = await sendEmail({
    to: data.to,
    subject: subjectFromTemplate(template.subject, textVars),
    html,
  });

  return { success: result.success, error: result.error, id: result.id };
}

// ---------------------------------------------------------------------------
// Appointment request declined / unavailable
// ---------------------------------------------------------------------------

export async function sendAppointmentRequestDeclined(
  data: {
    to: string;
    clientName: string;
    patientName: string;
    preferredDate?: string | null;
    preferredTime?: string | null;
    staffMessage: string;
    practiceName: string;
    practicePhone?: string;
    practiceAddress?: string;
  },
  template: EmailTemplateContent = DEFAULT_EMAIL_TEMPLATES.appointmentRequestDeclined
): Promise<{ success: boolean; error?: string; id?: string }> {
  const preferredDate = data.preferredDate?.trim() || "";
  const preferredTime = data.preferredTime?.trim() || "";
  const requestRows: { label: string; value: string }[] = [];
  if (preferredDate) {
    requestRows.push({ label: "Preferred date", value: preferredDate });
  }
  if (preferredTime) {
    requestRows.push({ label: "Preferred time", value: preferredTime });
  }

  const textVars = {
    clientName: data.clientName,
    patientName: data.patientName,
    preferredDate,
    preferredTime,
    staffMessage: data.staffMessage,
    practiceName: data.practiceName,
    practicePhone: data.practicePhone ?? "",
  };
  const htmlVars = {
    requestCard:
      requestRows.length > 0 ? infoCardHtml(requestRows, "amber") : "",
  };
  const body = bodyToHtml(template.body, textVars, htmlVars);
  const html = emailLayout(
    data.practiceName,
    body,
    practiceFooter({
      practiceName: data.practiceName,
      practicePhone: data.practicePhone,
      practiceAddress: data.practiceAddress,
    })
  );

  const result = await sendEmail({
    to: data.to,
    subject: subjectFromTemplate(template.subject, textVars),
    html,
  });

  return { success: result.success, error: result.error, id: result.id };
}

// ---------------------------------------------------------------------------
// Vaccination reminder
// ---------------------------------------------------------------------------

export async function sendVaccinationReminder(
  data: {
    to: string;
    clientName: string;
    patientName: string;
    vaccineName: string;
    dueDate: string;
    practiceName: string;
    practicePhone?: string;
  },
  template: EmailTemplateContent = DEFAULT_EMAIL_TEMPLATES.vaccinationReminder
): Promise<{ success: boolean; error?: string; id?: string }> {
  const textVars = {
    clientName: data.clientName,
    patientName: data.patientName,
    vaccineName: data.vaccineName,
    dueDate: data.dueDate,
    practiceName: data.practiceName,
    practicePhone: data.practicePhone ?? "",
  };
  const htmlVars = {
    vaccineCard: infoCardHtml(
      [
        { label: "Vaccine", value: data.vaccineName },
        { label: "Due Date", value: data.dueDate },
      ],
      "amber"
    ),
    callButton: ctaButtonHtml(
      "Schedule Your Pet's Appointment",
      data.practicePhone ? `tel:${data.practicePhone}` : ""
    ),
  };
  const body = bodyToHtml(template.body, textVars, htmlVars);
  const html = emailLayout(
    data.practiceName,
    body,
    practiceFooter({
      practiceName: data.practiceName,
      practicePhone: data.practicePhone,
    })
  );

  const result = await sendEmail({
    to: data.to,
    subject: subjectFromTemplate(template.subject, textVars),
    html,
  });

  return { success: result.success, error: result.error, id: result.id };
}

// ---------------------------------------------------------------------------
// Invoice email
// ---------------------------------------------------------------------------

export async function sendInvoiceEmail(
  data: {
    to: string;
    clientName: string;
    patientName?: string;
    invoiceTotal: string;
    dueDate?: string;
    portalUrl?: string;
    practiceName: string;
    practicePhone?: string;
  },
  template: EmailTemplateContent = DEFAULT_EMAIL_TEMPLATES.invoiceEmail
): Promise<{ success: boolean; error?: string; id?: string }> {
  const invoiceRows: { label: string; value: string; large?: boolean }[] = [
    { label: "Amount Due", value: data.invoiceTotal, large: true },
  ];
  if (data.dueDate) {
    invoiceRows.push({ label: "Due Date", value: data.dueDate });
  }

  const textVars = {
    clientName: data.clientName,
    patientName: data.patientName ?? "",
    invoiceTotal: data.invoiceTotal,
    dueDate: data.dueDate ?? "",
    practiceName: data.practiceName,
    practicePhone: data.practicePhone ?? "",
  };
  const htmlVars = {
    invoiceCard: infoCardHtml(invoiceRows, "green"),
    portalButton: data.portalUrl
      ? ctaButtonHtml("View in Portal", data.portalUrl)
      : "",
  };
  const body = bodyToHtml(template.body, textVars, htmlVars);
  const html = emailLayout(
    data.practiceName,
    body,
    practiceFooter({
      practiceName: data.practiceName,
      practicePhone: data.practicePhone,
    })
  );

  const result = await sendEmail({
    to: data.to,
    subject: subjectFromTemplate(template.subject, textVars),
    html,
  });

  return { success: result.success, error: result.error, id: result.id };
}

// ---------------------------------------------------------------------------
// Portal invite (staff → client)
// ---------------------------------------------------------------------------

export async function sendPortalInviteEmail(data: {
  to: string;
  clientName: string;
  practiceName: string;
  practicePhone?: string;
  practiceAddress?: string;
  portalUrl: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const body = `
    <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">Hi ${data.clientName},</p>
    <p style="margin:0 0 24px;color:#111827;font-size:15px;line-height:1.6;">You can view your pets' records, appointments, and invoices anytime in the ${data.practiceName} pet portal.</p>
    ${ctaButtonHtml("Open pet portal", data.portalUrl)}
    <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">Keep this link private. If you did not expect this email, you can ignore it.</p>
  `;

  const html = emailLayout(
    data.practiceName,
    body,
    practiceFooter({
      practiceName: data.practiceName,
      practicePhone: data.practicePhone,
      practiceAddress: data.practiceAddress,
    })
  );

  return sendEmail({
    to: data.to,
    subject: `Your pet portal — ${data.practiceName}`,
    html,
  });
}

// ---------------------------------------------------------------------------
// Portal magic link (client self-serve login)
// ---------------------------------------------------------------------------

export async function sendPortalMagicLinkEmail(
  data: {
    to: string;
    clientName: string;
    practiceName: string;
    practicePhone?: string;
    practiceAddress?: string;
    magicLinkUrl: string;
    expiresInMinutes: number;
  },
  template: EmailTemplateContent = DEFAULT_EMAIL_TEMPLATES.portalMagicLink
): Promise<{ success: boolean; error?: string; id?: string }> {
  const textVars = {
    clientName: data.clientName,
    practiceName: data.practiceName,
    practicePhone: data.practicePhone ?? "",
    expiresInMinutes: String(data.expiresInMinutes),
  };
  const htmlVars = {
    magicLinkButton: ctaButtonHtml("Open pet portal", data.magicLinkUrl),
  };
  const body = bodyToHtml(template.body, textVars, htmlVars);
  const html = emailLayout(
    data.practiceName,
    body,
    practiceFooter({
      practiceName: data.practiceName,
      practicePhone: data.practicePhone,
      practiceAddress: data.practiceAddress,
    })
  );

  const result = await sendEmail({
    to: data.to,
    subject: subjectFromTemplate(template.subject, textVars),
    html,
  });

  return { success: result.success, error: result.error, id: result.id };
}
