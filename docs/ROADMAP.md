# Roadmap

This file describes priorities, not delivery commitments.

## Next

- Recover unsaved drafts with explicit account isolation and logout cleanup.
- Preserve text typed while a save request is in flight.
- Avoid duplicating cumulative browser speech-recognition results.
- Test Turso remote transactions and real browser service-worker upgrades.
- Expand authorization coverage and automate transaction rollback regression checks.
- Move to a supported ESLint major when the Next.js lint plugins' peer ranges permit it, and track the unpatched upstream `braces` development-tool advisory.

## Before a broadly shared hosted service

- Verify persistent database storage, restore procedures, reset-email delivery, and trusted proxy configuration.
- Add explicit request-origin checks and a reviewed authentication/abuse strategy.
- Add email verification or a deliberate registration policy.
- Add safe retention and cleanup for rate-limit records, expired tokens, and sessions.
- Add a password-confirmation step for account deletion.
- Review accessibility, mobile keyboard behavior, privacy copy, and crisis-related language with appropriate expertise.
- Give a hosted instance its own operator contact, retention policy, terms, and monitoring.

## Possible product improvements

- Edit and search original entries.
- Offer explicit timezone preferences for grouping entries and exports.
- Add import/restore with duplicate handling and a preview step.
- Improve long-history loading with pagination.

The app already supports text and mood capture, browser-dependent speech input, calendar review, optional daily/trend AI reflections, account deletion, and Markdown/JSON exports. Export is not currently a full restore workflow.
