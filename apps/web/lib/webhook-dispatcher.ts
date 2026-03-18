import { createHmac } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { webhooks } from "@openpims/db";

export async function dispatchWebhookEvent(
  practiceId: string,
  event: string,
  payload: Record<string, any>,
): Promise<void> {
  let activeWebhooks;
  try {
    activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.practiceId, practiceId),
          eq(webhooks.active, true),
          isNull(webhooks.deletedAt),
        ),
      );
  } catch (err) {
    console.error("[WebhookDispatcher] Failed to query webhooks:", err);
    return;
  }

  // Filter to webhooks that subscribe to this event
  const matching = activeWebhooks.filter((wh) => {
    const events = wh.events as string[];
    return Array.isArray(events) && (events.includes("*") || events.includes(event));
  });

  if (matching.length === 0) return;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const requests = matching.map(async (wh) => {
    try {
      const signature = createHmac("sha256", wh.secret)
        .update(body)
        .digest("hex");

      await fetch(wh.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Signature": signature,
        },
        body,
      });
    } catch (err) {
      console.error(
        `[WebhookDispatcher] Failed to deliver ${event} to ${wh.url}:`,
        err,
      );
    }
  });

  // Fire all requests in parallel (don't block on responses)
  Promise.allSettled(requests).catch(() => {
    // Intentionally swallowed - individual errors are logged above
  });
}
