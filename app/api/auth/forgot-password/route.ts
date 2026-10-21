import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, initDb } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) });

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function baseUrl(request: Request) {
  return process.env.APP_URL || new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const ipLimit = await checkRateLimit({ action: "forgot-password:ip", identifier: getRateLimitIdentifier(request, `email:${input.email}`), limit: 5, windowMs: 60 * 60 * 1000 });
    if (!ipLimit.allowed) return NextResponse.json({ error: "请求太频繁了，请稍后再试。" }, { status: 429 });
    await initDb();
    const emailLimit = await checkRateLimit({ action: "forgot-password:email", identifier: createHash("sha256").update(input.email).digest("hex"), limit: 3, windowMs: 60 * 60 * 1000 });
    if (!emailLimit.allowed) return NextResponse.json({ error: "请求太频繁了，请稍后再试。" }, { status: 429 });

    const user = await db.prepare("SELECT id, email FROM users WHERE email = ?").get<{ id: string; email: string }>(input.email);

    if (user) {
      const token = randomBytes(32).toString("base64url");
      const now = new Date();
      const expires = new Date(now.getTime() + 30 * 60 * 1000);
      await db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL").run(user.id);
      await db.prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(randomUUID(), user.id, hashToken(token), expires.toISOString(), now.toISOString());
      await sendPasswordResetEmail({ to: user.email, resetUrl: `${baseUrl(request)}/reset-password?token=${token}` });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "暂时无法发送重设邮件，请稍后再试。" }, { status: 500 });
  }
}
