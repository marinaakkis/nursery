# AGENTS.md

Security policy is defined in `.cursor/rules/00-security.mdc` and `.claude/rules/security.md`.
Follow it without exception. Do not commit secrets. Do not run `git push` without explicit request.

## Project

<!-- Fill in: brief project description, business context -->

## Tech stack

<!-- Fill in: languages, frameworks, databases, key libraries -->

## Commands

<!-- Fill in: build, test, lint, migration commands -->

## Code conventions

- Validate inputs at boundaries. Use parameterized DB queries. Escape HTML output.
- No `eval()` / `exec()` / `Function()` with dynamic data. No secrets in code.
- Small focused functions and files. No debug output in commits. Tests before or with implementation.
- Conventional commits: `feat` `fix` `refactor` `docs` `test` `chore` `perf` `ci`.
