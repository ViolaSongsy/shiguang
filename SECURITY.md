# Security policy

## Reporting a vulnerability

Do not post credentials, journal entries, reset links, or exploit details in a public issue.

Use GitHub's **Security → Report a vulnerability** on this repository if private vulnerability reporting is available. If that option is unavailable, open a public issue containing only a request for a private reporting channel; do not include technical or personal details until a private channel is established.

Include the affected commit, the impact, and a minimal reproduction using fictional accounts in an isolated environment. Do not test against other people's accounts or the maintainer's hosted instance.

## Supported code

Security fixes target the current `master` branch. Older commits are not maintained release lines. Keep framework and dependency patches current, and review Dependabot updates before merging.

## Dependency audit status

On October 21, 2026, `npm audit --omit=dev` reported no known production dependency vulnerabilities. The full audit still reports the upstream, unpatched [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) through the Next.js ESLint toolchain. This is a development dependency chain, not an application runtime dependency. Follow upstream updates and do not describe a clean production audit as a clean audit of all dependencies. CI uses read-only repository permissions and no service credentials.

ESLint 9 is retained for compatibility with the peer ranges of the current Next.js lint plugins; that ESLint major is end-of-life. Move the lint toolchain to ESLint 10 when those plugins support it. Do not use `npm audit fix --force` without reviewing the proposed framework changes.

## Security boundaries

- Passwords use salted `scrypt` hashes. Session and reset-token secrets are stored as SHA-256 hashes.
- API routes authenticate users and scope journal queries by user ID.
- Password changes and account deletion use database transactions.
- Service worker caches are restricted to an explicit list of public icons and the manifest.
- Rate limits use a configured trusted proxy IP or an operation-specific identity. Identity fallback alone does not stop abuse spread over many accounts or reset tokens.
- Journal text is **not end-to-end encrypted**. A host or database administrator can read stored content.
- Optional AI requests send selected text to OpenAI. Browser speech recognition may use the browser vendor's remote service.

This is a self-hosted early-stage application, not a security-audited product or medical service. Publishing source code does not establish that a hosted instance is safe for sensitive data. Review [deployment requirements](docs/DEPLOYMENT.md) and [privacy and data flow](docs/PRIVACY.md) before operating a shared instance.
