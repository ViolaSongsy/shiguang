import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { localDateKey } from "@/lib/date";
import { db } from "@/lib/db";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { parseReflection, type Entry, type ReflectionRow } from "@/lib/server-data";
import type { Reflection } from "@/lib/types";

const querySchema = z.object({
  type: z.enum(["entries", "reflections"]),
  format: z.enum(["markdown", "json"]).default("markdown"),
  range: z.enum(["all", "30", "90", "365", "custom"]).default("all"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((value, context) => {
  if (value.range === "custom" && (!value.start || !value.end)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "自定义导出需要开始和结束日期。" });
  }
});

type ExportQuery = z.infer<typeof querySchema>;

function escapeMarkdown(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function formatChineseDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function csvSafeFilename(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").toLowerCase();
}

function rangeLabel(query: ExportQuery) {
  if (query.range === "all") return "全部";
  if (query.range === "custom") return `${query.start} 到 ${query.end}`;
  return `过去 ${query.range} 天`;
}

function rangeStartDate(range: ExportQuery["range"]) {
  if (range === "all" || range === "custom") return null;
  const days = Number(range);
  return localDateKey(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
}

function filtersForEntries(query: ExportQuery) {
  const clauses = ["user_id = ?"];
  const params: (string | number | null)[] = [];
  let start = query.start ?? rangeStartDate(query.range);
  let end = query.end;

  if (start) {
    clauses.push("created_at >= ?");
    params.push(`${start}T00:00:00.000Z`);
  }
  if (end) {
    clauses.push("created_at <= ?");
    params.push(`${end}T23:59:59.999Z`);
  }

  return { clauses, params };
}

function filtersForReflections(query: ExportQuery) {
  const clauses = ["user_id = ?"];
  const params: (string | number | null)[] = [];
  let start = query.start ?? rangeStartDate(query.range);
  let end = query.end;

  if (start) {
    clauses.push("reflection_date >= ?");
    params.push(start);
  }
  if (end) {
    clauses.push("reflection_date <= ?");
    params.push(end);
  }

  return { clauses, params };
}

function entriesToMarkdown(entries: Entry[], query: ExportQuery) {
  const lines = [
    "# 拾光日记导出",
    "",
    `导出范围：${rangeLabel(query)}`,
    `导出时间：${formatChineseDateTime(new Date().toISOString())}`,
    `记录数量：${entries.length}`,
    "",
  ];

  let currentDate = "";
  for (const entry of entries) {
    const date = localDateKey(new Date(entry.created_at));
    if (date !== currentDate) {
      currentDate = date;
      lines.push(`## ${date}`, "");
    }

    lines.push(`### ${formatChineseDateTime(entry.created_at)}${entry.mood ? ` ${entry.mood}` : ""}`);
    lines.push("");
    lines.push(entry.content.trim() ? escapeMarkdown(entry.content) : "只记录了这一刻的心情。");
    lines.push("");
  }

  if (!entries.length) lines.push("这个范围内还没有原始记录。", "");
  return lines.join("\n");
}

function listSection(title: string, items: string[]) {
  if (!items.length) return "";
  return [`### ${title}`, "", ...items.map((item) => `- ${escapeMarkdown(item)}`), ""].join("\n");
}

function reflectionsToMarkdown(reflections: Reflection[], query: ExportQuery) {
  const lines = [
    "# 拾光总结导出",
    "",
    `导出范围：${rangeLabel(query)}`,
    `导出时间：${formatChineseDateTime(new Date().toISOString())}`,
    `总结数量：${reflections.length}`,
    "",
  ];

  for (const reflection of reflections) {
    lines.push(`## ${reflection.reflection_date} · ${escapeMarkdown(reflection.title)}`, "");
    lines.push("### 我的日记", "", escapeMarkdown(reflection.what_happened), "");
    lines.push(listSection("主要情绪", reflection.main_emotions));
    lines.push(listSection("反复出现的担心", reflection.repeated_worries));
    lines.push("### 可能的触发", "", escapeMarkdown(reflection.trigger), "");
    lines.push(listSection("已知事实", reflection.known_facts));
    lines.push(listSection("可能的推测", reflection.guesses));
    lines.push("### 焦虑故事 / 内在主题", "", escapeMarkdown(reflection.anxiety_story), "");
    lines.push("### 更温柔的理解", "", escapeMarkdown(reflection.kinder_interpretation), "");
    lines.push("### 像朋友一样说", "", escapeMarkdown(reflection.companion_note), "");
    lines.push("### 下一小步", "", escapeMarkdown(reflection.next_step), "");
    lines.push(listSection("主题标签", reflection.theme_tags));
  }

  if (!reflections.length) lines.push("这个范围内还没有每日总结。", "");
  return lines.join("\n");
}

function downloadResponse(content: string, filename: string, contentType: string) {
  return new NextResponse(content, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": `${contentType}; charset=utf-8`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const ipLimit = await checkRateLimit({ action: "export:ip", identifier: getRateLimitIdentifier(request, `user:${user.id}`), limit: 30, windowMs: 60 * 60 * 1000 });
  const userLimit = await checkRateLimit({ action: "export:user", identifier: user.id, limit: 30, windowMs: 60 * 60 * 1000 });
  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: "导出太频繁了，请稍后再试。" }, { status: 429 });
  }

  const url = new URL(request.url);
  const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return NextResponse.json({ error: "导出条件有误。" }, { status: 400 });

  const parsed = query.data;
  const stamp = localDateKey();
  const prefix = parsed.type === "entries" ? "shiguang-entries" : "shiguang-reflections";
  const filenameBase = `${prefix}-${csvSafeFilename(rangeLabel(parsed))}-${stamp}`;

  if (parsed.type === "entries") {
    const { clauses, params } = filtersForEntries(parsed);
    const entries = await db.prepare(`
      SELECT * FROM entries
      WHERE ${clauses.join(" AND ")}
      ORDER BY created_at ASC
    `).all<Entry>(user.id, ...params);

    if (parsed.format === "json") {
      return downloadResponse(JSON.stringify({
        exported_at: new Date().toISOString(),
        export_type: "entries",
        range: rangeLabel(parsed),
        count: entries.length,
        entries,
      }, null, 2), `${filenameBase}.json`, "application/json");
    }

    return downloadResponse(entriesToMarkdown(entries, parsed), `${filenameBase}.md`, "text/markdown");
  }

  const { clauses, params } = filtersForReflections(parsed);
  const rows = await db.prepare(`
    SELECT * FROM reflections
    WHERE ${clauses.join(" AND ")}
    ORDER BY reflection_date ASC
  `).all<ReflectionRow>(user.id, ...params);
  const reflections = rows.map(parseReflection);

  if (parsed.format === "json") {
    return downloadResponse(JSON.stringify({
      exported_at: new Date().toISOString(),
      export_type: "reflections",
      range: rangeLabel(parsed),
      count: reflections.length,
      reflections,
    }, null, 2), `${filenameBase}.json`, "application/json");
  }

  return downloadResponse(reflectionsToMarkdown(reflections, parsed), `${filenameBase}.md`, "text/markdown");
}
