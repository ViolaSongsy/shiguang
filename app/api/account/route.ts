import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { initDb, withDbTransaction } from "@/lib/db";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const limit = await checkRateLimit({ action: "delete-account", identifier: getRateLimitIdentifier(request, `user:${user.id}`), limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "请求太频繁了，请稍后再试。" }, { status: 429 });

  try {
    await initDb();
    await withDbTransaction(async (tx) => {
      const userId = user.id;
      await tx.execute({ sql: "DELETE FROM password_reset_tokens WHERE user_id = ?", args: [userId] });
      await tx.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] });
      await tx.execute({ sql: "DELETE FROM reflections WHERE user_id = ?", args: [userId] });
      await tx.execute({ sql: "DELETE FROM entries WHERE user_id = ?", args: [userId] });
      await tx.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "暂时无法删除账号，请稍后再试。" }, { status: 500 });
  }
}
