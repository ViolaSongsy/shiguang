<div align="center">

![拾光 — 接住此刻，收藏微光](docs/assets/banner.svg)

**一个可以自己部署的中文日记项目，记录想法、心情与灵感，按需生成 AI 回望。**

[English](README.md) · [快速开始](#快速开始) · [部署说明](docs/DEPLOYMENT.md) · [参与贡献](CONTRIBUTING.md)

</div>

有些念头来不及成为完整的故事。拾光想接住那些片段：任务之间的一句话，突然闪过的灵感，一个暂时说不清的心情。先留下来，再在日历里回看；是否让 AI 帮忙整理，由你决定。

这是一个以个人使用和自部署为目标的早期项目，尚未经过完整安全审计。

## 已有功能

- **轻量记录**：文字、单独的 emoji 心情，以及浏览器支持的中文语音输入。
- **日历回看**：按天查看原始片段和保存的每日总结。
- **可选 AI**：手动触发每日回望与 7/30 天趋势分析。未配置 OpenAI 时生成客观概览，不假装分析深层心理原因。
- **原文与总结分开**：AI 生成内容不会覆盖原始记录。
- **账号与数据管理**：邮箱密码登录、密码重设、删除账号，按日期范围导出 Markdown 或 JSON。
- **移动端优先**：深色星空界面、响应式导航、应用图标与 manifest。私密页面和 API 不进入 service worker 缓存；目前不支持离线日记。

## 界面预览

以下截图来自独立测试库，内容全部虚构，不包含真实日记。

![记录想法和心情](docs/assets/capture.jpg)

![用日历回看虚构的记录](docs/assets/archive.jpg)

## 快速开始

需要 **Node.js 22.13+** 和 npm；`.nvmrc` 使用 Node 22。

```bash
git clone https://github.com/ViolaSongsy/shiguang.git
cd shiguang
nvm use                       # 已安装 nvm 时可用
npm ci
cp .env.example .env.local
npm run dev
```

打开 [localhost:3000](http://localhost:3000)，注册本地账号即可使用。默认数据库是 `data/anxiety-journal.db`。本地体验不需要 Turso、OpenAI 或邮件服务；没有邮件配置时，密码重设链接会打印在终端。

需要真实 AI 时，在 `.env.local` 设置 `OPENAI_API_KEY`。模型通过 `OPENAI_MODEL` 配置，默认是 `gpt-4o-mini`。请求由服务器发送，API key 不会传给浏览器。

## 部署

详见 [Deployment](docs/DEPLOYMENT.md)：包括 Vercel + Turso、持久化 Node 服务、环境变量，以及 GitHub 分支到 Preview / Production 的关系。

**本地数据与线上数据不会自动同步。** Git push 上传代码，不会上传日记、数据库或 `.env.local`。Vercel 上需要配置远程数据库；本地文件库不适合作为无持久化磁盘的线上存储。

## 开发检查

先停止开发服务器，再运行：

```bash
npm run lint
npm run typecheck
npm run build
npm run test:integration
```

测试使用临时端口和可丢弃的独立 SQLite 数据库，不调用真实 AI 或发送邮件，也不会操作你的本地日记库。CI 会在 PR 和 `master` 推送时运行这些检查。

## 隐私与当前边界

- 密码经过加盐哈希；这不等于日记内容已加密。**目前不提供端到端加密**，服务和数据库管理员可能读取内容。
- 手动请求 AI 总结时，所选文本会发送到 OpenAI。
- 语音识别由浏览器提供，音频可能交由浏览器厂商的远程服务处理。
- 有数据导出，但尚没有完整的导入恢复流程。
- 草稿恢复、连续语音去重、远程事务和真实浏览器缓存升级测试仍在 [路线图](docs/ROADMAP.md) 中。

详见 [隐私与数据流](docs/PRIVACY.md) 和 [安全政策](SECURITY.md)。拾光是记录工具，不提供医疗、诊断、治疗或危机干预服务。

## 项目结构

`app/` 放页面和 API，`components/` 放共享界面与状态，`lib/` 放数据库、登录、日期、邮件和限流逻辑，`tests/` 放集成测试，`docs/` 放文档与演示素材。

## 参与贡献

欢迎提交问题和小而集中的改进，中英文都可以。先读 [贡献指南](CONTRIBUTING.md)，反馈与截图请使用虚构数据；安全问题请通过 [私下渠道](SECURITY.md) 报告。

## 许可

[MIT](LICENSE) © 2026 ViolaSongsy。开源的是代码与仓库素材，不包含任何线上用户日记。
