# AGENTS.md

Shared instructions for Codex, Claude Code, Cursor, and other coding agents in this repository.

## Security And Scope

Security policy is defined in `.cursor/rules/rule.security.en.corporate-dlp.mdc` and `.claude/rules/rule.security.en.corporate-dlp.md`.
Follow it without exception.

- Do not commit secrets, credentials, keys, tokens, certificates, or sensitive personal data.
- Do not proactively read `.env`, `.env.*`, `secrets/`, `*.key`, `*.pem`, `*.p12`, `id_rsa`, or credential stores.
- Do not run `git push` without an explicit user request.
- Do not stage files for the user; keep agent edits in the working tree unless the user explicitly asks otherwise.
- Work only inside the current project workspace unless the user explicitly authorizes an external path.

**`.gitlab-ci.yml` immutable security block:** the leading block through the closing separator after `stages:` is read-only. Its canonical text is `templates/gitlab-ci.security-block.yml`. Never delete, edit, reorder, move, or comment out this block; append content only below it. See `.cursor/rules/rule.security.en.gitlab-ci-immutable-security-block.mdc`.

## AI Tooling Layout

- `AGENTS.md` — shared cross-agent project instructions.
- `.codex/config.toml` — Codex runtime configuration only.
- `.codex/hooks.json` — Codex hook wiring only.
- `.claude/CLAUDE.md` — short Claude Code project memory and imports.
- `.claude/settings.json` — executable Claude Code settings: permissions and hooks.
- `.claude/skills/*/SKILL.md` — generated Claude Code adapters that route to `.agents/skills`.
- `.cursor/rules/*.mdc` — Cursor project rules, scoped by `alwaysApply`, `globs`, or agent request.
- `.cursor/skills/README.md` — Cursor note explaining that canonical skills live in `.agents/skills`.
- `.opencode/opencode.json` — OpenCode runtime config using the modern permission model.
- `.agents/skills/*/SKILL.md` — canonical shared task workflows loaded only when relevant.
- `scripts/ai-hooks/run-hook-tool.mjs` — shared cross-platform hook runner.
- `scripts/ai-hooks/tool-manifest.json` — pinned hook tool versions and SHA256 integrity data.
- `docs/ai-tooling-index.md` — generated full index of skills, rules, commands, and hooks.
- `QUICK-START.md` — step-by-step onboarding guide.
- `.cursor/commands/*.md` — canonical Cursor/Claude slash commands (ai-sdlc run-phases, actualize-main-docs, publish-dev-requests-docs, critique, fix-by-comments).
- `.claude/commands/*.md` — generated Claude Code adapters that reference the canonical `.cursor/commands/*.md`; mark a Claude-only command with `claude-specific: true` to preserve it.
- `scripts/publish-dev-requests-docs/` — publishes dev-request docs to external storage (Obsidian; extensible to other services via strategy adapters).
- `scripts/serena-mcp/` — optional Serena MCP management (disabled by default).
- `.githooks/` — `pre-commit`/`pre-push` (integration-passport validator + `patterns/`).

Do not put general behavioral instructions into runtime config files. Keep runtime config executable and keep reusable process guidance in rules, skills, or this file.
After adding, removing, moving, or renaming skills, run `node scripts/ai-template-indexing/sync-claude-skill-adapters.mjs`. After the same for commands, run `node scripts/ai-template-indexing/sync-claude-command-adapters.mjs`. In either case also run `node scripts/ai-template-indexing/generate-ai-tooling-index.mjs`.

The four deployment skills are mirrored from `scripts/skills/deploy-skills.json`.
Use their local copies during work. When the user explicitly asks to update the
mirror, run `node scripts/skills/sync-deploy-skills.mjs --apply`, then regenerate
Claude skill adapters and the tooling index. Do not clone or update this source
implicitly while working on an application.

These externally managed skills are exempt from the local 500-line skill limit;
their integrity is enforced by `deploy-skills-sync` in GitLab CI.

## Project Initialization

At the start of work, check `.project-metadata.local.json`. If it is missing or
`isGitHooksInited` is false, offer to run the root setup script and wait for the
user's confirmation: `config-win.bat` on Windows or `./config-lin-mac.sh` on
Linux/macOS. The setup installs the pinned, SHA256-verified AI security hook as
well as the repository git hooks. `isGitHooksInited` tracks only the git hooks;
the AI hook verifies its own cached binary on every run.

If Cursor, Claude Code, or Codex reports that the AI security hook is missing,
cannot be downloaded, or fails integrity verification, offer to repair it and,
after confirmation, run:

```bash
node scripts/ai-hooks/run-hook-tool.mjs gitleaks --install
```

Do not bypass an installation or integrity error by disabling the hook or
switching it to warn mode. The first install needs registry access; a verified
cache runs offline.

## Project

<!-- Fill in: brief project description, business context -->

## Tech Stack

<!-- Fill in: languages, frameworks, databases, key libraries -->

## Commands

<!-- Fill in: build, test, lint, migration commands -->

## Code Conventions

- Validate inputs at boundaries. Use parameterized DB queries. Escape HTML output.
- No `eval()` / `exec()` / `Function()` with dynamic data. No secrets in code.
- Small focused functions and files. No debug output in commits. Tests before or with implementation.
- Conventional commits: `feat` `fix` `refactor` `docs` `test` `chore` `perf` `ci`.

