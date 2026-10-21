# Contributing to Shiguang

Thanks for helping make a quieter place for everyday thoughts. Small, focused improvements are welcome; 中文和 English 都可以。

## Get started

1. Fork the repository and clone your fork.
2. Use Node.js 22 (`nvm use`) and run `npm ci`.
3. Copy `.env.example` to `.env.local` and run `npm run dev`.
4. Create a local account with fictional data. No OpenAI or email API key is needed for local development.
5. Create a branch for one focused change and open a pull request.

`private: true` in `package.json` prevents accidental publication to npm; it does not control GitHub visibility.

## Verify a change

Stop the dev server before building because dev and build share `.next/`:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:integration
```

Integration tests start their own production server on a temporary localhost port, use a disposable SQLite database, and disable real AI calls and email delivery. They do not use your local accounts or journal database. Add regression coverage when behavior changes; do not add tests solely to mirror implementation details.

## Project conventions

- TypeScript, two-space indentation, and the existing ESLint configuration.
- Keep UI text in Chinese and documentation understandable to both Chinese and English readers.
- Authenticate every data operation and scope every query to the current user.
- Keep OpenAI, Turso, and email credentials on the server.
- Do not replace the raw journal with generated text; reflections are stored separately.
- Do not introduce diagnosis, crisis-treatment claims, or unsupported psychological inferences.
- Discuss schema changes and new dependencies in the pull request.

## Privacy in contributions

Use invented text, `example.invalid` email addresses, and disposable databases in examples, screenshots, and tests. Never commit `.env.local`, database files, recordings, exports, credentials, or logs containing reset links. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Scope

The project focuses on capture, calendar review, and optional reflection. See [the roadmap](docs/ROADMAP.md) for current limitations and priorities. There is no promised response time or hosted-service SLA.
