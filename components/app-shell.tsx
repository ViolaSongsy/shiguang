"use client";

import { BarChart3, CalendarDays, Feather, LogOut, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useJournal } from "@/components/data-provider";

const nav = [
  { href: "/capture", label: "记录", icon: Feather },
  { href: "/reflect", label: "回望", icon: Sparkles },
  { href: "/archive", label: "日历", icon: CalendarDays },
  { href: "/trends", label: "星图", icon: BarChart3 },
];

const publicPaths = ["/login", "/forgot-password", "/reset-password", "/privacy"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useJournal();
  const isPublicPath = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  useEffect(() => {
    if (!loading && !user && !isPublicPath) router.replace("/login");
    if (!loading && user && pathname === "/login") router.replace("/capture");
  }, [isPublicPath, loading, pathname, router, user]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  if (!loading && !user && !isPublicPath) return null;

  if (isPublicPath && !user) return <>{children}</>;

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/capture">
          <span className="brand-mark">星</span>
          <span>拾光</span>
        </Link>
        <p className="brand-caption">接住此刻，也收藏天马行空。</p>
        <nav className="side-nav">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link className={pathname === href ? "active" : ""} href={href} key={href}>
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          {user ? (
            <button className="signout" onClick={handleSignOut} type="button">
              <LogOut size={16} /> 退出登录
            </button>
          ) : null}
          <Link className="signout" href="/settings"><Settings size={16} /> 账号设置</Link>
          <p>这里陪你记录与回望，不代替专业医疗、诊断或危机支持。若你有自伤或立即危险，请联系当地紧急服务或可信任的人。</p>
          <Link href="/privacy">隐私说明</Link>
        </div>
      </aside>
      <header className="mobile-topbar">
        <Link className="mobile-brand" href="/capture"><span>星</span> 拾光</Link>
        {user ? <div className="mobile-top-actions"><Link href="/settings"><Settings size={15} /> 账号</Link><button onClick={handleSignOut} type="button"><LogOut size={15} /> 退出</button></div> : null}
      </header>
      <main className="main-content">{children}</main>
      <nav className="bottom-nav">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link className={pathname === href ? "active" : ""} href={href} key={href}>
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
