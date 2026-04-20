import { NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim();
    const name = body.name?.trim() || undefined;
    const practiceName = body.practiceName?.trim() || undefined;

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error("Missing SLACK_WEBHOOK_URL");
      return NextResponse.json(
        { error: "Waitlist is temporarily unavailable." },
        { status: 503 }
      );
    }

    const fields: { type: "mrkdwn"; text: string }[] = [
      { type: "mrkdwn", text: `*Email:*\n${email}` },
    ];
    if (name) fields.push({ type: "mrkdwn", text: `*Name:*\n${name}` });
    if (practiceName)
      fields.push({ type: "mrkdwn", text: `*Practice:*\n${practiceName}` });

    const slackPayload = {
      text: `New OpenVPM waitlist signup — ${email}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "🐾 New OpenVPM waitlist signup" },
        },
        { type: "section", fields },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Source: openvpm.com · ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Slack webhook error:", res.status, text);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
