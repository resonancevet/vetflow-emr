const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(options.key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { success: true, remaining: options.limit - 1 };
  }

  if (entry.count >= options.limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: options.limit - entry.count };
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);
