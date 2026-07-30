import type { PracticeSettingsJson } from "@/lib/tax";

export type EmailTemplateKey =
  | "appointmentReminder"
  | "appointmentConfirmation"
  | "appointmentRequestDeclined"
  | "portalMagicLink"
  | "vaccinationReminder"
  | "invoiceEmail";

export type EmailTemplateContent = {
  subject: string;
  body: string;
};

export const EMAIL_TEMPLATE_META: {
  key: EmailTemplateKey;
  label: string;
  description: string;
  mergeFields: { token: string; meaning: string }[];
}[] = [
  {
    key: "appointmentReminder",
    label: "Appointment reminder",
    description: "Sent from Schedule or the daily reminder cron.",
    mergeFields: [
      { token: "{{clientName}}", meaning: "Client full name" },
      { token: "{{patientName}}", meaning: "Patient name" },
      { token: "{{appointmentDate}}", meaning: "Appointment date" },
      { token: "{{appointmentTime}}", meaning: "Appointment time" },
      { token: "{{practiceName}}", meaning: "Practice name" },
      { token: "{{practicePhone}}", meaning: "Practice phone" },
      {
        token: "{{appointmentCard}}",
        meaning: "Styled date/time summary box (HTML)",
      },
    ],
  },
  {
    key: "appointmentConfirmation",
    label: "Appointment confirmation",
    description:
      "Sent when staff approve a portal appointment request from the dashboard.",
    mergeFields: [
      { token: "{{clientName}}", meaning: "Client full name" },
      { token: "{{patientName}}", meaning: "Patient name" },
      { token: "{{appointmentDate}}", meaning: "Appointment date" },
      { token: "{{appointmentTime}}", meaning: "Appointment time" },
      { token: "{{practiceName}}", meaning: "Practice name" },
      { token: "{{practicePhone}}", meaning: "Practice phone" },
      {
        token: "{{appointmentCard}}",
        meaning: "Styled date/time summary box (HTML)",
      },
    ],
  },
  {
    key: "appointmentRequestDeclined",
    label: "Appointment request declined",
    description:
      "Sent when staff decline a portal appointment request from the dashboard.",
    mergeFields: [
      { token: "{{clientName}}", meaning: "Client full name" },
      { token: "{{patientName}}", meaning: "Patient name" },
      { token: "{{preferredDate}}", meaning: "Client's preferred date" },
      { token: "{{preferredTime}}", meaning: "Client's preferred time" },
      { token: "{{staffMessage}}", meaning: "Message entered when declining" },
      { token: "{{practiceName}}", meaning: "Practice name" },
      { token: "{{practicePhone}}", meaning: "Practice phone" },
      {
        token: "{{requestCard}}",
        meaning: "Styled preferred date/time box when available (HTML)",
      },
    ],
  },
  {
    key: "portalMagicLink",
    label: "Portal magic link",
    description:
      "One-time sign-in link emailed when a client requests access at /portal/login.",
    mergeFields: [
      { token: "{{clientName}}", meaning: "Client full name" },
      { token: "{{practiceName}}", meaning: "Practice name" },
      { token: "{{practicePhone}}", meaning: "Practice phone" },
      { token: "{{expiresInMinutes}}", meaning: "Link lifetime in minutes" },
      {
        token: "{{magicLinkButton}}",
        meaning: "Open-portal button (HTML)",
      },
    ],
  },
  {
    key: "vaccinationReminder",
    label: "Vaccination reminder",
    description: "Sent when notifying that a vaccine is due.",
    mergeFields: [
      { token: "{{clientName}}", meaning: "Client full name" },
      { token: "{{patientName}}", meaning: "Patient name" },
      { token: "{{vaccineName}}", meaning: "Vaccine name" },
      { token: "{{dueDate}}", meaning: "Due date" },
      { token: "{{practiceName}}", meaning: "Practice name" },
      { token: "{{practicePhone}}", meaning: "Practice phone" },
      {
        token: "{{vaccineCard}}",
        meaning: "Styled vaccine/due-date box (HTML)",
      },
      {
        token: "{{callButton}}",
        meaning: "Call-to-schedule button (HTML)",
      },
    ],
  },
  {
    key: "invoiceEmail",
    label: "Invoice email",
    description: "Sent from Billing when emailing an invoice.",
    mergeFields: [
      { token: "{{clientName}}", meaning: "Client full name" },
      { token: "{{patientName}}", meaning: "Patient name (may be empty)" },
      { token: "{{invoiceTotal}}", meaning: "Formatted total" },
      { token: "{{dueDate}}", meaning: "Due date (may be empty)" },
      { token: "{{practiceName}}", meaning: "Practice name" },
      { token: "{{practicePhone}}", meaning: "Practice phone" },
      {
        token: "{{invoiceCard}}",
        meaning: "Styled amount-due box (HTML)",
      },
      {
        token: "{{portalButton}}",
        meaning: "View-in-portal button when a link exists (HTML)",
      },
    ],
  },
];

export const DEFAULT_EMAIL_TEMPLATES: Record<
  EmailTemplateKey,
  EmailTemplateContent
