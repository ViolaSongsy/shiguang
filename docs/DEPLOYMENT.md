# Deploy Shiguang

Use a separate database for local development, previews, and production. The repository contains source code and fictional screenshots, not a hosted-service promise or user data.

## Vercel + Turso

1. Fork this repository into your GitHub account.
2. Create a Turso database and an auth token using [Turso's documentation](https://docs.turso.tech/quickstart).
3. Import your repository into Vercel as a Next.js project. Use Node.js 22.
4. Set production environment variables from the table below. Never paste secrets into issues or commit them.
5. Deploy, then test sign-up, sign-in, entry creation, export, and password reset with a disposable account.

| Variable | Hosted configuration |
| --- | --- |
| `TURSO_DATABASE_URL` | Your remote `libsql://…` URL. Required for durable data on Vercel. |
| `TURSO_AUTH_TOKEN` | Your database token. |
| `APP_URL` | The canonical HTTPS app domain; password-reset links use this value. |
| `RESEND_API_KEY` | A Resend key that can send mail. Without it, the current app logs reset links instead of emailing them. |
| `EMAIL_FROM` | A sender/domain authorized by Resend. |
| `OPENAI_API_KEY` | Optional. Enables real AI calls and usage charges on the hosting operator's account. |
| `OPENAI_MODEL` | Optional model name; choose one your API account can access. |
| `TRUSTED_PROXY_IP_HEADER` | On Vercel, `x-vercel-forwarded-for`; use only a header the hosting proxy overwrites. |

The schema initializes automatically when a server data operation first runs. Database credentials must permit the initialization and migration statements in `lib/db.ts`. Never point preview deployments with unreviewed code at your production journal database.

### GitHub pushes and production

In **Project Settings → Environments → Production → Branch Tracking**, set your intended production branch (`master` in this repository). With the Git integration enabled, updates to that branch create production deployments; other branches normally create previews. Check the exact commit and **Production / Ready / Current** indicators on the deployment page. See [Vercel's Git documentation](https://vercel.com/docs/git).

If **Auto-assign Custom Production Domains** is disabled, a build can succeed without becoming the version served by your domain. Check the environment/domain assignment before promoting it. Changes to environment variables apply to a new deployment, not to an already-running build.

## A persistent Node server

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm start
```

Provide environment variables to the process, use HTTPS through a trusted reverse proxy, and supervise the process. A local file database is suitable only when `data/` is on durable storage and you have a tested backup/restore procedure. The app uses a Node runtime and native SQLite dependencies; a static export or edge-only runtime is not supported.

For self-hosted IP limits, set `TRUSTED_PROXY_IP_HEADER=x-real-ip` only when your proxy replaces that header and direct application access is blocked. Otherwise leave it unset; quotas fall back to per-email, per-user, or per-reset-token identities, which cannot prevent abuse rotating across identities.

## Verify before sharing an instance

- Create two disposable accounts and confirm one account cannot read/delete the other's entries or exports.
- Request a reset email and verify it arrives, has the correct HTTPS domain, expires, is single-use, and invalidates old sessions after a password change.
- Test both successful and failed transactions against your chosen remote database. The committed integration suite currently covers local SQLite, not Turso.
- Confirm data survives process restarts and deployments. Make a backup, then test restoration in a separate environment. UI JSON export is not currently a full import/restore feature.
- Upgrade an already-installed browser service worker and confirm the old page cache is cleared. Private pages should fail normally when offline, not reveal a cached journal.
- Set deliberate registration, abuse, cost, log-retention, and incident-response policies. Configure provider budgets/alerts; application rate limits alone are not a spending cap.

## What is not in Git

`.env.*` files other than `.env.example`, the contents of `data/` other than `.gitkeep`, database files, private keys, and build output are ignored. This does not remove files already committed in old Git history. Review history before changing a private repository's visibility.

Publishing the repository does not publish a database. It also does not convert an existing personal deployment into a safe public demo. For screenshots or demonstrations, create a separate instance with fictional data and separate credentials.
