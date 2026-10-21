import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

const reflectionInputSchema = z.object({
  reflection_date: z.string(),
  title: z.string(),
  what_happened: z.string(),
  main_emotions: z.array(z.string()),
  repeated_worries: z.array(z.string()),
  fear_meaning: z.string(),
  anxiety_story: z.string(),
  kinder_interpretation: z.string(),
  companion_note: z.string(),
  next_step: z.string(),
  theme_tags: z.array(z.string()),
  intensity: z.number().min(1).max(10),
});

const requestSchema = z.object({
  days: z.union([z.literal(7), z.literal(30)]),
  reflections: z.array(reflectionInputSchema).min(1).max(30),
});

const trendSchema = z.object({
  title: z.string(),
  emotional_weather: z.string(),
  mood_direction: z.string(),
  recurring_patterns: z.array(z.string()),
  improving_signs: z.array(z.string()),
  stuck_points: z.array(z.string()),
  gentle_reading: z.string(),
  next_focus: z.string(),
});

function fallbackTrend(input: z.infer<typeof requestSchema>) {
  const tags = Array.from(new Set(input.reflections.flatMap((item) => item.theme_tags))).slice(0, 5);
  const emotions = Array.from(new Set(input.reflections.flatMap((item) => item.main_emotions))).slice(0, 5);
  const average = Math.round(input.reflections.reduce((sum, item) => sum + item.intensity, 0) / input.reflections.length);
  return {
    title: `过去 ${input.days} 天的本地概览`,
    emotional_weather: `这段时间保存了 ${input.reflections.length} 天回望，常见情绪包括：${emotions.join("、") || "暂时不明显"}。`,
    mood_direction: `平均强度大约是 ${average}/10。本地模式只能做粗略统计，无法可靠判断心情是否变好。`,
    recurring_patterns: tags.length ? tags.map((tag) => `反复出现的主题：${tag}`) : ["还没有足够主题可以判断。"],
    improving_signs: ["如果你能持续生成每日回望，这里会更容易看见变化。"],
    stuck_points: ["本地模式不会推断深层卡点，避免乱下结论。"],
    gentle_reading: "目前先把这些回望当作星星收起来。等连接 AI 后，这里会把一段时间里的情绪走向、关系模式和自我叙事整理得更清楚。",
    next_focus: "接下来可以继续记录几天，再回来看看趋势是否更稳定。",
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录，再生成趋势总结。" }, { status: 401 });

  const ipLimit = await checkRateLimit({ action: "trends:ip", identifier: getRateLimitIdentifier(request, `user:${user.id}`), limit: 12, windowMs: 24 * 60 * 60 * 1000 });
  const userLimit = await checkRateLimit({ action: "trends:user", identifier: user.id, limit: 6, windowMs: 24 * 60 * 60 * 1000 });
  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: "今天的 AI 趋势总结次数已经用完了，明天再试吧。" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "没有收到可以整理的回望。" }, { status: 400 });
  }

  const result = requestSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "回望格式有问题，请刷新页面后再试。" }, { status: 400 });
  }

  const parsed = result.data;
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ trend: fallbackTrend(parsed), mode: "demo" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.beta.chat.completions.parse({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: zodResponseFormat(trendSchema, "trend_summary"),
      temperature: 0.45,
      messages: [
        {
          role: "system",
          content: `你是一位中文情绪趋势分析助手，像一个敏锐、温柔、诚实的朋友，也有一点心理咨询师式的观察力。你会基于用户已经保存的每日回望，整理过去 7 天或 30 天的趋势。

要求：
1. 不要诊断，不要使用病理标签。
2. 重点看“情绪有没有变轻/变重/更稳定/更反复”，但如果证据不足，要诚实说不确定。
3. recurring_patterns 写反复出现的故事、关系焦虑、自我评价、压力来源或灵感主题。
4. improving_signs 写有变好的迹象，比如更能行动、更能自我安抚、更能区分事实和推测。
5. stuck_points 写仍然卡住的地方，比如同一个担心反复回来。
6. gentle_reading 写成一段有温度的整体解读，具体、亲近，不要空泛鸡汤。
7. next_focus 给一个未来几天可以观察的小方向，不要像作业。
8. 全部用中文。`,
        },
        {
          role: "user",
          content: JSON.stringify({
            range_days: parsed.days,
            daily_reflections: parsed.reflections.map((item) => ({
              date: item.reflection_date,
              title: item.title,
              diary: item.what_happened,
              emotions: item.main_emotions,
              repeated_worries: item.repeated_worries,
              fear_meaning: item.fear_meaning,
              anxiety_story: item.anxiety_story,
              kinder_interpretation: item.kinder_interpretation,
              companion_note: item.companion_note,
              next_step: item.next_step,
              tags: item.theme_tags,
              intensity: item.intensity,
            })),
          }),
        },
      ],
    });

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      return NextResponse.json({ error: "AI 暂时无法整理这段趋势。" }, { status: 422 });
    }
    if (!message?.parsed) throw new Error("OpenAI returned no parsed trend");
    return NextResponse.json({ trend: message.parsed, mode: "ai" });
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAI.AuthenticationError) {
      return NextResponse.json({ error: "OpenAI API Key 无效，请检查 .env.local。" }, { status: 502 });
    }
    if (error instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "OpenAI 额度不足或请求过于频繁，请检查 API 账单后再试。" }, { status: 429 });
    }
    return NextResponse.json({ error: "暂时无法生成趋势总结，请稍后再试。" }, { status: 500 });
  }
}
