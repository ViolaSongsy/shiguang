import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  const { id } = await params;

  const existing = await db.prepare("SELECT id FROM entries WHERE id = ? AND user_id = ?").get(id, user.id);
  if (!existing) return NextResponse.json({ error: "没有找到这条记录。" }, { status: 404 });

  await db.prepare("DELETE FROM entries WHERE id = ? AND user_id = ?").run(id, user.id);
  return NextResponse.json({ ok: true });
}
