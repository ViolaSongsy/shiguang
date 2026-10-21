import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { initDb, withDbTransaction } from "@/lib/db";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const tokenHash = hashToken(input.token);
    const limit = await checkRateLimit({ action: "reset-password", identifier: getRateLimitIdentifier(request, `reset:${tokenHash}`), limit: 10, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: "请求太频繁了，请稍后再试。" }, { status: 429 });
    await initDb();
    // Compute the slow password hash outside the write transaction.
    const passwordHash = await hashPassword(input.password);
    const now = new Date().toISOString();

    const changed = await withDbTransaction(async (tx) => {
      const result = await tx.execute({
        sql: "SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
        args: [tokenHash, now],
      });
      const row = result.rows[0];
      if (!row) return false;

      // Claim the token in the same transaction as the password and session changes.
      const claim = await tx.execute({
        sql: "UPDATE password_reset_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?",
        args: [now, String(row.id), now],
      });
      if (claim.rowsAffected !== 1) return false;

      const userId = String(row.user_id);
      await tx.execute({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [passwordHash, userId] });
      await tx.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] });
      return true;
    });

    if (!changed) return NextResponse.json({ error: "这个重设链接无效或已经过期。" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "密码至少需要 8 位。" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "暂时无法重设密码，请稍后再试。" }, { status: 500 });
  }
}
