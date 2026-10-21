"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { useJournal } from "@/components/data-provider";
import { ReflectionView } from "@/components/reflection-view";
import { localDateKey } from "@/lib/date";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function monthCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index + 1))];
}

export default function ArchivePage() {
  const { entries, reflections, deleteEntry } = useJournal();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cells = useMemo(() => monthCells(month), [month]);
  const activeDates = useMemo(() => new Set([
    ...entries.map((entry) => localDateKey(new Date(entry.created_at))),
    ...reflections.map((reflection) => reflection.reflection_date),
  ]), [entries, reflections]);
  const dayEntries = entries
    .filter((entry) => localDateKey(new Date(entry.created_at)) === selectedDate)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const dayReflection = reflections.find((reflection) => reflection.reflection_date === selectedDate);

  function changeMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  async function removeEntry(id: string) {
    setDeletingId(id);
    setMessage(null);
    try {
      await deleteEntry(id);
      setMessage("这条记录已经删除。");
      setTimeout(() => setMessage(null), 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时无法删除。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page calendar-page">
      <div className="archive-top-layout">
        <div>
          <p className="eyebrow"><CalendarDays size={13} /> 时光日历</p>
          <h1>回到某一天，<br />看看那时的自己。</h1>
          <p className="lede">选择一天，看那天留下的想法与心情。删除模式只删除单条原始记录。</p>
        </div>
        <aside className="calendar-card floating-calendar">
          <header className="calendar-header">
            <button aria-label="上个月" onClick={() => changeMonth(-1)} type="button"><ChevronLeft size={18} /></button>
            <h2>{month.getFullYear()} 年 {month.getMonth() + 1} 月</h2>
            <button aria-label="下个月" onClick={() => changeMonth(1)} type="button"><ChevronRight size={18} /></button>
          </header>
          <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {cells.map((date, index) => date ? (
              <button
                aria-label={`${date.getMonth() + 1}月${date.getDate()}日${activeDates.has(localDateKey(date)) ? "，有记录" : "，无记录"}`}
                className={`${activeDates.has(localDateKey(date)) ? "has-entry" : ""} ${selectedDate === localDateKey(date) ? "selected" : ""}`}
                key={localDateKey(date)}
                onClick={() => setSelectedDate(localDateKey(date))}
                type="button"
              >
                <span>{date.getDate()}</span>
                {activeDates.has(localDateKey(date)) ? <i /> : null}
              </button>
            ) : <span className="calendar-blank" key={`blank-${index}`} />)}
          </div>
        </aside>
      </div>

      <section className="day-detail">
          <div className="day-detail-title">
            <div>
              <p className="eyebrow">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("zh-CN", { weekday: "long" })}</p>
              <h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}</h2>
            </div>
            <button className={`delete-mode-toggle ${deleteMode ? "active" : ""}`} onClick={() => setDeleteMode((value) => !value)} type="button">
              {deleteMode ? "完成删除" : "删除模式"}
            </button>
          </div>
          {message ? <p className="capture-message">{message}</p> : null}
          {dayEntries.length ? (
            <div className="timeline">
              {dayEntries.map((entry) => (
                <article className={`timeline-item ${deleteMode ? "can-delete" : ""}`} key={entry.id}>
                  <time>{new Date(entry.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
                  <span className="timeline-star" />
                  <div>{entry.mood && !entry.content ? <span className="timeline-mood">{entry.mood}</span> : <p>{entry.content}</p>}</div>
                  {deleteMode ? (
                    <button className="delete-entry-button" disabled={deletingId === entry.id} onClick={() => removeEntry(entry.id)} type="button">
                      {deletingId === entry.id ? "删除中" : "删除"}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : <div className="empty">这一天还没有留下记录。</div>}
          {dayReflection ? (
            <details className="daily-summary-details">
              <summary>查看这一天的总结 <span>+</span></summary>
              <div className="summary-content"><ReflectionView reflection={dayReflection} /></div>
            </details>
          ) : null}
      </section>
    </div>
  );
}
