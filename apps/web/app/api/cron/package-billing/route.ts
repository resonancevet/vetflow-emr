import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { isCronAuthorized } from "@/lib/cron-auth";
import { generateDueInstallmentsForPractice } from "@/server/routers/service-packages";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateDueInstallmentsForPractice(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Cron] package-billing failed:", err);
    return NextResponse.json(
      { error: "Package billing cron failed" },
      { status: 500 }
    );
  }
}
