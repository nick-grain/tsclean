# tsclean

TypeScript AST checks and rewrites for Claude Code PreToolUse hooks on Edit/Write/MultiEdit.
Hook command: `node ~/tsclean/src/hook.ts`. Toggle checks in `tsclean.config.ts` (or set `TSCLEAN_CONFIG`).
`npm test` runs the suite, `npm run typecheck` runs tsc. Needs Node >= 23.6.