> = {
  appointmentReminder: {
    subject:
      "Appointment Reminder for {{patientName}} – {{appointmentDate}}",
    body: `Hi {{clientName}},

This is a friendly reminder about an upcoming appointment for {{patientName}}.

{{appointmentCard}}

If you need to cancel or reschedule, please call us{{#practicePhone}} at {{practicePhone}}{{/practicePhone}} as soon as possible.

We look forward to seeing you and {{patientName}}!`,
  },
  appointmentConfirmation: {
    subject:
      "Appointment Confirmed for {{patientName}} – {{appointmentDate}}",
    body: `Hi {{clientName}},

Your appointment request for {{patientName}} has been confirmed.

{{appointmentCard}}

If you need to cancel or reschedule, please call us{{#practicePhone}} at {{practicePhone}}{{/practicePhone}} as soon as possible.

We look forward to seeing you and {{patientName}}!`,
  },
  appointmentRequestDeclined: {
    subject: "Update on your appointment request for {{patientName}}",
    body: `Hi {{clientName}},

We received your appointment request for {{patientName}}, but we were not able to book that time.

{{requestCard}}

{{staffMessage}}

Please reply to this email or call us{{#practicePhone}} at {{practicePhone}}{{/practicePhone}} if you would like to choose another time.`,
  },
  portalMagicLink: {
    subject: "Your pet portal sign-in link — {{practiceName}}",
    body: `Hi {{clientName}},

Use the button below to open your pet portal at {{practiceName}}. This link expires in {{expiresInMinutes}} minutes and can only be used once.

{{magicLinkButton}}

If you did not request this email, you can ignore it.`,
  },
  vaccinationReminder: {
    subject: "Vaccination Reminder: {{vaccineName}} for {{patientName}}",
    body: `Hi {{clientName}},

It's time to schedule {{patientName}}'s {{vaccineName}} vaccination.

{{vaccineCard}}

Please contact us{{#practicePhone}} at {{practicePhone}}{{/practicePhone}} to schedule an appointment for {{patientName}}.

{{callButton}}

Keeping vaccinations up to date is important for your pet's health and safety.`,
  },
  invoiceEmail: {
    subject: "Invoice from {{practiceName}} – {{invoiceTotal}}",
    body: `Hi {{clientName}},

Here is your invoice{{#patientName}} for {{patientName}}{{/patientName}} from {{practiceName}}.

{{invoiceCard}}

{{portalButton}}

If you have any questions about this invoice, please contact us{{#practicePhone}} at {{practicePhone}}{{/practicePhone}}.`,
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Handle {{#field}}...{{/field}} — keep inner content only when field is non-empty. */
function applyConditionals(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_match, key: string, inner: string) => {
      const v = vars[key];
      return v && v.trim() ? inner : "";
    }
  );
}

function replaceTokens(
  template: string,
  textVars: Record<string, string>,
  htmlVars: Record<string, string>
): string {
  let out = applyConditionals(template, textVars);
  for (const [key, html] of Object.entries(htmlVars)) {
    out = out.split(`{{${key}}}`).join(html);
  }
  for (const [key, value] of Object.entries(textVars)) {
    out = out.split(`{{${key}}}`).join(escapeHtml(value));
  }
  // Leave unknown tokens visible so editors can spot typos
  return out;
}

/** Turn plain-text body (after merges) into email HTML paragraphs. */
export function bodyToHtml(
  body: string,
  textVars: Record<string, string>,
  htmlVars: Record<string, string> = {}
): string {
  const merged = replaceTokens(body, textVars, htmlVars);
  const blocks = merged.split(/\n\n+/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Block that is only an HTML fragment (card/button) — inject as-is
      if (/^<(table|p|div)\b/i.test(trimmed)) {
        return trimmed;
      }
      const withBreaks = trimmed.replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.6;">${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

export function subjectFromTemplate(
  subject: string,
  textVars: Record<string, string>
): string {
  return replaceTokens(subject, textVars, {});
}

export function getEmailTemplatesFromSettings(
  settings: unknown
): Record<EmailTemplateKey, EmailTemplateContent> {
  const raw = (settings as PracticeSettingsJson | null | undefined)
    ?.emailTemplates as
    | Partial<Record<EmailTemplateKey, Partial<EmailTemplateContent>>>
    | undefined;

  const result = { ...DEFAULT_EMAIL_TEMPLATES };
  for (const key of Object.keys(DEFAULT_EMAIL_TEMPLATES) as EmailTemplateKey[]) {
    const override = raw?.[key];
    if (!override) continue;
    result[key] = {
      subject:
        typeof override.subject === "string" && override.subject.trim()
          ? override.subject
          : DEFAULT_EMAIL_TEMPLATES[key].subject,
      body:
        typeof override.body === "string" && override.body.trim()
          ? override.body
          : DEFAULT_EMAIL_TEMPLATES[key].body,
    };
  }
  return result;
}

export function infoCardHtml(rows: { label: string; value: string; large?: boolean }[], tint: "teal" | "amber" | "green"): string {
  const colors =
    tint === "teal"
      ? { bg: "#f0fdfa", border: "#ccfbf1" }
      : tint === "amber"
        ? { bg: "#fffbeb", border: "#fef3c7" }
        : { bg: "#f0fdf4", border: "#dcfce7" };

  const rowsHtml = rows
    .map((row, i) => {
      const isLast = i === rows.length - 1;
      return `<p style="margin:0 0 4px;color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(row.label)}</p>
<p style="margin:0${isLast ? "" : " 0 16px"};color:#0f172a;font-size:${row.large ? "28px" : "18px"};font-weight:${row.large ? "700" : "600"};">${escapeHtml(row.value)}</p>`;
    })
    .join("\n");

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:${colors.bg};border:1px solid ${colors.border};border-radius:8px;margin-bottom:24px;">
  <tr>
    <td style="padding:20px 24px;">
      ${rowsHtml}
    </td>
  </tr>
</table>`;
}

export function ctaButtonHtml(label: string, url: string): string {
  if (!url) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:#0d9488;border-radius:6px;">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}
