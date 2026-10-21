import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MOODS, type Entry } from "@/lib/types";

const schema = z.object({
  content: z.string().trim().max(5000),
  mood: z.enum(MOODS).nullable(),
}).refine((value) => value.content.length > 0 || value.mood !== null, {
  message: "请写下一点什么，或选择一个心情。",
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const entry: Entry = {
      id: randomUUID(),
      user_id: user.id,
      content: input.content,
      mood: input.mood,
      context: null,
      intensity: 5,
      created_at: new Date().toISOString(),
    };
    await db.prepare("INSERT INTO entries (id, user_id, content, mood, context, intensity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(entry.id, entry.user_id, entry.content, entry.mood, entry.context, entry.intensity, entry.created_at);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "这条记录无法保存。" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "暂时没有保存成功，请再试一次。" }, { status: 500 });
  }
}
