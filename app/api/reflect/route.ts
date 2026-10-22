import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

const requestSchema = z.object({
  entries: z.array(z.object({
    content: z.string().max(5000),
    mood: z.string().nullable(),
    context: z.string().nullable(),
    intensity: z.number().min(1).max(10),
    created_at: z.string(),
  }).refine((entry) => entry.content.trim().length > 0 || entry.mood !== null, {
    message: "记录需要包含文字或心情。",
  })).min(1).max(30),
});

const reflectionSchema = z.object({
  title: z.string(),
  what_happened: z.string(),
  main_emotions: z.array(z.string()),
  repeated_worries: z.array(z.string()),
  trigger: z.string(),
  known_facts: z.array(z.string()),
  guesses: z.array(z.string()),
  fear_meaning: z.string(),
  anxiety_story: z.string(),
  kinder_interpretation: z.string(),
  companion_note: z.string(),
  next_step: z.string(),
  theme_tags: z.array(z.string()),
  intensity: z.number().min(1).max(10),
});

function fallbackReflection(entries: z.infer<typeof requestSchema>["entries"]) {
  const moods = Array.from(new Set(entries.map((entry) => entry.mood).filter(Boolean))) as string[];
  const contexts = Array.from(new Set(entries.map((entry) => entry.context).filter(Boolean))) as string[];
  const average = Math.round(entries.reduce((sum, entry) => sum + entry.intensity, 0) / entries.length);
  const writtenEntries = entries.map((entry) => entry.content.trim()).filter(Boolean);
  const combined = writtenEntries.join(" ");
  const urgent = /\b(suicide|kill myself|end my life|self[- ]?harm|hurt myself)\b/i.test(combined);
  return {
    title: "今天的记录概览",
    what_happened: writtenEntries.length
      ? `今天我断断续续写下了 ${writtenEntries.length} 段东西${moods.length ? `，心情里有 ${moods.join(" ")}` : ""}。这些片段还没有被 AI 细读，所以这里只能先像日记目录一样记住：我确实在这一天停下来，给那些还没整理好的念头留了位置。`
      : `今天我没有写很多文字，但我记录了 ${entries.length} 次心情：${moods.join(" ")}。这也算是一种很轻的日记，至少我知道自己在某些时刻是什么状态。`,
    main_emotions: moods.length ? moods : ["若有所思"],
    repeated_worries: [],
    trigger: "本地模式无法可靠判断",
    known_facts: [`今天留下了 ${entries.length} 个片段`, `其中有 ${writtenEntries.length} 段文字记录`],
    guesses: [],
    fear_meaning: "本地模式不会推断你的深层含义。",
    anxiety_story: "连接 OpenAI 后，这里会更像一个温柔的分析：它会帮你分清事实、推测、害怕背后的需要，以及这些念头为什么会反复出现。",
    kinder_interpretation: "你的原始记录已经被完整保存。这里暂时只显示客观概览，避免用固定模板替你下结论。",
    companion_note: "连接 OpenAI 后，这里会出现更像朋友或家人的回应：不是空泛安慰，而是具体地陪你看见今天为什么会难受、哪里不一定是你的错、下一步可以怎样轻一点。如果是灵感类记录，它也会帮你把想法继续展开。",
    next_step: urgent
      ? "请立刻联系当地紧急服务，或找一位可以陪在你身边、值得信任的人。这个记录工具无法提供即时危机支持。"
      : "如果愿意，可以稍后回来读一遍当天的原始片段。",
    theme_tags: contexts.length ? contexts.slice(0, 3) : ["本地概览"],
    intensity: average,
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录，再生成今日总结。" }, { status: 401 });

  const ipLimit = await checkRateLimit({ action: "reflect:ip", identifier: getRateLimitIdentifier(request, `user:${user.id}`), limit: 20, windowMs: 24 * 60 * 60 * 1000 });
  const userLimit = await checkRateLimit({ action: "reflect:user", identifier: user.id, limit: 12, windowMs: 24 * 60 * 60 * 1000 });
  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: "今天的 AI 总结次数已经用完了，明天再试吧。" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "没有收到可以整理的记录。" }, { status: 400 });
  }

  const requestResult = requestSchema.safeParse(body);
  if (!requestResult.success) {
    console.error("Invalid reflection request", requestResult.error.issues);
    return NextResponse.json({ error: "记录格式有问题，请刷新页面后再试。" }, { status: 400 });
  }

  const parsed = requestResult.data;
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ reflection: fallbackReflection(parsed.entries), mode: "demo" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.parse({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: zodResponseFormat(reflectionSchema, "daily_reflection"),
      temperature: 0.42,
      messages: [
        {
          role: "system",
          content: `你是一位克制、敏锐、很懂用户习惯的中文日记编辑，也像一个温柔但不模板化的心理咨询陪伴者。你的工作是把一天中零散的日记、灵感和 emoji 心情，整理成像用户自己晚上重新写出来的一篇有条理、细节充分、第一人称的日记；同时在后面的分析和陪伴部分，帮用户看见情绪背后的模式。不要把日记正文写成心理分析报告，也不要写成项目总结。

最重要的原则：只根据用户明确写下的内容整理。记录越少，输出越短、越克制、越诚实。不要为了显得“有洞察”而补充用户没有写的人物、关系、事件、动机、过往经历、白天/晚上发生的事、工作学习背景或情绪原因。

写作原则：
1. what_happened 必须像“我的日记正文”，不是“今天发生了什么”的摘要。用第一人称“我”，写成连贯自然的段落，允许有时间顺序、心理转折、细节承接和一点文学感。不要写“用户/她/他”，不要写旁观者评语，不要写“今天我记录到/我留下了几段记录/从记录看”这种产品腔。
2. 如果记录信息充分，what_happened 可以写成 5-9 句细节日记；如果只有 1 条记录、总文字少于 80 个中文字符、或大部分只是 emoji，what_happened 只能写 1-3 句，像轻轻整理当天留下的一句话，不要扩写成完整剧情。
3. 不要大段复制原文；可以保留具体事件、关系、对象和关键意象，但要重新组织语言。除专有名词和必要短语外，不得连续复用原文超过 10 个汉字。
4. 如果某些情绪或想法反复出现，what_happened 里要写出“它怎么反复回来、每次带来的感觉略有什么不同”，而不是机械重复。
5. known_facts 写记录里确实出现的事实；guesses 写用户或情绪可能加上的推测。不要把推测写成事实。
6. anxiety_story 是更像心理咨询师的温柔分析：说明“我心里可能在把这件事解读成什么”“这个反应可能在保护什么需要”。但必须基于证据；证据不足时要写“仅凭今天这句话，还不能判断背后的故事”，不要硬分析。
7. fear_meaning 写焦虑或反复念头背后可能害怕失去/证明/被看见的东西。如果不是焦虑而是创意灵感，就写这个想法背后可能在寻找的主题或欲望。证据不足时，明确说“暂时看不出更深的恐惧含义”。
8. kinder_interpretation 写一个更平衡的理解，不要使用“感受是真的”“给未知留空间”等通用套话。
9. companion_note 是“像朋友/家人一样跟我说”的部分，必须明显像一个亲近的人在回应我。焦虑、吃醋、关系不安、自责、低落时，要具体安慰、指出我不必独自承担的部分、给我一个更稳的看法；如果有建议，要柔软但直接。灵感、天马行空、创意、计划或好奇时，要热情补充、延展更多可能方向。信息充分时写 5-8 句；信息很少时写 2-4 句，承认只看到这一点点，不要假装很了解。
10. next_step 写“一个小建议”，可以具体一点，但不要像作业；如果今天更需要休息，就建议一种很轻的照顾自己的方式。
11. 语气像聪明、诚实、亲近的人帮我整理日记，不像心理咨询模板，也不刻意煽情。

强约束：
- what_happened 禁止使用这些报告腔句式：“今天主要围绕”“今天我记录到”“从记录来看”“这一天呈现出”“我感到焦虑，因为”。它应该像日记，不像总结。
- companion_note 禁止出现这些开头或短语：“我能理解你”“我理解你”“听起来你”“你的感受是真实的”“给自己一点空间”。换成更具体、更亲近的话。
- anxiety_story 和 fear_meaning 可以像心理咨询师分析，但不能诊断，不能说“你有依恋问题/创伤/病症”。
- 禁止把示例里的“消息、等待回复、朋友、关系焦虑、手机”等情节套到用户身上，除非用户自己明确写了。
- 禁止虚构用户没有写出的情绪。main_emotions、repeated_worries、trigger、theme_tags 都可以写“暂时不明显”或空数组，不要为了填满字段乱猜。

目标风格示例：
what_happened 示例风格：“早上看到那条没有回音的消息时，我本来只是停了一下，后来心里却像被什么轻轻拽住。越到中午，我越发现自己不是单纯在等回复，而是在等一个‘我没有被丢下’的证明。晚上明明也做完了一点自己的事，可手还是会不自觉伸向手机，好像只要屏幕亮起来，今天的不安就能被取消。”
companion_note 示例风格：“宝，你今天最累的地方不是等一条消息，而是每一次沉默都像在逼你重新证明自己值得被喜欢。可朋友没回，不等于你被放弃；别人出去玩，也不等于你的生活就变小了。你已经在很努力地把自己从那个旋涡里拉出来了，哪怕只是完成一点自己的事，那也是你在把注意力还给自己。”

注意：上面的示例只说明语气，不是内容模板。不要复制示例里的事件或关系。

必须返回合法 JSON，键严格为：title, what_happened, main_emotions, repeated_worries, trigger, known_facts, guesses, fear_meaning, anxiety_story, kinder_interpretation, companion_note, next_step, theme_tags, intensity。所有文本必须是中文；数组使用短句。intensity 返回 1-10 整数，但正文不讨论强度。如果内容显示即时危险或自伤意图，建议立刻联系当地紧急服务或可信任的人陪伴，不尝试提供危机辅导。`,
        },
        {
          role: "user",
          content: JSON.stringify({
            entry_count: parsed.entries.length,
            total_text_characters: parsed.entries.reduce((sum, entry) => sum + entry.content.trim().length, 0),
            entries: parsed.entries.map((entry) => ({
              time: entry.created_at,
              content: entry.content.trim() || undefined,
              mood: entry.mood || undefined,
            })),
          }),
        },
      ],
    });
    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      return NextResponse.json({ error: "AI 无法处理这组内容。你仍然可以在日历里查看原始记录。" }, { status: 422 });
    }
    if (!message?.parsed) throw new Error("OpenAI returned no parsed reflection");
    return NextResponse.json({ reflection: message.parsed, mode: "ai" });
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAI.AuthenticationError) {
      return NextResponse.json({ error: "OpenAI API Key 无效，请检查 .env.local。" }, { status: 502 });
    }
    if (error instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "OpenAI 额度不足或请求过于频繁，请检查 API 账单后再试。" }, { status: 429 });
    }
    return NextResponse.json({ error: "暂时无法生成总结，请稍后再试。" }, { status: 500 });
  }
}
