---
name: security-review
description: >-
  Reviews code and infrastructure artifacts for security issues across the
  full delivery stack: Dockerfiles, docker-compose, Helm charts, Kubernetes
  manifests, GitLab CI pipelines, and application source code. Provides
  FAIL/PASS tables, checklists, and remediation guidance aligned with
  corporate rules. Use when creating or
  editing Dockerfiles, docker-compose.yaml, Helm values/templates, K8s
  manifests, .gitlab-ci.yml, handling secrets, env vars, auth, API
  endpoints, or when the user asks for a security review, security audit,
  or hardening check.
---

# Security Review

This skill provides a structured security review for the infrastructure and
application stack used in this organization: Docker, Docker Compose (Dokploy),
Helm (Bitnami-style / bcd-web), Kubernetes, GitLab CI/CD, and Vault.

**Подход:** скилл — это **справочник рекомендаций**, а не жёсткий gate. Используй
таблицы ниже как ориентир: где написано MUST — это принципиальные моменты
(секреты, привилегированный режим, non-root); SHOULD — хорошая практика, которую
можно отложить или пропустить с обоснованием. Не блокируй работу из-за
косметических замечаний; фокусируйся на реальных рисках.

## Scope and Priority

This skill **complements** existing rules; it does not replace them.

| Rule | Covers | Priority |
|------|--------|----------|
| `rule.security.en.corporate-dlp.mdc` | DLP, secrets detection, data classification, PII | **Highest** — wins on any conflict |
| `rule.security.ru.secure-app-architecture-and-dependencies.mdc` | Auth (SSO), input validation, parameterized queries, dependencies | High |
| `rule.governance.ru.architect-escalation-and-prohibited-patterns.mdc` | Prohibited production patterns, escalation triggers | High |
| `rule.devops.ru.deploy-containerization-and-runtime-config.mdc` | Docker non-root, health checks, env-based config | High |
| **This skill** | Structured review across all layers with FAIL/PASS tables | Applies on top of the above |

When reviewing, check each section below against the artifact under review.
Skip sections that do not apply (e.g. skip Helm for a pure Dokploy project).

---

## Dockerfile Security

| # | Rule | Severity |
|---|------|----------|
| D1 | Base image version is pinned (`python:3.12-slim`, not `python:latest`) | MUST |
| D2 | Final stage runs as non-root user (`USER 1001` or named user) | MUST |
| D3 | Multi-stage build separates build deps from runtime image | SHOULD |
| D4 | No secrets in `ARG`, `ENV`, or `COPY` instructions | MUST |
| D5 | `.dockerignore` excludes `.env`, `.env.*`, `.git/`, `node_modules/`, `__pycache__/`, `*.key`, `*.pem` | MUST |
| D6 | Minimal base image (Alpine, distroless, or `-slim` variant) where feasible | SHOULD |
| D7 | `COPY` uses explicit paths, not `COPY . .` without `.dockerignore` | SHOULD |
| D8 | No `apt-get upgrade` / `apk upgrade` in CI builds (non-reproducible) | SHOULD |
| D9 | Package manager cache cleaned in same `RUN` layer (`rm -rf /var/lib/apt/lists/*`) | SHOULD |
| D10 | `HEALTHCHECK` instruction present or documented that orchestrator provides probes | SHOULD |
| D11 | Healthcheck uses `127.0.0.1`, not `localhost` (Alpine BusyBox `wget` DNS issue — see Practical Gotchas) | SHOULD |

### Quick check

```
- [ ] D1 pinned base image
- [ ] D2 non-root USER
- [ ] D3 multi-stage build
- [ ] D4 no secrets in image layers
- [ ] D5 .dockerignore present and correct
```

---

## Docker Compose Security

| # | Rule | Severity |
|---|------|----------|
| C1 | No hardcoded secrets in `environment:` — use `${VAR}` references | MUST |
| C2 | `.env` file listed in `.gitignore`; `.env.example` committed with placeholders | MUST |
| C3 | Services that do not need external access have no `ports:` mapping to host | SHOULD |
| C4 | Internal services communicate over a dedicated named network | SHOULD |
| C5 | No `privileged: true` or `cap_add: [ALL]` | MUST |
| C6 | `restart: unless-stopped` or `always` for production services | SHOULD |
| C7 | Resource limits set via `deploy.resources.limits` when targeting Dokploy/Swarm | SHOULD |
| C8 | No `container_name:` (breaks scaling and Dokploy auto-naming) | SHOULD |
| C9 | Volumes use named volumes, not host-bind mounts with absolute paths | SHOULD |

### Quick check

```
- [ ] C1 no hardcoded secrets
- [ ] C2 .env in .gitignore, .env.example committed
- [ ] C3 minimal port exposure
- [ ] C5 no privileged mode
```

---

## Helm Chart Security

