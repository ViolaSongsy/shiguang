# Why Shiguang is built this way

Shiguang explores a small product problem: thoughts and moods often arrive as fragments, while a conventional journal expects a finished entry. Its capture, calendar, and reflection views turn those fragments into a reviewable record without requiring AI to write the original entry.

## Implementation focus

The repository combines a Chinese-first capture interface, account-scoped persistence, optional structured AI responses, and a self-hosting workflow. Implementation work spans the Next.js/React UI, server routes and database schema, authentication and exports, abuse limits, and integration checks. Screenshots use fictional data rather than a hosted user's journal.

## Decisions and tradeoffs

| Decision | Reason | Cost or limitation |
| --- | --- | --- |
| Save original entries separately from reflections | A generated interpretation should not overwrite the source material. | Two data flows and views must stay understandable. |
| Make AI explicitly requested and optional | Capture and review should work without an API key. | The fallback is a factual overview, not a substitute for model analysis. |
| Validate AI output with Zod and structured response formats | The interface needs predictable fields and explicit failures. | SDK and schema-library upgrades must be tested together; valid structure does not guarantee accurate interpretation. |
| Use local SQLite or remote Turso behind the same client | A local clone can run with few services; serverless hosting can use persistent remote storage. | Remote transactions and backups need separate operational verification. |
| Authenticate server routes and scope queries by user | Hiding a page is insufficient to protect journal APIs. | Authorization needs integration tests; journal text is not end-to-end encrypted. |
| Restrict the service worker to public static assets | Private journal responses should not remain in a browser cache. | The app does not provide offline journal access. |
| Fall back to operation-specific identities for rate limits | A deployment without a trusted proxy should not put every user in one shared IP bucket. | An identity limit cannot stop abuse spread across many identities. |

## Problems turned into checks

- **Shared fallback limits:** failed attempts for one account must not block another. Tests cover isolation, email casing, spoofed IP headers, and configured trusted proxies.
- **Cross-account access:** export and delete routes must operate only on the authenticated user's data; logout must invalidate the session.
- **SDK migration:** daily reflection and trend routes use the stable Chat Completions parse helper. Local fake-provider tests exercise Zod-backed parsing, refusals, invalid output, authentication failures, and rejection before a provider call.

CI runs lint, generated route types, the production build, and isolated HTTP integration tests. The fake-provider tests exercise the real SDK without sending journal content or credentials to an external service. They validate the application's API contract, not a live model's writing quality.

## Next tradeoffs to resolve

Draft recovery, text typed while a save is pending, and cumulative speech results remain product priorities. A broadly shared hosted instance also needs reviewed registration, retention, origin checks, reset-email delivery, and backup/restore procedures. See the [roadmap](ROADMAP.md), [privacy notes](PRIVACY.md), and [deployment guide](DEPLOYMENT.md).
