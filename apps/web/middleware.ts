import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function setSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Unauthenticated visitors at root get redirected to the marketing site (prod only)
  if (!token && request.nextUrl.pathname === "/") {
    if (process.env.NODE_ENV === "development") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || "https://openvpm.com";
    return NextResponse.redirect(wwwUrl);
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  return setSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!login|register|api/auth|_next|favicon.ico|api/trpc|portal|api-docs|api/portal|api/webhooks|api/cron).*)",
  ],
};
