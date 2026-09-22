import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  createOAuthState,
  quickbooksConfigured,
} from "@/lib/quickbooks-oauth";

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-cache, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET() {
  if (!quickbooksConfigured()) {
    return withNoStore(
      NextResponse.json(
        {
          error:
            "QuickBooks is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.",
        },
        { status: 503 }
      )
    );
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { practiceId?: string; role?: string }
    | undefined;
  if (!user?.practiceId) {
    return withNoStore(
      NextResponse.redirect(
        new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000")
      )
    );
  }
  if (user.role !== "admin") {
    return withNoStore(
      NextResponse.json(
        { error: "Only practice admins can connect QuickBooks" },
        { status: 403 }
      )
    );
  }

  const state = createOAuthState(user.practiceId);
  return withNoStore(NextResponse.redirect(buildAuthorizeUrl(state)));
}
