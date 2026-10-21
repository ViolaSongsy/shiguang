import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { db, initDb } from "@/lib/db";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const limit = await checkRateLimit({ action: "signup", identifier: getRateLimitIdentifier(request, `email:${input.email}`), limit: 8, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: "创建账号太频繁了，请稍后再试。" }, { status: 429 });
    await initDb();
    const exists = await db.prepare("SELECT 1 FROM users WHERE email = ?").get(input.email);
    if (exists) return NextResponse.json({ error: "这个邮箱已经注册过了。" }, { status: 409 });

    const user = { id: randomUUID(), email: input.email };
    await db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(user.id, user.email, await hashPassword(input.password), new Date().toISOString());
    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "请输入有效邮箱，密码至少 8 位。" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "暂时无法创建账号，请再试一次。" }, { status: 500 });
  }
}
