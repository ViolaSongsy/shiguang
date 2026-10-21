import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { db, initDb } from "@/lib/db";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
type UserRow = { id: string; email: string; password_hash: string };

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const limit = await checkRateLimit({ action: "login", identifier: getRateLimitIdentifier(request, `email:${input.email}`), limit: 20, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: "登录尝试太频繁了，请稍后再试。" }, { status: 429 });
    await initDb();
    const user = await db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get<UserRow>(input.email);
    if (!user || !(await verifyPassword(input.password, user.password_hash))) {
      return NextResponse.json({ error: "邮箱或密码不正确。" }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "请输入有效的邮箱和密码。" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "暂时无法登录，请再试一次。" }, { status: 500 });
  }
}
