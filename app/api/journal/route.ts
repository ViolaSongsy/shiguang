import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseReflection, type Entry, type ReflectionRow } from "@/lib/server-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await db.prepare("SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC").all<Entry>(user.id);
  const rows = await db.prepare("SELECT * FROM reflections WHERE user_id = ? ORDER BY reflection_date DESC").all<ReflectionRow>(user.id);
  return NextResponse.json({ entries, reflections: rows.map(parseReflection) });
}
