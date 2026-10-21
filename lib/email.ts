type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "拾光 <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[password-reset] ${to}: ${resetUrl}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "重设你的拾光密码",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#172033">
          <h2>重设你的拾光密码</h2>
          <p>点击下面的链接设置新密码。这个链接会在 30 分钟后失效。</p>
          <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#172033;color:#fff;text-decoration:none">重设密码</a></p>
          <p>如果不是你发起的请求，可以忽略这封邮件。</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Resend email failed: ${text || response.statusText}`);
  }
}
