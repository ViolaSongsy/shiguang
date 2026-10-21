"use client";

import { Download, FileJson, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useJournal } from "@/components/data-provider";

type ExportRange = "all" | "30" | "90" | "365" | "custom";
type ExportType = "entries" | "reflections";
type ExportFormat = "markdown" | "json";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useJournal();
  const [confirmText, setConfirmText] = useState("");
  const [exportRange, setExportRange] = useState<ExportRange>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function exportHref(type: ExportType, format: ExportFormat) {
    const params = new URLSearchParams({ type, format, range: exportRange });
    if (exportRange === "custom") {
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
    }
    return `/api/export?${params.toString()}`;
  }

  async function deleteAccount() {
    if (confirmText !== "删除我的账号") return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/account", { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "暂时无法删除账号。");
    await signOut();
    router.push("/login");
  }

  return (
    <div className="page settings-page">
      <p className="eyebrow">账号设置</p>
      <h1>管理你的账号<br />和数据。</h1>
      <p className="lede">当前账号：{user?.email}</p>

      <section className="glass-card export-panel">
        <p className="eyebrow"><Download size={13} /> 导出数据</p>
        <h2>把过去的日记和总结带走</h2>

        <div className="export-range">
          <label>
            导出范围
            <select className="select" onChange={(event) => setExportRange(event.target.value as ExportRange)} value={exportRange}>
              <option value="all">全部记录</option>
              <option value="30">过去 30 天</option>
              <option value="90">过去 90 天</option>
              <option value="365">过去一年</option>
              <option value="custom">自定义日期</option>
            </select>
          </label>
          {exportRange === "custom" ? (
            <div className="date-range-grid">
              <label>
                开始日期
                <input className="input" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
              </label>
              <label>
                结束日期
                <input className="input" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
              </label>
            </div>
          ) : null}
        </div>

        <div className="export-grid">
          <div className="export-card">
            <FileText size={22} />
            <h3>导出过去日记</h3>
            <p>包含每条原始记录、心情 emoji 和具体时间。</p>
            <div className="export-actions">
              <a className="export-button" href={exportHref("entries", "markdown")}>下载 Markdown</a>
              <a className="export-ghost" href={exportHref("entries", "json")}><FileJson size={14} /> JSON</a>
            </div>
          </div>
          <div className="export-card">
            <FileText size={22} />
            <h3>导出过去总结</h3>
            <p>包含每日 AI 日记、情绪、分析、朋友式建议和下一步。</p>
            <div className="export-actions">
              <a className="export-button" href={exportHref("reflections", "markdown")}>下载 Markdown</a>
              <a className="export-ghost" href={exportHref("reflections", "json")}><FileJson size={14} /> JSON</a>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card danger-card">
        <p className="eyebrow"><Trash2 size={13} /> 删除账号</p>
        <h2>永久删除所有数据</h2>
        <p>这会删除你的账号、登录状态、所有记录、每日总结和趋势数据。这个操作不能恢复。</p>
        <input className="input" onChange={(event) => setConfirmText(event.target.value)} placeholder="输入：删除我的账号" value={confirmText} />
        {error ? <p className="error-note">{error}</p> : null}
        <button className="danger-button" disabled={busy || confirmText !== "删除我的账号"} onClick={deleteAccount} type="button">
          {busy ? "删除中……" : "永久删除账号"}
        </button>
      </section>
    </div>
  );
}
