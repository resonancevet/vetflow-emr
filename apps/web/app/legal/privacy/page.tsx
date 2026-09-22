import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/nav-config";

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: `Privacy Policy for the ${APP_NAME} veterinary practice management application.`,
};

const EFFECTIVE_DATE = "September 21, 2026";

export default function PrivacyPolicyPage() {
  return (
    <article className="space-y-8 text-foreground">
      <header className="space-y-2 border-b border-border pb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground">
          Effective date: {EFFECTIVE_DATE}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This Privacy Policy explains how {APP_NAME} (&ldquo;we,&rdquo;
          &ldquo;us,&rdquo; or &ldquo;the Service&rdquo;) collects, uses, stores,
          and shares information when you use the {APP_NAME} veterinary practice
          management application. By using the Service, you acknowledge this
          Policy. Related terms of use are described in our{" "}
          <Link href="/legal/eula" className="text-primary hover:underline">
            End User License Agreement
          </Link>
          .
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          1. Who this Policy covers
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {APP_NAME} is provided to veterinary practices (&ldquo;Practice&rdquo;)
          and their authorized staff. The Practice decides what client, patient,
          and operational data to enter into the Service. For Practice-controlled
          records, the Practice is typically the primary decision-maker about that
          data; we process it to operate and improve the Service on the
          Practice&apos;s behalf.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          2. Information we collect
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Depending on how the Service is used, we may process:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Account information</span>
            {" "}— staff names, email addresses, roles, and authentication-related
            data needed to sign in and manage access.
          </li>
          <li>
            <span className="font-medium text-foreground">Practice information</span>
            {" "}— practice name, contact details, address, billing preferences, and
            similar settings.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Client and patient records
            </span>
            {" "}— information the Practice enters or imports, such as client
            contact details, patient medical and visit records, appointments,
            invoices, and payments.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Communications metadata
            </span>
            {" "}— when the Practice sends invoices, reminders, or messages through
            the Service, we process delivery-related details (for example,
            recipient address and send status).
          </li>
          <li>
            <span className="font-medium text-foreground">
              Technical and usage data
            </span>
            {" "}— IP address, device/browser type, timestamps, error logs, and
            similar diagnostics needed for security, reliability, and product
            analytics.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          3. How we use information
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We use information to provide, maintain, and secure the Service;
          authenticate users; support scheduling, records, billing, and related
          workflows; send communications the Practice initiates; troubleshoot
          issues; monitor abuse and protect the Service; meet legal obligations;
          and improve reliability and features. We do not sell personal
          information.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          4. Sharing and third-party services
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We share information only as needed to operate the Service or as
          directed by the Practice, including with:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Hosting and infrastructure</span>
            {" "}providers that store and run the application and database.
          </li>
          <li>
            <span className="font-medium text-foreground">Email and messaging</span>
            {" "}providers when the Practice sends invoices, reminders, or other
            notifications.
          </li>
          <li>
            <span className="font-medium text-foreground">Payment processors</span>
            {" "}when payment features are enabled.
          </li>
          <li>
            <span className="font-medium text-foreground">Accounting integrations</span>
            {" "}(for example, QuickBooks Online) when the Practice connects them.
            Connected services receive data the Practice authorizes for sync (such
            as customer or invoice details) and are governed by their own privacy
            policies.
          </li>
          <li>
            <span className="font-medium text-foreground">Analytics</span>
            {" "}tools that help us understand product usage and performance.
          </li>
          <li>
            Professional advisors, regulators, or law enforcement when required by
            law or to protect rights, safety, and the integrity of the Service.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          5. Cookies and session technology
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Service uses cookies and similar technologies that are necessary for
          authentication, session management, and core functionality. We may also
          use analytics cookies or similar tools to understand how the Service is
          used. You can control cookies through your browser settings; disabling
          required cookies may prevent you from signing in or using parts of the
          Service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">6. Security</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We use administrative, technical, and organizational measures designed to
          protect information, including encrypted transport (HTTPS), access
          controls, and restricted handling of integration credentials. No method
          of transmission or storage is completely secure; Practices should also
          use strong passwords, limit staff access, and follow their own security
          policies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          7. Retention
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We retain information for as long as needed to provide the Service to the
          Practice, comply with legal obligations, resolve disputes, and enforce
          agreements. Retention for Practice records is primarily driven by the
          Practice&apos;s subscription and operational needs. When a Practice
          account is closed, we delete or de-identify data according to our
          retention practices and any applicable legal requirements, subject to
          backup and audit windows.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          8. Your choices and rights
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Staff users may update certain account details through the Service or by
          contacting their Practice administrator. Clients and other individuals
          whose information appears in Practice records should contact the Practice
          that collected their information to exercise access, correction, or
          deletion requests. Where applicable law grants additional rights, we will
          assist the Practice in responding as required.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          9. Children&apos;s privacy
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Service is intended for use by veterinary practices and their adult
          staff. It is not directed to children under 13, and we do not knowingly
          collect personal information from children under 13 for the purpose of
          creating user accounts.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          10. International transfers
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Service may be hosted and processed in the United States or other
          locations where our providers operate. If you access the Service from
          another country, your information may be transferred to and processed in
          those locations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          11. Changes to this Policy
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We may update this Privacy Policy from time to time. The effective date
          at the top of this page will change when we do. Continued use of the
          Service after changes become effective constitutes acceptance of the
          revised Policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">12. Contact</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Privacy questions about {APP_NAME} should be directed to your Practice
          administrator or the party that provisioned your account. For requests
          about client or patient records stored in the Service, contact the
          Practice that maintains those records.
        </p>
      </section>
    </article>
  );
}
