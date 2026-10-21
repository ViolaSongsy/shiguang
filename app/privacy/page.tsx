import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="login-page document-page">
      <article className="card login-card privacy-card">
        <p className="eyebrow">隐私说明</p>
        <h1>你的日记应该被认真保护。</h1>
        <p>拾光会保存你的账号邮箱、加盐哈希后的密码、登录会话和日记数据。密码不会以明文保存；日记内容并非端到端加密，服务运营者及其数据库访问权限持有者可能读取这些内容。</p>
        <p>当你点击“总结今天”或“生成趋势总结”时，相关文本会发送给 OpenAI 生成 AI 回望。不要在记录里输入你不希望被第三方 AI 服务处理的敏感信息。</p>
        <p>语音输入由你的浏览器提供，是否需要把音频发送到远程服务取决于浏览器实现。拾光不提供独立的录音存储服务。</p>
        <p>拾光不是医疗、心理诊断、治疗或危机干预服务。如果你有自伤念头、立即危险，或担心自己无法保持安全，请立刻联系当地紧急服务或身边可信任的人。</p>
        <p>你可以在账号设置里导出原始日记和每日总结，也可以永久删除账号和数据。删除后无法恢复。</p>
        <p>部署前建议你补充正式的联系方式、运营主体和适用地区法律条款。</p>
        <p className="login-switch"><Link href="/login">回到登录</Link></p>
      </article>
    </main>
  );
}
