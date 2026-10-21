"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "暂时无法发送重设邮件。");
    setMessage("如果这个邮箱注册过，我们已经发送了重设密码链接。");
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <p className="eyebrow">找回星空</p>
        <h1>重设密码。</h1>
        <p className="lede">输入注册邮箱，我们会发送一个 30 分钟内有效的重设链接。</p>
        <input className="input" onChange={(event) => setEmail(event.target.value)} placeholder="邮箱" required type="email" value={email} />
        {message ? <p className="success-note">{message}</p> : null}
        {error ? <p className="error-note">{error}</p> : null}
        <button className="primary" disabled={busy} type="submit">{busy ? "发送中……" : "发送重设链接"}</button>
        <p className="login-switch"><Link href="/login">回到登录</Link></p>
      </form>
    </div>
  );
}
