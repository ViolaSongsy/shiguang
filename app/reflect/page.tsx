"use client";

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useJournal } from "@/components/data-provider";
import { ReflectionView } from "@/components/reflection-view";
import { localDateKey } from "@/lib/date";
import type { ReflectionDraft } from "@/lib/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function monthCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index + 1))];
}

export default function ReflectPage() {
  const { entries, reflections, addReflection } = useJournal();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [summaryMode, setSummaryMode] = useState<"ai" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const today = localDateKey();
  const todayEntries = entries.filter((entry) => localDateKey(new Date(entry.created_at)) === today);
  const existingToday = reflections.find((item) => item.reflection_date === today);
  const selectedReflection = reflections.find((item) => item.reflection_date === selectedDate);
  const reflectionDates = useMemo(() => new Set(reflections.map((item) => item.reflection_date)), [reflections]);
  const cells = useMemo(() => monthCells(month), [month]);

  async function generateAndSave() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: todayEntries }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "暂时无法生成总结。");
      setSummaryMode(body.mode === "ai" ? "ai" : "demo");
      await addReflection(body.reflection as ReflectionDraft, today);
      setSelectedDate(today);
      setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法生成总结。");
    } finally {
      setBusy(false);
    }
  }

  function changeMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="page reflect-page">
      <div className="reflect-top-layout">
        <div>
          <section className="reflect-hero">
            <div><p className="eyebrow"><Sparkles size={13} /> 今日回望</p><h1>把今天散落的片段，<br />连成一小片星图。</h1></div>
          </section>
          <p className="lede">今天留下了 {todayEntries.length} 个瞬间。点击一次就会生成并保存；再次点击会更新今天的总结。</p>
          {error ? <p className="error-note">{error}</p> : null}
          {saved ? <p className="success-note">今天的{summaryMode === "ai" ? " AI 总结" : "本地概览"}已经更新到日历。</p> : null}
          {summaryMode === "demo" ? <p className="local-mode-note">当前未连接 OpenAI，因此只生成不复制原文的客观概览，不会分析内容之间的深层联系。</p> : null}
          <div className="reflect-action-panel">
            <div>
              <p className="eyebrow">今日整理</p>
              <p>{existingToday ? "今天已经有总结了，再点一次会用最新记录更新它。" : "把今天的原始片段整理成一篇更完整的日记。"}</p>
            </div>
            <button className="primary glow-button" disabled={busy || todayEntries.length === 0} onClick={generateAndSave} type="button">
              <Sparkles size={17} />{busy ? "正在整理并保存……" : existingToday ? "更新今天总结" : "总结今天"}
            </button>
          </div>
        </div>

        <aside className="calendar-card compact-calendar">
          <header className="calendar-header">
            <button aria-label="上个月" onClick={() => changeMonth(-1)} type="button"><ChevronLeft size={18} /></button>
            <h2>{month.getFullYear()} 年 {month.getMonth() + 1} 月</h2>
            <button aria-label="下个月" onClick={() => changeMonth(1)} type="button"><ChevronRight size={18} /></button>
          </header>
          <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid summary-calendar-grid">
            {cells.map((date, index) => date ? (
              <button
                aria-label={`${date.getMonth() + 1}月${date.getDate()}日${reflectionDates.has(localDateKey(date)) ? "，有总结" : "，无总结"}`}
                className={`${reflectionDates.has(localDateKey(date)) ? "has-entry has-summary" : ""} ${selectedDate === localDateKey(date) ? "selected" : ""}`}
                key={localDateKey(date)}
                onClick={() => setSelectedDate(localDateKey(date))}
                type="button"
              >
                <span>{date.getDate()}</span>
                {reflectionDates.has(localDateKey(date)) ? <i /> : null}
              </button>
            ) : <span className="calendar-blank" key={`blank-${index}`} />)}
          </div>
        </aside>
      </div>

      <section className="summary-calendar-section">
        <div className="selected-summary">
            <div className="selected-summary-date">
              <p className="eyebrow">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("zh-CN", { weekday: "long" })}</p>
              <h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</h2>
            </div>
            {selectedReflection ? (
              <div className="reflection-card"><ReflectionView reflection={selectedReflection} /></div>
            ) : <div className="empty star-empty">这一天还没有保存总结。</div>}
        </div>
      </section>
    </div>
  );
}
