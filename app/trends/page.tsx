"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useJournal } from "@/components/data-provider";
import type { Reflection } from "@/lib/types";

type TrendSummary = {
  title: string;
  emotional_weather: string;
  mood_direction: string;
  recurring_patterns: string[];
  improving_signs: string[];
  stuck_points: string[];
  gentle_reading: string;
  next_focus: string;
};

function countItems(items: string[]) {
  const counts = new Map<string, number>();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

export default function TrendsPage() {
  const { entries, reflections } = useJournal();
  const [days, setDays] = useState(7);
  const [trend, setTrend] = useState<TrendSummary | null>(null);
  const [trendMode, setTrendMode] = useState<"ai" | "demo" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recentEntries = entries.filter((item) => new Date(item.created_at) >= cutoff);
  const recentReflections = reflections.filter((item) => new Date(`${item.reflection_date}T12:00:00`) >= cutoff);
  const moods = countItems(recentEntries.map((item) => item.mood ?? ""));
  const themes = countItems(recentReflections.flatMap((item) => item.theme_tags));
  const activeDays = new Set(recentEntries.map((item) => new Date(item.created_at).toDateString())).size;
  const maxCount = Math.max(...moods.map(([, count]) => count), 1);

  function selectDays(nextDays: number) {
    setDays(nextDays);
    setTrend(null);
    setTrendMode(null);
    setError(null);
  }

  async function summarizeTrend() {
    setBusy(true);
    setError(null);
    try {
      const payload = recentReflections
        .sort((a, b) => a.reflection_date.localeCompare(b.reflection_date))
        .map((reflection: Reflection) => ({
          reflection_date: reflection.reflection_date,
          title: reflection.title,
          what_happened: reflection.what_happened,
          main_emotions: reflection.main_emotions,
          repeated_worries: reflection.repeated_worries,
          fear_meaning: reflection.fear_meaning,
          anxiety_story: reflection.anxiety_story,
          kinder_interpretation: reflection.kinder_interpretation,
          companion_note: reflection.companion_note,
          next_step: reflection.next_step,
          theme_tags: reflection.theme_tags,
          intensity: reflection.intensity,
        }));
      const response = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, reflections: payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "暂时无法生成趋势总结。");
      setTrend(body.trend as TrendSummary);
      setTrendMode(body.mode === "ai" ? "ai" : "demo");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法生成趋势总结。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page trends-page">
      <div className="section-head">
        <div><p className="eyebrow">你的星图</p><h1>看看最近，<br />哪些瞬间常常出现。</h1></div>
        <div className="toggle"><button className={days === 7 ? "active" : ""} onClick={() => selectDays(7)}>近 7 天</button><button className={days === 30 ? "active" : ""} onClick={() => selectDays(30)}>近 30 天</button></div>
      </div>
      <p className="lede">这里会用每日回望再整理一次趋势，看看情绪有没有变轻、反复故事有没有松动。</p>
      <div className="stats-grid">
        <div className="stat"><strong>{recentEntries.length}</strong><span>个记录瞬间</span></div>
        <div className="stat"><strong>{activeDays}</strong><span>天留下足迹</span></div>
        <div className="stat"><strong className="emoji-stat">{moods[0]?.[0] ?? "✦"}</strong><span>最常出现的心情</span></div>
      </div>
      <section className="trend-summary-panel">
        <div>
          <p className="eyebrow">AI 趋势回望</p>
          <h2>{days === 7 ? "过去 7 天" : "过去 30 天"}的心情走向</h2>
          <p>基于 {recentReflections.length} 天已保存的每日总结生成，不直接分析原始片段。</p>
        </div>
        <button className="primary" disabled={busy || recentReflections.length === 0} onClick={summarizeTrend} type="button">
          <Sparkles size={16} />{busy ? "正在看星图……" : "生成趋势总结"}
        </button>
      </section>
      {error ? <p className="error-note">{error}</p> : null}
      {trendMode === "demo" ? <p className="local-mode-note">当前未连接 OpenAI，因此这里只能显示本地概览。</p> : null}
      {trend ? (
        <section className="glass-card trend-card">
          <p className="eyebrow">趋势总结</p>
          <h2>{trend.title}</h2>
          <div className="trend-grid">
            <section className="trend-block wide"><h3>整体天气</h3><p>{trend.emotional_weather}</p></section>
            <section className="trend-block"><h3>心情有没有变化</h3><p>{trend.mood_direction}</p></section>
            <section className="trend-block"><h3>接下来观察</h3><p>{trend.next_focus}</p></section>
            <section className="trend-block"><h3>反复出现</h3><ul>{trend.recurring_patterns.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section className="trend-block"><h3>变好的迹象</h3><ul>{trend.improving_signs.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section className="trend-block"><h3>还卡着的地方</h3><ul>{trend.stuck_points.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section className="trend-block wide accent"><h3>温柔一点看</h3><p>{trend.gentle_reading}</p></section>
          </div>
        </section>
      ) : null}
      <section className="glass-card">
        <div className="section-head"><h2>心情天气</h2><span className="hint">按记录次数</span></div>
        {moods.length ? <div className="bar-list">{moods.map(([mood, count]) => (
          <div key={mood}><div className="bar-head"><span className="bar-emoji">{mood}</span><span>{count} 次</span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} /></div></div>
        ))}</div> : <div className="empty">点几次心情 emoji 后，这里会慢慢有颜色。</div>}
      </section>
      {themes.length ? <section className="theme-cloud"><p className="eyebrow">最近的关键词</p><div>{themes.slice(0, 8).map(([theme]) => <span key={theme}>{theme}</span>)}</div></section> : null}
    </div>
  );
}
