"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useJournal } from "@/components/data-provider";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useJournal();
  const [createAccount, setCreateAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = createAccount ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (message) return setError(message);
    router.push("/capture");
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <p className="eyebrow">拾光</p>
        <h1>{createAccount ? "为自己留一片星空。" : "欢迎回来。"}</h1>
        <p className="lede">想法不必完整，也值得被好好接住。</p>
        <input className="input" onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" required type="email" value={email} />
        <input className="input" minLength={8} onChange={(e) => setPassword(e.target.value)} placeholder="密码（至少 8 位）" required type="password" value={password} />
        {error ? <p className="error-note">{error}</p> : null}
        <button className="primary" disabled={busy} type="submit">{busy ? "请稍等……" : createAccount ? "创建账号" : "登录"}</button>
        <p className="login-switch">
          {createAccount ? "已经有账号？" : "第一次来到这里？"}
          <button onClick={() => setCreateAccount((value) => !value)} type="button">{createAccount ? " 去登录" : " 创建账号"}</button>
        </p>
        {!createAccount ? <p className="login-switch"><Link href="/forgot-password">忘记密码？</Link></p> : null}
        <p className="login-legal">继续使用代表你理解：拾光不是医疗或危机干预服务。<Link href="/privacy">查看隐私说明</Link></p>
      </form>
    </div>
  );
}
