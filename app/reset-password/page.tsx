"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useState } from "react";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "暂时无法重设密码。");
    setMessage("密码已经更新。请用新密码登录。");
    setPassword("");
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <p className="eyebrow">新的入口</p>
        <h1>设置新密码。</h1>
        <p className="lede">密码至少 8 位。提交后，旧设备上的登录状态会被清除。</p>
        <input className="input" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="新密码（至少 8 位）" required type="password" value={password} />
        {message ? <p className="success-note">{message}</p> : null}
        {error ? <p className="error-note">{error}</p> : null}
        <button className="primary" disabled={busy || !token} type="submit">{busy ? "更新中……" : "更新密码"}</button>
        {!token ? <p className="error-note">链接里缺少 token，请重新发送重设邮件。</p> : null}
        <p className="login-switch"><Link href="/login">回到登录</Link></p>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="login-page"><div className="card login-card"><p className="lede">正在读取重设链接……</p></div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
