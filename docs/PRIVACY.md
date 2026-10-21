# Privacy and data flow

This document describes the source code's behavior. A hosted operator must supply their own contact, retention policy, access controls, and service-specific privacy notice. It is not a claim of legal compliance or end-to-end encryption.

## Stored data

| Data | Storage and purpose |
| --- | --- |
| Email and salted password hash | `users`; account lookup and authentication |
| Hashed session token and expiry | `sessions`; approximately 30-day login sessions |
| Hashed reset token and expiry/use time | `password_reset_tokens`; single-use, 30-minute resets |
| Original text, mood, timestamps, user ID | `entries`; journal history |
| Generated daily reflection and user ID | `reflections`; saved daily review |
| Quota identity, action, window, count | `rate_limits`; abuse limits |

Email-based rate-limit identities and reset-token identities are hashed. Existing databases created before this change may retain old rate-limit rows with raw emails until the operator removes them. Expired rate-limit rows and reset-token records do not yet have automatic retention cleanup.

Sessions are represented in the browser by an HTTP-only, SameSite=Lax cookie; it is marked Secure in production. The server stores the hash rather than the bearer token. Account deletion removes the user, sessions, reset tokens, entries, and reflections in one transaction. Rate-limit records, provider logs, and independent database backups may remain under the operator/provider's retention policies.

Daily reflections are persisted when saved. Trend responses are generated on request and displayed in the client; there is no separate stored trend table.

## External services

- **OpenAI:** when the signed-in user requests a daily reflection or trend, the server sends the selected text and associated mood/reflection fields. The app does not automatically analyze entries as they are typed.
- **Turso:** if configured, account and journal data are stored in the operator's remote database. Otherwise they use a local SQLite file.
- **Resend:** if configured, the recipient email and reset link are sent to Resend for delivery. Without a key, the current fallback prints the email and reset URL to server logs; configure delivery and restrict log access when hosting.
- **Browser speech recognition:** supplied by the browser, not by a recording service in this app. Some browsers send audio to a remote service. Availability and behavior vary.
- **Hosting and framework providers:** may keep access, error, deployment, and telemetry logs under their own configurations and policies.

## Important limits

Password hashing does not encrypt journal text. A host/database administrator can read stored entries and saved reflections. The app does not provide end-to-end encryption, a server-side encrypted-journal vault, or an audited crisis-response workflow.

The service worker only caches allowlisted public icons and the manifest. Ordinary browser caches, an unlocked device, screenshots, downloads, and browser speech providers have their own privacy implications. Exported Markdown/JSON files contain readable journal content; keep them private.

## Reporting issues

Use fictional accounts and entries in bug reports and screenshots. Follow [SECURITY.md](../SECURITY.md) for private vulnerability reports. Never attach real journal exports or `.env` files to a public issue.
