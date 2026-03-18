import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { clients, invoices, patients } from "@openpims/db";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { token, invoiceId } = await req.json();

    if (!token || !invoiceId) {
      return NextResponse.json(
        { error: "Missing token or invoiceId" },
        { status: 400 },
      );
    }

    // Validate client token (same pattern as portal router)
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.accessToken, token), isNull(clients.deletedAt)))
      .limit(1);

    if (!client) {
      return NextResponse.json(
        { error: "Invalid portal link" },
        { status: 404 },
      );
    }

    // Fetch invoice and verify it belongs to this client
    const [invoice] = await db
      .select({
        id: invoices.id,
        total: invoices.total,
        paidAmount: invoices.paidAmount,
        status: invoices.status,
        clientId: invoices.clientId,
        patientId: invoices.patientId,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.clientId, client.id),
          isNull(invoices.deletedAt),
        ),
      )
      .limit(1);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 },
      );
    }

    if (invoice.status === "paid") {
      return NextResponse.json(
        { error: "Invoice is already paid" },
        { status: 400 },
      );
    }

    // Calculate remaining balance (in cents for Stripe)
    const remainingDollars =
      parseFloat(invoice.total) - parseFloat(invoice.paidAmount);

    if (remainingDollars <= 0) {
      return NextResponse.json(
        { error: "No balance remaining" },
        { status: 400 },
      );
    }

    const amountCents = Math.round(remainingDollars * 100);

    // Build description
    let description = `Invoice payment`;
    if (invoice.patientId) {
      const [patient] = await db
        .select({ name: patients.name })
        .from(patients)
        .where(eq(patients.id, invoice.patientId))
        .limit(1);
      if (patient) {
        description = `Invoice payment for ${patient.name}`;
      }
    }

    const origin = req.nextUrl.origin;
    const result = await createCheckoutSession({
      invoiceId: invoice.id,
      amount: amountCents,
      clientEmail: client.email ?? "",
      clientName: `${client.firstName} ${client.lastName}`,
      description,
      successUrl: `${origin}/portal/${token}?payment=success`,
      cancelUrl: `${origin}/portal/${token}?payment=cancelled`,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Payment processing is not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("[Portal Checkout] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