| # | Rule | Severity |
|---|------|----------|
| H1 | `containerSecurityContext.runAsNonRoot: true` | MUST |
| H2 | `containerSecurityContext.allowPrivilegeEscalation: false` | MUST |
| H3 | `containerSecurityContext.capabilities.drop: ["ALL"]` | MUST |
| H4 | `containerSecurityContext.readOnlyRootFilesystem: true` (add `emptyDir` for `/tmp` if needed) | SHOULD |
| H5 | `podSecurityContext.fsGroup` set (typically `1001`) | SHOULD |
| H6 | `resources.requests` and `resources.limits` defined for CPU and memory | MUST |
| H7 | `networkPolicy.enabled: true` — restrict ingress/egress | SHOULD |
| H8 | Secrets via `existingSecret` or External Secrets Operator, not plain `values.yaml` | MUST |
| H9 | `serviceAccount.automountServiceAccountToken: false` unless the app needs K8s API | SHOULD |
| H10 | RBAC rules follow least privilege; no `ClusterRole` with `*` verbs/resources | MUST |
| H11 | Ingress TLS enabled; no plain HTTP in production | MUST |
| H12 | Image tag is not `latest`; prefer digest or immutable tag | MUST |
| H13 | `pdb.create: true` for production workloads (minimum availability) | SHOULD |

### Quick check

```
- [ ] H1–H3 container security context hardened
- [ ] H6 resource limits set
- [ ] H8 no plain-text secrets in values
- [ ] H10 RBAC least privilege
- [ ] H11 TLS on ingress
```

---

## Kubernetes Manifests

When reviewing raw YAML manifests (not generated by Helm), verify:

| # | Rule | Severity |
|---|------|----------|
| K1 | No `hostNetwork: true`, `hostPID: true`, `hostIPC: true` | MUST |
| K2 | No `privileged: true` in `securityContext` | MUST |
| K3 | No `automountServiceAccountToken: true` unless justified | SHOULD |
| K4 | Ingress uses TLS termination | MUST |
| K5 | No `nginx.ingress.kubernetes.io/enable-cors: "true"` with `cors-allow-origin: "*"` | MUST |
| K6 | No `LoadBalancer` service type without explicit justification | SHOULD |
| K7 | Labels include `app.kubernetes.io/name`, `app.kubernetes.io/instance` | SHOULD |
| K8 | Namespace is explicit, not `default` | SHOULD |

---

## Secrets Management

| Pattern | Verdict | Explanation |
|---------|---------|-------------|
| Hardcoded password value in `values.yaml` or `docker-compose.yaml` | **FAIL** | Hardcoded secret ends up in git |
| `password: ${DB_PASSWORD}` in compose + `.env` in `.gitignore` | **PASS** (dev) | Acceptable for local development |
| `existingSecret: my-app-secret` in Helm values | **PASS** | Secret managed externally |
| External Secrets / Vault CSI / Vault Agent | **PASS** (prod) | Recommended for production |
| Secret in `.gitlab-ci.yml` as plain text | **FAIL** | Use CI/CD protected/masked variables |
| Secret passed via `--build-arg` in Docker | **FAIL** | Leaks into image layer metadata |
| `docker secret` or Vault in Dokploy env panel | **PASS** | Platform-managed |

### Gitleaks

The repository uses `gitleaks.toml` with default rules extended. If adding new
paths with potential false positives, extend the `[allowlist].paths` array.
Do **not** disable default rules.

---

## GitLab CI/CD Security

| # | Rule | Severity |
|---|------|----------|
| G1 | Secrets stored as CI/CD variables with `protected` + `masked` flags | MUST |
| G2 | No secrets in `.gitlab-ci.yml` text | MUST |
| G3 | `secret-detection` component included (currently `@2.0.0`) | MUST |
| G4 | `kics` component included for IaC scanning (currently `@1.0.0`) | MUST |
| G5 | Docker builds use `--no-cache` in CI or pin builder image | SHOULD |
| G6 | Pipeline does not use `allow_failure: true` for security jobs | MUST |
| G7 | Artifacts with sensitive data have `expire_in` set | SHOULD |

Current CI includes these components:

```yaml
include:
  - component: gitlab.biocad.ru/iac/ci-components/security/secret-detection/secret-detection@2.0.0
  - component: gitlab.biocad.ru/iac/ci-components/security/kics/kics@1.0.0
```

Do not remove or downgrade these components.

---

## Application Code Security

This section is a brief summary; detailed rules live in
`rule.security.ru.secure-app-architecture-and-dependencies.mdc` and
`rule.governance.ru.architect-escalation-and-prohibited-patterns.mdc`.