## Scoped Workflow Triggers

Before creating or editing C4 diagrams, read `.agents/skills/skill.arch.ru.c4-diagrams/SKILL.md`.

Before creating or editing process diagrams under `docs/process-diagrams/`, read the matching skill:

| Type | Skill |
|---|---|
| Sequence (`sd.*`) | `.agents/skills/skill.arch.ru.sequence-diagrams/SKILL.md` |
| Workflow (`wf.*`) | `.agents/skills/skill.arch.ru.workflow-diagrams/SKILL.md` |
| BPMN (`bpmn.*`) | `.agents/skills/skill.arch.ru.bpmn-diagrams/SKILL.md` |
| DFD (`dfd.*`) | `.agents/skills/skill.arch.ru.dfd-diagrams/SKILL.md` |

Before creating or editing API contract documents under `docs/api-requirements/`, read:

| Type | Skill |
|---|---|
| OpenAPI REST (`openapi.*`, `openapi.external.*`) | `.agents/skills/skill.integration.ru.openapi-specs/SKILL.md` |
| AsyncAPI event-driven (`asyncapi.*`, `asyncapi.external.*`) | `.agents/skills/skill.integration.ru.asyncapi-specs/SKILL.md` |

When generating or updating `docs/architecture.md`, read `.agents/skills/skill.arch.en.architecture-md-artifact/SKILL.md`.

For modules structured as `.input/` and `docs/`, read `.agents/skills/skill.arch.ru.project-folder-layout/SKILL.md`. Do not add links from `docs/` markdown to `.input/` paths unless the repository explicitly overrides this rule.

For development planning artifacts (`dev-plan`, epics, tasks, status/version changelog), read `.agents/skills/skill.dev.ru.dev-planning/SKILL.md`.

After generating `docs/` from a spec, close requirement gaps with `.agents/skills/skill.arch.ru.architecture-requirements-interviewer/SKILL.md`.

For deferred or out-of-scope work, record future-tasks per `.cursor/rules/rule.governance.ru.future-tasks.mdc`.

For the formal AI-driven development process (AI-SDLC), read `.cursor/rules/rule.ai-sdlc.ru.process.mdc` first and follow the phase order: Research → Design → Planning → Implementation → Release Gate. The rule defines the gate modes (`review` default, `auto`, `plan-review`); do not skip or reorder phases. Phase skills and commands:

| Phase | Skill | Command |
|---|---|---|
| Research | `.agents/skills/skill.ai-sdlc.ru.phase-1-research/SKILL.md` | `command.ai-sdlc.ru.run-phase-1-research` |
| Design | `.agents/skills/skill.ai-sdlc.ru.phase-2-design/SKILL.md` | `command.ai-sdlc.ru.run-phase-2-design` |
| Planning | `.agents/skills/skill.ai-sdlc.ru.phase-3-planning/SKILL.md` | `command.ai-sdlc.ru.run-phase-3-planning` |
| Implementation | `.agents/skills/skill.ai-sdlc.ru.phase-4-implementation/SKILL.md` | `command.ai-sdlc.ru.run-phase-4-implementation` |
| Release Gate | `.agents/skills/skill.ai-sdlc.ru.phase-5-release-gate/SKILL.md` | `command.ai-sdlc.ru.run-phase-5-release-gate` |

Use `command.ai-sdlc.ru.run-all` to sequence all phases without human gates (git/PR operations still require explicit user confirmation). After the release gate, actualize global `docs/` with `command.ai-sdlc.ru.actualize-main-docs` (`.cursor/rules/rule.ai-sdlc.ru.docs-actualization-after-dev-request.mdc`), and publish dev-request docs with `command.ai-sdlc.ru.publish-dev-requests-docs`. Do not link permanent `docs/` to `docs/dev-requests/**` (`.cursor/rules/rule.governance.ru.docs-no-dev-requests-links.mdc`).

## Project Readiness Reminder

When an application is working locally or the user says the project is ready, remind the developer about the corporate readiness path before calling the work finished:

1. **Sandbox / test deploy:** prepare the repository for Dokploy with `.agents/skills/skill.devops.en.dokploy-repo-prep/SKILL.md`.
2. **Corporate login:** ask whether the app needs SSO through Keycloak. If yes, use `.agents/skills/skill.security.en.keycloak-sso-scaffold/SKILL.md`. For FastAPI + React stacks, also consider `.agents/skills/skill.security.en.fastapi-react-keycloak-auth/SKILL.md` for application-side auth integration.
3. **Roles:** if the app has roles such as admin/user/moderator, remind the developer that the service must be registered as a Jira Asset before IDM role onboarding.
4. **Production / Kubernetes:** before real production, remind the developer to complete security review, namespace/resourceQuota preparation, and then use `.agents/skills/skill.devops.en.helm-chart-scaffold/SKILL.md` and `.agents/skills/skill.devops.en.k8s-deploy-scaffold/SKILL.md`.

Do not force SSO or production deployment when the user only needs a local prototype or sandbox demo. Make the reminder explicit and short, and never put secrets such as `CLIENT_SECRET`, passwords, or tokens into code, manifests, docs, or git.
