export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === secret) return true;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
