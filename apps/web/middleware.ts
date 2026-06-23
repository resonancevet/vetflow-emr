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

  // Unauthenticated visitors always go to /login. The previous "redirect to
  // marketing site" behavior caused the iPad to land on openvpm.com whenever
  // the host header didn't match a local/trycloudflare pattern.
  if (!token) {
    if (request.nextUrl.pathname === "/login") {
      return setSecurityHeaders(NextResponse.next());
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  return setSecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!login|register|api/auth|_next|favicon.ico|favicon.svg|logo.svg|manifest.webmanifest|sw.js|api/trpc|portal|api-docs|api/portal|api/webhooks|api/cron).*)",
  ],
};
