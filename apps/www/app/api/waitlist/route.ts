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

    const apiKey = process.env.INSTANTLY_API_KEY;
    const listId = process.env.INSTANTLY_LIST_ID;

    if (!apiKey || !listId) {
      console.error("Missing INSTANTLY_API_KEY or INSTANTLY_LIST_ID");
      return NextResponse.json(
        { error: "Waitlist is temporarily unavailable." },
        { status: 503 }
      );
    }

    // Split name into first/last if provided
    const nameParts = name?.split(" ") || [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

    const res = await fetch("https://api.instantly.ai/api/v2/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
        company_name: practiceName,
        list_id: listId,
        skip_if_in_list: true,
        custom_variables: {
          source: "openvpm-website",
          interest: "managed-hosting",
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Instantly API error:", res.status, text);
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
