import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseReflection, type ReflectionRow } from "@/lib/server-data";

const schema = z.object({
  reflection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1), what_happened: z.string().min(1),
  main_emotions: z.array(z.string()), repeated_worries: z.array(z.string()), trigger: z.string(),
  known_facts: z.array(z.string()), guesses: z.array(z.string()), fear_meaning: z.string(),
  anxiety_story: z.string(), kinder_interpretation: z.string(), companion_note: z.string().default(""), next_step: z.string(),
  theme_tags: z.array(z.string()), intensity: z.number().int().min(1).max(10),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const row: ReflectionRow = {
      ...input,
      id: randomUUID(),
      user_id: user.id,
      main_emotions: JSON.stringify(input.main_emotions), repeated_worries: JSON.stringify(input.repeated_worries),
      known_facts: JSON.stringify(input.known_facts), guesses: JSON.stringify(input.guesses), theme_tags: JSON.stringify(input.theme_tags),
      created_at: new Date().toISOString(),
    };
    await db.prepare(`
      INSERT INTO reflections (id, user_id, reflection_date, title, what_happened, main_emotions, repeated_worries, trigger, known_facts, guesses, fear_meaning, anxiety_story, kinder_interpretation, companion_note, next_step, theme_tags, intensity, created_at)
      VALUES (@id, @user_id, @reflection_date, @title, @what_happened, @main_emotions, @repeated_worries, @trigger, @known_facts, @guesses, @fear_meaning, @anxiety_story, @kinder_interpretation, @companion_note, @next_step, @theme_tags, @intensity, @created_at)
      ON CONFLICT(user_id, reflection_date) DO UPDATE SET
        title=excluded.title, what_happened=excluded.what_happened, main_emotions=excluded.main_emotions,
        repeated_worries=excluded.repeated_worries, trigger=excluded.trigger, known_facts=excluded.known_facts,
        guesses=excluded.guesses, fear_meaning=excluded.fear_meaning, anxiety_story=excluded.anxiety_story,
        kinder_interpretation=excluded.kinder_interpretation, companion_note=excluded.companion_note, next_step=excluded.next_step,
        theme_tags=excluded.theme_tags, intensity=excluded.intensity, created_at=excluded.created_at
    `).run(row);
    const saved = await db.prepare("SELECT * FROM reflections WHERE user_id = ? AND reflection_date = ?").get<ReflectionRow>(user.id, input.reflection_date);
    if (!saved) throw new Error("Saved reflection not found");
    return NextResponse.json({ reflection: parseReflection(saved) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "这份总结暂时无法保存。" }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "暂时没有保存成功，请再试一次。" }, { status: 500 });
  }
}
