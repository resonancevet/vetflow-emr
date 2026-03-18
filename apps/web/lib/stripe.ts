import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function createCheckoutSession(data: {
  invoiceId: string;
  amount: number; // in cents
  clientEmail: string;
  clientName: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null } | null> {
  if (!stripe) {
    console.log("[Stripe] No API key configured, skipping checkout session", data);
    return null;
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: data.clientEmail,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: data.description },
        unit_amount: data.amount,
      },
      quantity: 1,
    }],
    metadata: { invoiceId: data.invoiceId },
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
  });
  return { url: session.url };
}

export async function constructWebhookEvent(
  body: string,
  signature: string,
): Promise<Stripe.Event | null> {
  if (!stripe) return null;
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
}

export { stripe };
