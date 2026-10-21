import { createHash } from "node:crypto";
import { db, initDb } from "@/lib/db";

type RateLimitOptions = {
  action: string;
  limit: number;
  windowMs: number;
  identifier: string;
};

/**
 * Prefer a proxy-verified IP; otherwise isolate limits by the operation's identity.
 * Hash fallback identities so emails and reset tokens are not stored in rate_limits.
 * Set TRUSTED_PROXY_IP_HEADER only when the hosting proxy overwrites that header.
 * On Vercel, x-vercel-forwarded-for is overwritten by the platform.
 */
export function getRateLimitIdentifier(request: Request, fallbackIdentity: string) {
  const configured = process.env.TRUSTED_PROXY_IP_HEADER;
  const trustedHeader = configured === "x-vercel-forwarded-for" || configured === "x-real-ip"
    ? configured : null;
  if (trustedHeader) {
    const value = request.headers.get(trustedHeader)?.split(",")[0]?.trim();
    if (value) return `ip:${value}`;
  }
  return `identity:${createHash("sha256").update(fallbackIdentity).digest("hex")}`;
}

export async function checkRateLimit({ action, limit, windowMs, identifier }: RateLimitOptions) {
  await initDb();
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const key = identifier.toLowerCase();
  await db.prepare(`
    INSERT INTO rate_limits (identifier, action, window_start, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(identifier, action, window_start)
    DO UPDATE SET count = count + 1
  `).run(key, action, windowStart);

  const row = await db.prepare("SELECT count FROM rate_limits WHERE identifier = ? AND action = ? AND window_start = ?")
    .get<{ count: number }>(key, action, windowStart);
  const remaining = Math.max(0, limit - (row?.count ?? 0));
  return { allowed: (row?.count ?? 0) <= limit, remaining };
}
