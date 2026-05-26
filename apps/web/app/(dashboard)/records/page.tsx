import { redirect } from "next/navigation";

/**
 * The standalone Records destination was consolidated into the patient detail
 * page in v0; this redirect preserves any older bookmarks. If the request
 * carried a `?patient=<id>` (used by the legacy New SOAP flow), we forward
 * straight to that patient's detail page.
 */
export default function RecordsRedirectPage({
  searchParams,
}: {
  searchParams?: { patient?: string };
}) {
  const patientId = searchParams?.patient;
  if (patientId) {
    redirect(`/patients/${patientId}`);
  }
  redirect("/patients");
}
