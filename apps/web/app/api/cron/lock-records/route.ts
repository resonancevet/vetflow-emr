import { NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { autoFinalizeStaleSoapNotes } from "@/lib/record-lockdown";

export async function GET(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await autoFinalizeStaleSoapNotes(db);
    console.log(
      `Cron lock-records: finalized ${result.finalized} of ${result.scanned} stale SOAP notes`
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron lock-records failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