| # | Rule | Reference |
|---|------|-----------|
| A1 | Authentication via corporate SSO (OAuth2/OIDC); no custom login/password schemes | `rule.security.ru.secure-app-architecture-and-dependencies.mdc` |
| A2 | All external input validated and sanitized at API boundary | `rule.security.ru.secure-app-architecture-and-dependencies.mdc` |
| A3 | Database queries use parameterized statements; no SQL concatenation | `rule.security.ru.secure-app-architecture-and-dependencies.mdc` |
| A4 | No `eval()`, `exec()`, `Function()` with dynamic data | `rule.security.ru.secure-app-architecture-and-dependencies.mdc` |
| A5 | HTML output escaped; input sizes bounded | `rule.security.ru.secure-app-architecture-and-dependencies.mdc` |
| A6 | API layer separated from business logic and data access | `rule.security.ru.secure-app-architecture-and-dependencies.mdc` |
| A7 | Dependencies from corporate allow-list; checked for CVEs before adding | `rule.security.ru.secure-app-architecture-and-dependencies.mdc` |
| A8 | No direct internet-facing service without reverse proxy / ingress | `rule.governance.ru.architect-escalation-and-prohibited-patterns.mdc` |
| A9 | No in-process session storage; use dedicated store | `rule.governance.ru.architect-escalation-and-prohibited-patterns.mdc` |
| A10 | No CORS `*` in production API | `rule.governance.ru.architect-escalation-and-prohibited-patterns.mdc` |
| A11 | No cron inside web server; use worker / job queue | `rule.governance.ru.architect-escalation-and-prohibited-patterns.mdc` |
| A12 | No persistent files on container local FS; use object storage | `rule.governance.ru.architect-escalation-and-prohibited-patterns.mdc` |
| A13 | Health endpoint `/health` returns HTTP 200 | `rule.devops.ru.deploy-containerization-and-runtime-config.mdc` |
| A14 | Config only via environment variables; no env-specific config files in code | `rule.devops.ru.deploy-containerization-and-runtime-config.mdc` |

---

## Practical Gotchas

Типичные проблемы, которые легко пропустить при ревью:

### Alpine / BusyBox: healthcheck и `localhost`

На Alpine-образах `wget` из BusyBox резолвит `localhost` через DNS, а не через
`/etc/hosts`. В non-root контексте (а мы всегда запускаем non-root) это часто
приводит к `Connection refused`, хотя сервис слушает на `0.0.0.0:<port>` и
отвечает по IP.

**Решение:** во всех `HEALTHCHECK` и `healthcheck.test` использовать `127.0.0.1`
вместо `localhost`:

```dockerfile
# Dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
```

```yaml
# docker-compose.yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/health"]
```

Это касается **любого** образа на базе Alpine (Node, Python, .NET, Go, nginx).
Если образ не Alpine — `localhost` обычно работает, но `127.0.0.1` безопаснее
в любом случае.

### Listen address: `0.0.0.0` vs `127.0.0.1`

Приложение внутри контейнера должно слушать на `0.0.0.0` (все интерфейсы), а не
на `127.0.0.1`. Иначе оно недоступно для Docker networking, проб Kubernetes и
Traefik. Healthcheck при этом обращается к `127.0.0.1` — это не противоречие:
healthcheck запускается **внутри** того же контейнера.

---

## Review Workflow

1. **Identify artifacts** in the change: Dockerfile, compose, Helm, K8s YAML, CI config, source code.
2. **Apply matching sections** from this skill to each artifact. Пропускай секции, которые не относятся к изменению.
3. **Report** — формат свободный, подстраивай под контекст. Ориентир:

```
SECURITY REVIEW

OK:
  - [rule ID] description

РЕКОМЕНДАЦИИ (SHOULD):
  - [rule ID] что нашлось + где + что предлагается

КРИТИЧНО (MUST):
  - [rule ID] что нашлось + где + что исправить
```

4. Для критичных находок предлагай фикс или сниппет.
5. При обнаружении секретов — `rule.security.en.corporate-dlp.mdc` stop procedure.
6. **Не раздувай:** если изменение тривиальное (правка README, переименование переменной), полный ревью не нужен.

---

## Pre-Review Checklist

Before signing off on any merge request touching infrastructure or deployment:

```
- [ ] No hardcoded secrets in any file (D4, C1, H8, G2)
- [ ] Docker image runs as non-root (D2, H1)
- [ ] Base images pinned, not :latest (D1, H12)
- [ ] Healthcheck uses 127.0.0.1, not localhost (D11)
- [ ] Security context hardened in Helm/K8s (H1–H4, K1–K2)
- [ ] Resource limits defined (H6)
- [ ] NetworkPolicy enabled or justified (H7)
- [ ] TLS on all ingress (H11, K4)
- [ ] CI includes secret-detection and KICS (G3, G4)
- [ ] No privileged containers or host namespaces (C5, K1, K2)
- [ ] Secrets managed via Vault / External Secrets / CI vars (H8, G1)
- [ ] .env files in .gitignore (C2, D5)
```

Detailed FAIL/PASS examples for every section: [reference.md](reference.md)
