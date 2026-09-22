import type { Metadata } from "next";
import { APP_NAME } from "@/lib/nav-config";

export const metadata: Metadata = {
  title: `End User License Agreement | ${APP_NAME}`,
  description: `End User License Agreement for the ${APP_NAME} veterinary practice management application.`,
};

const EFFECTIVE_DATE = "September 21, 2026";

export default function EndUserLicenseAgreementPage() {
  return (
    <article className="space-y-8 text-foreground">
      <header className="space-y-2 border-b border-border pb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          End User License Agreement
        </h1>
        <p className="text-sm text-muted-foreground">
          Effective date: {EFFECTIVE_DATE}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This End User License Agreement (&ldquo;Agreement&rdquo;) governs access
          to and use of the {APP_NAME} software and related services
          (&ldquo;Service&rdquo;). By signing in or otherwise using the Service,
          you agree to this Agreement.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">1. The Service</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {APP_NAME} is a veterinary practice management application used by
          authorized staff of a subscribing veterinary practice
          (&ldquo;Practice&rdquo;). The Service is provided for the Practice&apos;s
          internal business operations, including scheduling, medical records,
          billing, and related workflows.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          2. License grant
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Subject to this Agreement, you are granted a limited, non-exclusive,
          non-transferable, revocable license to access and use the Service solely
          as an authorized user of the Practice and only for the Practice&apos;s
          legitimate business purposes. No ownership of the Service or its
          underlying software is transferred to you.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          3. Authorized users and accounts
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Access is limited to individuals invited or registered by the Practice.
          You must keep your login credentials confidential and notify the
          Practice administrator promptly if you suspect unauthorized access. You
          are responsible for activity conducted under your account.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">4. Acceptable use</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You agree not to misuse the Service, including by attempting to bypass
          security controls, reverse engineer the software except where permitted
          by law, scrape or export data you are not authorized to access, interfere
          with other users, or use the Service in violation of applicable law or
          professional standards. The Practice is responsible for ensuring that
          its use of the Service complies with veterinary, privacy, and healthcare
          regulations applicable to its operations.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          5. Practice data and confidentiality
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Data you enter into the Service on behalf of the Practice remains the
          Practice&apos;s responsibility. You must handle client, patient, and
          staff information in accordance with the Practice&apos;s policies and
          applicable law. Do not disclose confidential information except as
          required for your job duties or with appropriate authorization.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          6. Third-party integrations
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Service may connect to third-party products (for example, accounting
          or payment providers). Those services are governed by their own terms and
          privacy policies. Connecting an integration is done at the Practice&apos;s
          direction; you should only enable integrations you are authorized to
          configure.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          7. Disclaimer of warranties
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo;
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, NO WARRANTIES OF ANY KIND,
          WHETHER EXPRESS, IMPLIED, OR STATUTORY, ARE MADE REGARDING THE SERVICE,
          INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          OR NON-INFRINGEMENT. CLINICAL AND BUSINESS DECISIONS REMAIN THE
          RESPONSIBILITY OF LICENSED PROFESSIONALS AND THE PRACTICE.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          8. Limitation of liability
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER THE SERVICE OPERATOR NOR
          ITS SUPPLIERS SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, OR
          GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE. AGGREGATE
          LIABILITY FOR DIRECT DAMAGES SHALL NOT EXCEED THE AMOUNT PAID BY THE
          PRACTICE FOR THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM,
          OR ONE HUNDRED U.S. DOLLARS (USD $100) IF NO FEES WERE PAID, WHICHEVER
          IS GREATER.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">9. Termination</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your access may be suspended or terminated by the Practice or the Service
          operator if you violate this Agreement or if the Practice&apos;s
          subscription ends. Sections that by their nature should survive
          termination (including disclaimers and limitations of liability) will
          survive.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          10. Changes to this Agreement
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          We may update this Agreement from time to time. The effective date at
          the top of this page will change when we do. Continued use of the
          Service after changes become effective constitutes acceptance of the
          revised Agreement.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">11. Contact</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Questions about this Agreement or your access to {APP_NAME} should be
          directed to your Practice administrator or the party that provisioned
          your account.
        </p>
      </section>
    </article>
  );
}
