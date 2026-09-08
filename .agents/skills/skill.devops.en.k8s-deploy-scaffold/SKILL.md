---
name: k8s-deploy-scaffold
description: >-
  Scaffold Kubernetes deployment for GitLab projects: generates Helm charts
  (bcd-web), .gitlab-ci.yml, docker-compose.yaml, Dockerfiles directly in the
  repo, plus a DEPLOYMENT.md file with Vault, ExternalSecret or SealedSecret guidance, Argo CD
  manifests, PowerDNS records, and a review checklist. Use when creating helm/,
  .gitlab-ci.yml, docker-compose, Dockerfile, or when the user says "deploy",
  "release", "pipeline", "scaffold", "infra" — even without mentioning Helm
  explicitly.
---

# Kubernetes Deployment Scaffold

Analyze a project repository and generate deployment files: Helm charts, GitLab CI pipeline, docker-compose, Dockerfiles, and secret delivery templates. All recommendations and advisory content (Argo CD infrastructure, PowerDNS records, Vault, ExternalSecret or SealedSecret templates, review checklist) are written to a single `DEPLOYMENT.md` file in the repository root — the engineer reads it, configures everything, and decides whether to keep it as documentation or delete it.

## Workflow

1. **Analyze** the repository: source code, existing Dockerfiles, docker-compose, environment variables, dependencies, exposed ports, health endpoints
2. **Generate** deployment files in the project repository: `helm/`, `.gitlab-ci.yml`, `docker-compose.yaml`, Dockerfiles (if missing)
3. **Write `DEPLOYMENT.md`** in the repo root — a single file containing:
   - Vault secret templates plus ExternalSecret or SealedSecret manifests per service
  - Argo CD file recommendations for the argocd-infra repository (namespace, infrastructure dependencies, ingress, ExternalSecret or SealedSecret)
   - PowerDNS records if Ingress is needed
   - Review summary table with all `# REVIEW:` fields

Generated code files (`helm/`, `.gitlab-ci.yml`, `docker-compose.yaml`, Dockerfiles) are created directly in the repository. Everything else goes into `DEPLOYMENT.md`.

### Uncertain Values — `# REVIEW:` Marker

Many values cannot be determined from the repository alone. Mark every such value with an inline comment `# REVIEW: <reason>` so the user can find and adjust them.

**What to mark:** runner tags, CI component version, Argo CD project (`dis`/`dcm`/`dir`/`dib`/`dot`, or `datp` for DATP), namespace name and `ENVIRONMENT` value (they must be identical), Ingress host (`*.biocad.dev`, `*.{env}.botanique.app`, or `*.botanique.app`) and DNS target, wildcard TLS Secret name, resource limits/requests, ResourceQuota values, whitelist CIDRs, DB user/name, Vault path (cluster prefix in ExternalSecrets), health endpoint path. Не указывай `storageClass`, пока пользователь или inventory явно не требуют нестандартный класс.

**How to mark** — append `# REVIEW:` to the line:

```yaml
  tags:
    - rancher-kube-prod              # REVIEW: verify runner tag for target cluster
spec:
  project: dis                       # REVIEW: set correct Argo CD project (dis/dcm/dir/dib/dot)
  destination:
    namespace: dis-voiceai-dev       # REVIEW: adjust namespace to match your project and environment
```

When a value **can** be determined from the repository (e.g. port from `EXPOSE`, env var name from code), do not mark it — only mark what requires human decision.

### Review Summary

After generating all files, write a **"Review Required"** section at the end of `DEPLOYMENT.md` — a table listing every `# REVIEW:` field, grouped by file, with the current best-guess value and what the engineer needs to check. This lets the engineer address all uncertain values in one pass without searching through configs.

---

## Step 1 — Repository Analysis

Scan the repository for:

- **Services**: directories with Dockerfiles, `main.go`, `app.py`, `package.json`, `pom.xml`, etc.
- **Existing Dockerfiles**: evaluate quality, suggest improvements or create missing ones
- **docker-compose.yaml**: existing or absent — generate either way. Use [references/compose-mapping.md](references/compose-mapping.md) to translate each compose construct to bcd-web values, Vault, and Argo CD
- **Environment variables**: from `.env.example`, docker-compose, code (`os.getenv`, `process.env`, `os.Getenv`, `System.getenv`)
- **Exposed ports**: from Dockerfiles (`EXPOSE`), code (listen calls), docker-compose
- **Health endpoints**: `/health`, `/healthz`, `/ready`, `/api/health`
- **Infrastructure dependencies**: databases, caches, brokers (see trigger keywords below)
- **Persistent storage needs**: file uploads, data directories

Classify every discovered variable as:
- **Config** (non-sensitive) → goes to `configmaps_create` in values.yaml and `environment` in docker-compose
- **Secret** (API keys, passwords, tokens, connection strings with credentials) → goes to Vault plus ExternalSecret или SealedSecret template and docker-compose `.env` reference

### Infrastructure Profile Selection

Before writing `DEPLOYMENT.md`, determine the target infrastructure profile:

- **Default profile** — standard `argocd-infra-*` repositories, organizational projects (`dis`, `dcm`, `dir`, `dib`, `dot`), Vault-backed ExternalSecrets, and PowerDNS CNAME records to cluster GSLB.
- **DATP profile** — use when the user mentions DATP, `argocd-datp-dev`, `argocd-datp-prod`, `datp-kube-dev01`, `rancher-datp-kube-dev`, `botanique.app`, or namespaces such as `datp-ais-botanique-dev`. DATP uses Argo CD project `datp`, repo `argocd-datp-dev` for dev/qa/uat and future repo `argocd-datp-prod` for prod, namespace manifests under `datp/{namespace}`, ExternalSecret from `vault-css` или резервный SealedSecret, and PowerDNS A records to a fixed ingress IP.

For DATP generation, follow [references/argocd-datp.md](references/argocd-datp.md) instead of the Vault/ExternalSecret and CNAME parts of [references/argocd-infra.md](references/argocd-infra.md).

---

## Step 2 — Generate Project Files

### 2.1 Dockerfiles

If the repository lacks Dockerfiles, or has suboptimal ones, generate production-ready Dockerfiles per service.

**Mandatory header on every Dockerfile:**

```dockerfile
# syntax=docker.io/docker/dockerfile:1
# check=error=true;skip=SecretsUsedInArgOrEnv

ARG SOURCE_DATE_EPOCH=context
```

**Requirements:**
- **BuildKit frontend `dockerfile:1`** — tracks the stable Dockerfile frontend and enables `COPY --link`, `--mount=type=secret`, `--mount=type=cache`, `--mount=type=tmpfs`, `RUN --network=none`, Dockerfile lint checks
- **`# check=error=true`** — fails the build on bad practices (typos in flags, unused ARG, accidental secrets in ENV)
- **`ARG SOURCE_DATE_EPOCH=context`** — reproducible builds; file mtimes tied to git commit
- **Multi-stage** (build + runtime), parameterized via `ARG *_IMAGE` for renovate
- **Cache mounts** for every package manager:
  - Go → `target=/go/pkg/mod` + `target=/root/.cache/go-build`
  - Python (uv) → `target=/root/.cache/uv` (preferred)
  - Python (pip) → `target=/root/.cache/pip`
  - Node (pnpm) → `target=/root/.local/share/pnpm/store` (preferred)
  - Node (npm) → `target=/root/.npm`
  - .NET → `target=/root/.nuget/packages`
  - Gradle → `target=/root/.gradle`
- **Secret mounts** for private registry tokens (NEVER as `ARG`/`ENV`):
  - `--mount=type=secret,id=LIBS_TOKEN,env=LIBS_TOKEN,required=false`
  - When secret derives a file (e.g. `.npmrc`, `pip.conf`), pair with `--mount=type=tmpfs,target=/tmp` so the file never enters a layer
- **`COPY --link`** for all cross-stage copies — independent layer chain, better cache reuse, faster rebases. **Must use numeric `--chown=UID:GID`** (the linked layer has no `/etc/passwd`, names don't resolve)
- **Distroless / chiseled / alpine** runtime — smaller image and attack surface
- **Non-root user** via numeric `USER UID:GID`. Choose UID by base image (see Non-root UID table in [references/dockerfiles.md](references/dockerfiles.md)). When UID ≠ 1000 (e.g. chiseled .NET = 1654, nginx-unprivileged = 101), override in Helm `securityContext`
- **Exec form** for `CMD`/`ENTRYPOINT` — correct PID 1 / signals
- **`EXPOSE`** with the actual port
- **`HEALTHCHECK`** when runtime has shell+wget/curl. Omit on distroless/chiseled — K8s probes cover health
- **`.dockerignore`** in the same directory — keeps `.env`, build artefacts, helm/ out of context

**CI passthrough.** The Dockerfile expects secrets and cache namespace from matrix-build:

```yaml
variables:
  BUILD_ARGS: --build-arg BUILDKIT_CACHE_MOUNT_NS=$CI_PROJECT_PATH_SLUG
  SECRET_VARS: --secret id=LIBS_TOKEN,env={LIBS_READ_TOKEN_ENV}
```

`BUILDKIT_CACHE_MOUNT_NS` namespaces cache buckets per project so concurrent jobs don't corrupt each other's caches.

For per-language templates (Go, Python, Node.js, Java, .NET, Rust) with all of the above wired in, see [references/dockerfiles.md](references/dockerfiles.md).

### 2.2 docker-compose.yaml

Generate a production-representative docker-compose for local development that mirrors the Kubernetes deployment.

**Requirements:**
- All project services with correct build contexts and Dockerfiles
- All infrastructure dependencies (postgres, redis, etc.) with pinned image versions
- Environment variables split: non-secret inline, secrets via `env_file: .env`
- Port mappings matching Helm values
- Health checks matching probe configuration
- Volume mounts for persistent data
- `depends_on` with `condition: service_healthy` for dependency ordering
- Network isolation between unrelated services

Also generate `.env.example` with all secret variables (empty values) alongside docker-compose.

For docker-compose templates (application services, PostgreSQL, Redis, RabbitMQ, MongoDB, MinIO, Kafka), see [references/docker-compose.md](references/docker-compose.md).

### 2.3 Helm Charts

For each application service, generate `helm/{service}/Chart.yaml` and `helm/{service}/values.yaml`.

No `templates/` directory — all templates come from the `bcd-web` dependency chart.

Application workloads are deployed by GitLab CI from this repository. Do not create
an Argo CD `Application` whose `source` points at `helm/{service}` in the application
repository. Argo CD manages only the namespace plus explicitly required infrastructure
or privileged/stateful components; use the `cloudpirates` PostgreSQL/Redis patterns in
[references/argocd-infra.md](references/argocd-infra.md) with ExternalSecret.

Before writing `bcd-web.networkPolicy`, read [references/network-policy-contract.md](references/network-policy-contract.md). Generate default-deny ingress and egress. Derive every `namespaceSelector` and `podSelector` from a target-cluster inventory; do not use a broad RFC1918 `ipBlock` for an in-cluster dependency. Keep external destinations as explicit, reviewed exceptions only.

### Формат values и overlays

- В `values.yaml` и `values_patch.yaml` запрещён flow-стиль YAML: не используй
  `{...}` и `[...]` для ресурсов, NetworkPolicy и других вложенных структур.
  Каждый ключ и элемент списка пиши с новой строки.
- Базовый `values.yaml` должен оставаться полным. Overlay содержит только patch
  значений конкретного namespace, но всегда включает фундаментальные секции:
  `resources`, `configmaps_create`, закомментированный `secrets_create` и
  NetworkPolicy.
- В overlay добавляй только закомментированный `secrets_create` с реальными именами
  ключей и placeholder `<ЗНАЧЕНИЕ_ИЗ_VAULT>`; значения поставляет Vault.
- Комментарии в генерируемых Helm values и CI пиши на русском.

**Chart.yaml:**

```yaml
apiVersion: v2
name: {project}-{service}
description: A Helm chart for {Service Description}
type: application
version: 0.0.1
appVersion: "no"

dependencies:
  - name: bcd-web
    version: 0.2.3
    repository: "https://charts.k8s.biocad.ru/"
```

**values.yaml** — fill from analysis results. For full bcd-web values reference, see [references/bcd-web-values.md](references/bcd-web-values.md).

```yaml
bcd-web:
  annotations:
    reloader.stakater.com/auto: "true"

  containers:
    {service}:
      image:
        repository: $CI_REGISTRY_IMAGE
        tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
        suffix: {service}
        pullPolicy: IfNotPresent
      ports:
        - containerPort: {port}
          name: {port-name}
          protocol: TCP
      securityContext:
        runAsUser: 1000     # REVIEW: must match USER in the Dockerfile. Common: 1000 (custom), 1654 (chiseled .NET), 101 (nginx-unprivileged), 65532 (distroless)
        runAsGroup: 1000    # REVIEW: same UID/GID convention as above
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: false
      envFromSecrets:
        - {project}-{service}-sec
      envFromConfigMaps:
        - {project}-{service}-config
      livenessProbe:
        enabled: true
        probe:
          httpGet:
            path: /health
            port: {port-name}
          initialDelaySeconds: 10
          periodSeconds: 15
          failureThreshold: 3
          timeoutSeconds: 5
      readinessProbe:
        enabled: true
        probe:
          httpGet:
            path: /health
            port: {port-name}
          initialDelaySeconds: 10
          periodSeconds: 10
          failureThreshold: 3
          timeoutSeconds: 1
      resources:
        requests:
          cpu: 200m
          memory: 256Mi
        limits:
          cpu: 500m
          memory: 512Mi
      volumeMounts: []

  podSecurityContext:
    fsGroup: 1000

  configmaps_create:
    {project}-{service}-config:
      # all non-secret env vars discovered during analysis
      KEY: "value"

  volumes: []

  persistence: {}

  affinity: {}

  service:
    {service}:
      ports:
        - port: {external-port}
          targetPort: {port-name}
          protocol: TCP
          name: {port-name}

  networkPolicy:
    enabled: true
    policyTypes:
      - Ingress
      - Egress
    ingress:
      - from:
          - namespaceSelector:
              matchLabels:
                kubernetes.io/metadata.name: {target-namespace} # REVIEW: cluster inventory
            podSelector:
              matchLabels:
                app.kubernetes.io/instance: {caller-release} # REVIEW: cluster inventory
                app.kubernetes.io/name: bcd-web
        ports:
          - protocol: TCP
            port: {port}
    egress: [] # Populate only with inventory-confirmed dependencies.

  imagePullSecrets:
    - name: {project}-regcred

  fullnameOverride: "{project}-{service}"
```

### 2.4 GitLab CI Pipeline (.gitlab-ci.yml)

Pipeline contract:

- **`main/ci@2.1.2`** — modern matrix-build component (BuildKit + Skopeo + Cosign downstream); отдельные include для ручных операций не требуются.
- **`bumpversion/semver@0.1.2`** — SemVer auto-tag on protected branch, replaces the old date-based bumpversion
- **`workflow.auto_cancel.on_new_commit: interruptible`** — supersede stale pipelines on rapid pushes
- **`workflow.rules`** sets `ENVIRONMENT` to the exact Kubernetes namespace and `DEPLOY_RUNNER_TAG` per branch — deploy jobs consume them; one source of truth for branch → namespace mapping
- **Stages `[bumpversion, build:image, test, deploy:chart]`** — matches ci component expectations (`security-ci-stage`, `megalinter-stage`)
- **`BUILDKIT_CACHE_MOUNT_NS=$CI_PROJECT_PATH_SLUG`** — namespaces cache mounts per project
- **`SECRET_VARS`** — passes private registry tokens to BuildKit via `--secret`, never as `--build-arg`
- **Vault `helm_values`** — environment-scoped secret containing Helm value overrides; mounted as file and concatenated into `helm_values.tmp.yaml`

**Profile differences.** The pattern below is the **default profile** (standard clusters, Vault-backed `helm_values`). For the **DATP profile**: use environment names `dev`, `qa`, `uat`, `prod`; set dev/qa/uat deploy jobs to runner tag `rancher-datp-kube-dev`; mark the prod runner tag with `# REVIEW:` until the `argocd-datp-prod` cluster runner is defined. DATP credentials are delivered through ExternalSecret committed to Argo CD; если ESO недоступен в целевом кластере, используй резервный SealedSecret. Не помещай значения секретов в CI variables или Helm values.

```yaml
include:
  - component: $CI_SERVER_HOST/iac/ci-components/main/ci@2.1.2
    inputs:
      security-ci-stage: test
      megalinter-stage: ".post"
      megalinter-report-stage: ".post"
      renovate-base-branches: dev
      renovate-rules:
        - if: $CI_COMMIT_MESSAGE =~ /Merge branch.*renovate\//
          when: on_success
        - if: '$CI_COMMIT_BRANCH == "dev"'
          when: manual
          allow_failure: true
        - when: never
  - component: $CI_SERVER_HOST/iac/ci-components/ci/bumpversion/semver@0.1.2
    inputs:
      tag_prefix: "v"

workflow:
  auto_cancel:
    on_new_commit: interruptible
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_TAG
    - if: $CI_COMMIT_BRANCH == "dev"
      variables:
        ENVIRONMENT: "{argo-project}-{project}-dev"     # REVIEW: argo project (dis/dcm/dir/dib/dot) + project name
        DEPLOY_RUNNER_TAG: rancher-kube-dev-01          # REVIEW: runner tag for dev cluster
    # - if: $CI_COMMIT_BRANCH == "stage"
    #   variables:
    #     ENVIRONMENT: "{argo-project}-{project}-stage" # REVIEW: enable stage only when needed
    #     DEPLOY_RUNNER_TAG: rancher-kube-dev-01
    - if: $CI_COMMIT_TAG
      variables:
        ENVIRONMENT: "{argo-project}-{project}-prod"    # REVIEW: prod is strictly tag-only
        DEPLOY_RUNNER_TAG: rancher-kube-prod-01
    - if: $CI_COMMIT_BRANCH

stages: [bumpversion, build:image, test, deploy:chart]

.project-rules:
  rules:
    - if: '$CI_COMMIT_BRANCH != $CI_DEFAULT_BRANCH && $CI_PIPELINE_SOURCE != "merge_request_event"'

build:{project}:
  stage: build:image
  extends: .image.Matrix-Build
  variables:
    BUILD_PATH: "."
    BUILD_ARGS: >-
      --build-arg LIBS_USER=${LIBS_READ_USER_ENV}
      --build-arg BUILDKIT_CACHE_MOUNT_NS=$CI_PROJECT_PATH_SLUG
    SECRET_VARS: >-
      --secret id=LIBS_TOKEN,env={LIBS_READ_TOKEN_ENV}
  parallel:
    matrix:
      # one entry per service discovered during analysis.
      # NOTE: do not put BUILD_PATH here — matrix-injected variables don't reliably forward
      # to the downstream build pipeline. Use BUILD_PATH: "." in `variables:` above and make
      # Dockerfile paths repo-relative (`COPY {service-dir}/file …`) instead.
      - BUILD_FILE: "{service-dir}/Dockerfile"
        IMAGE_SUFFIX: "{service}"
  rules:
    - !reference [.project-rules, rules]

.deploy_template:
  stage: deploy:chart
  extends: .k8s.Helm.Install
  before_script:
    - helm dependency build "$HELM_CHART"
    - cat $helm_values > helm_values.tmp.yaml
  secrets:
    helm_values:
      vault: "{argo-project}/{project}/${CI_PROJECT_ID}/${CI_COMMIT_REF_PROTECTED}/${CI_ENVIRONMENT_NAME}/helm_values@gitlab-kv"   # REVIEW: confirm Vault path with platform team
      file: true
  environment:
    name: "${ENVIRONMENT}"
  tags:
    - ${DEPLOY_RUNNER_TAG}

# one deploy job per service × environment
deploy:{service}:dev:
  extends: .deploy_template
  variables:
    HELM_RELEASE: "{project}-{service}"
    HELM_CHART: "helm/{service}"
    HELM_VALUES: "helm/{service}/values.yaml"
    HELM_VALUES_SECRET: "helm_values.tmp.yaml"
  rules:
    - if: $CI_COMMIT_BRANCH == "dev"

deploy:{service}:prod:
  extends: .deploy_template
  variables:
    HELM_RELEASE: "{project}-{service}"
    HELM_CHART: "helm/{service}"
    HELM_VALUES: "helm/{service}/values.yaml"
    HELM_VALUES_SECRET: "helm_values.tmp.yaml"
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
```

**Notes for the engineer:**

- `BUILD_FILE` is repo-rooted, not relative to `BUILD_PATH` — write the full path
- **`BUILD_PATH` should live in `variables:`, not `parallel.matrix:`.** Variables set in `parallel.matrix` are job-level and are NOT reliably forwarded to the downstream build pipeline by `trigger.forward.pipeline_variables: true` — some land, some don't. Side effect: `BUILD_PATH` silently falls back to `.` (repo root), and your Dockerfile's `COPY Service.csproj ./` fails with `"/Service.csproj": not found`. Safest convention for multi-service repos: set `BUILD_PATH: "."` in `variables:`, keep only `BUILD_FILE` + `IMAGE_SUFFIX` in matrix, and make Dockerfile paths repo-relative (`COPY backend/Service.csproj …`)
- Ship a **repo-root `.dockerignore`** that excludes `helm/`, docs, `*.md`, build artefacts (`bin/`, `obj/`, `node_modules/`, `dist/`), local-only files (`.env`, `helm_values*.yaml`) — otherwise each service build transfers the whole monorepo
- `BUILDKIT_CACHE_MOUNT_NS` is critical for shared runners: without it, two projects with `id=pnpm` (or `id=npm`) cache mounts will fight over the same bucket
- `SECRET_VARS` is consumed by the matrix-build component's `docker buildx build ... ${SECRET_VARS}` — the corresponding `RUN --mount=type=secret,id=LIBS_TOKEN,env=LIBS_TOKEN` in the Dockerfile picks it up
- Prod deploys must be **strictly tag-only**: `workflow.rules` sets prod variables only on `$CI_COMMIT_TAG`, and `deploy:{service}:prod` uses `rules: if: $CI_COMMIT_TAG` with `when: manual`
- Stage is intentionally commented out by default; enable it only when the environment exists and the runner tag is confirmed
- `bumpversion/semver` creates a `vX.Y.Z` tag on each push to the default branch — its successful run is what triggers the tag-protected pipeline if you uncomment the `$CI_COMMIT_TAG` workflow rule

### 2.5 Vault Secret Templates

After generating Helm charts for the default profile, write a **"Vault Secrets"** section into `DEPLOYMENT.md` with a template per service:

````markdown
## Vault Secrets

### {service}

**Path:** `{argo-project}/{project}/{CI_PROJECT_ID}/{CI_COMMIT_REF_PROTECTED}/{CI_ENVIRONMENT_NAME}/helm_values@gitlab-kv`

```yaml
bcd-web:
  containers:
    {service}:
      envFromSecrets:
        - {project}-{service}-sec

  secrets_create:
    {project}-{service}-sec:
      SECRET_VAR_1: ""
      SECRET_VAR_2: ""
```
````

List **every** secret variable discovered during analysis. Leave values empty — the user fills them.

For DATP choose exactly one mechanism: `ExternalSecret` through `vault-css` is the
default; `SealedSecret` is the reserve mechanism when ESO is unavailable. Keep the
namespace folder convention from [references/argocd-datp.md](references/argocd-datp.md).
Do not invent secret values or commit them to Git.

---

## Namespace-scoped Value Overlays

Vary values per environment (resource limits, replica counts, env vars, feature flags) **without duplicating the deploy job** and without forking `values.yaml`. The `.k8s.Helm.Install` component loads **every** `HELM_VALUES` and `HELM_VALUES_*` variable as an additional `helm --values <file>` (rendered through envsubst), ordered by variable name, with the Vault secret file last. Precedence low→high: `values.yaml` → overlay(s) → Vault secret.

Wire a namespace-scoped overlay in the (single) deploy job — `ENVIRONMENT` comes from `workflow.rules` and equals the target namespace:

```yaml
  variables:
    HELM_VALUES: "helm/{service}/values.yaml"
    HELM_VALUES_OVERLAY: "helm/{service}/overlays/${ENVIRONMENT}/values_patch.yaml"
    HELM_VALUES_SECRET: "helm_values.tmp.yaml"
```

Create `helm/{service}/overlays/<namespace>/values_patch.yaml` for **every** target namespace selected by `ENVIRONMENT`, containing only the keys that change:

```yaml
bcd-web:
  containers:
    backend:            # containers — map, поэтому можно изменить один контейнер.
      resources:
        limits:
          cpu: "1"
          memory: 1Gi
```

Rules:
- **Patch only what changes.** Helm **deep-merges maps** but **replaces lists wholesale**. `bcd-web.containers` is a map → patch `containers.<name>.resources`; image/ports/probes and other containers are preserved. В overlay изменяй только значения конкретного namespace; для списка указывай весь список целиком.
- **Фундамент overlay.** В base и каждом overlay обязательно отражай `resources`, `configmaps_create`, закомментированный `secrets_create` и NetworkPolicy. В `secrets_create` хранятся только ключи и `<ЗНАЧЕНИЕ_ИЗ_VAULT>`.
- В `values_patch.yaml` оставляй закомментированный шаблон `secrets_create` с
  `<ЗНАЧЕНИЕ_ИЗ_VAULT>`. Реальные секреты приходят последним values-файлом Vault.
- ⚠️ **A missing overlay file fails the deploy** (`Helm values file not found`). Create one per targeted ENVIRONMENT; an empty (comment-only) file is a valid no-op.
- envsubst applies to overlay contents (`${VAR}`, `${VAR:-fallback}`).

Full mechanism, deep-merge vs list, a real per-namespace `resources` example, and a `helm template` verification command: [references/overlays.md](references/overlays.md).

---

## Step 3 — Argo CD Recommendations

Write an **"Argo CD"** section into `DEPLOYMENT.md` with ready-to-use YAML files that the engineer commits to the appropriate `argocd-infra-*` repository for their target cluster. Each cluster has its own repository with identical directory structure (`dis/`, `dcm/`, `dir/`, `dib/`, `dot/`). Do not create these files in the project repository.

For DATP, write the same section using `argocd-datp-dev` or `argocd-datp-prod` paths and [references/argocd-datp.md](references/argocd-datp.md). DATP files belong under `datp/{namespace}/`, not under `dis/`, `dcm`, `dir`, `dib`, `dot`, or `datp/namespaces`.

Mark all cluster-dependent values (`# REVIEW:`): Argo CD project, namespace, Ingress
host, Vault paths in ExternalSecrets and, when used, the SealedSecret input values.
Do not add `storageClass`: PVC uses the default StorageClass of the cluster. Add it
only when the user or target inventory explicitly requires a non-default class.

For detailed reference on Argo CD patterns, see [references/argocd-infra.md](references/argocd-infra.md).

### 3.1 Namespace (ns-hr.yaml)

Write a subsection `### Namespace (ns-hr.yaml)` into the Argo CD section of `DEPLOYMENT.md`. Include the full YAML for `{argo-project}/{project}-{env}/ns-hr.yaml` using the `k8s-ns` chart (`~1.2.2`), with `developers`, `resourceQuota`, `limitRange` values sized for the project. Use `CreateNamespace=true` in syncOptions. Mark `project`, namespace, quota values with `# REVIEW:`.

For the full template and quota sizing guide, see [references/argocd-infra.md](references/argocd-infra.md) (Namespace Application). For k8s-ns chart values, see [references/ns-chart-values.md](references/ns-chart-values.md).

### 3.2 Registry Credentials (regcred-es.yaml)

Write a subsection `### Registry Credentials (regcred-es.yaml)` with the full ExternalSecret YAML — syncs registry credentials from Vault via `ClusterSecretStore` `vault-css` into a `kubernetes.io/dockerconfigjson` Secret named `regcred`. Mark the Vault path with `# REVIEW:` — the cluster prefix differs per target.

For the template, see [references/argocd-infra.md](references/argocd-infra.md) (External Secrets).

For DATP, use `regcred-es.yaml` by default and preserve the DATP namespace/repository
convention. If ESO is unavailable, write `regcred-sealedsecret.yaml` instead: use the
same Secret name in Helm `imagePullSecrets` and provide only a `kubectl create secret
docker-registry ... | kubeseal ...` command template, never encrypted placeholder data.

### 3.3 Infrastructure Dependencies

When analysis detects stateful infrastructure or a component that requires separate
deployment permissions, recommend an Argo CD Application with `sync-wave: "1"`.
Never recommend an Argo CD Application for an ordinary application Helm chart: its
delivery path is GitLab CI `build → deploy` from the application repository.

**Trigger keywords:**

| Component | Triggers in docker-compose / code / docs |
|---|---|
| PostgreSQL | `postgres`, `pgbouncer`, `POSTGRES_`, `DATABASE_URL` |
| Redis | `redis`, `REDIS_URL`, `REDIS_HOST` |
| RabbitMQ | `rabbitmq`, `AMQP_URL`, `RABBITMQ_` |
| Kafka | `kafka`, `KAFKA_BOOTSTRAP_SERVERS` |
| MongoDB | `mongo`, `MONGO_URL`, `MONGODB_URI` |
| Elasticsearch | `elasticsearch`, `ELASTIC_` |
| MinIO | `minio`, `S3_ENDPOINT`, `AWS_S3_` |
| MySQL | `mysql`, `mariadb`, `MYSQL_` |

For each dependency that is confirmed to require an in-cluster stateful deployment or separate deployment permissions, write into `DEPLOYMENT.md`:
1. Application YAML `{argo-project}/{project}-{env}/{component}.yaml` — mark resource sizes with `# REVIEW:`; do not set `storageClass` by default
2. ExternalSecret YAML `{argo-project}/{project}-{env}/{component}-secret-es.yaml` — syncs credentials from Vault, mark path with `# REVIEW:`; if ESO is unavailable, use the corresponding SealedSecret command template instead
3. A note reminding the engineer to create corresponding Vault entries at the expected paths

For full templates, see [references/argocd-infra.md](references/argocd-infra.md) (Infrastructure Components, External Secrets).

For DATP, recommend Argo CD Applications only for dependencies that need in-cluster
state or separate deployment permissions. Put them in `datp/{namespace}/`, use Argo CD
project `datp`, mark versions and resource sizes with `# REVIEW:`, and deliver
credentials through ExternalSecret from `vault-css` or, when ESO is unavailable,
through SealedSecret.

### 3.4 Ingress (ingress.yaml)

If the project has externally accessible services, write a subsection `### Ingress (ingress.yaml)` with the full raw Ingress manifest — nginx annotations, `sync-wave: "1"`. Hosts use **3rd-level domains** under `biocad.dev` (e.g. `{project}.biocad.dev`). TLS is provided by a purchased wildcard certificate — do not use cert-manager annotations. Mark the host and wildcard TLS Secret name with `# REVIEW:`.

For the full template, see [references/argocd-infra.md](references/argocd-infra.md) (Ingress Manifests).

**Embedded services:** when the service is deployed into an existing shared namespace and exposed under an existing shared host path such as `https://{shared-host}/{service}`, do not generate a separate Ingress host or PowerDNS record. Document the path that must be added to the shared Ingress and route API calls through the existing gateway/BFF when the frontend uses same-origin requests.

For DATP, use `ingressClassName: nginx`, TLS Secret `wildcard-botanique`, and hosts under either `{service}.{env}.botanique.app` or `{service}.botanique.app`. Mark the exact host pattern with `# REVIEW:` because both are valid in DATP.

---

## Step 4 — PowerDNS Record

If a new Ingress host is recommended, write a **"PowerDNS"** section into `DEPLOYMENT.md`. Do not recommend a DNS record when an embedded service reuses an existing shared host:

````markdown
## PowerDNS

Add a CNAME record via the PowerDNS Terraform repository. The record points the Ingress host to the GSLB zone of the target cluster.

| Type | Name | Content | TTL |
|---|---|---|---|
| CNAME | `{project}.biocad.dev` | `{cluster-gslb}.gslb.biocad.ru.` | 300 | <!-- REVIEW: GSLB zone name for target cluster -->

GSLB zones are named after the cluster (e.g. `rancher-kube-dev.gslb.biocad.ru.`, `rancher-kube-dr.gslb.biocad.ru.`), but the exact name may differ — verify with the platform team or check existing records in the PowerDNS Terraform repo for the pattern used in your environment.

Without this record, the Ingress will be configured but the host won't be resolvable from the network.
````

For DATP, write an A record instead of CNAME. Each ingress host needs its own PowerDNS A record; wildcard DNS records are not used. The current dev ingress IP is `10.252.156.201` and TTL is `300`. Mark prod IP with `# REVIEW:` until `argocd-datp-prod` details are known.

---

## Naming Conventions

| Entity | Pattern | Example |
|---|---|---|
| Helm release | `{project}-{service}` | `voiceai-orchestrator` |
| Namespace | `{argo-project}-{project}-{env}` | `dis-voiceai-prod` |
| Chart dir | `helm/{service}/` | `helm/orchestrator/` |
| Image suffix | service name | `orchestrator` |
| ConfigMap | `{project}-{service}-config` | `voiceai-orchestrator-config` |
| Secret (Vault) | `{project}-{service}-sec` | `voiceai-orchestrator-sec` |
| fullnameOverride | `{project}-{service}` | `voiceai-orchestrator` |
| imagePullSecret | `{project}-regcred` | `voiceai-regcred` |
| Argo CD App (ns) | `{argo-project}-{project}-{env}` | `dis-voiceai-dev` |
| Argo CD App (infra) | `{project}-{component}` | `voiceai-postgresql` |
| Ingress host | `{project}.biocad.dev` | `voiceai.biocad.dev` |
| PowerDNS CNAME | `{project}.biocad.dev` → `{cluster-gslb}.gslb.biocad.ru.` | `voiceai.biocad.dev` → `rancher-kube-dev.gslb.biocad.ru.` |

### DATP Naming Conventions

| Entity | Pattern | Example |
|---|---|---|
| Argo CD repo | `argocd-datp-{cluster-env}` | `argocd-datp-dev` |
| Argo CD project | `datp` | `datp` |
| Argo CD folder | `datp/{namespace}/` | `datp/datp-ais-botanique-dev/` |
| Namespace | `datp-ais-{app}-{env}` or `datp-ais-botanique-{env}` | `datp-ais-botanique-dev` |
| CI environment | `{env}` | `dev`, `qa`, `uat`, `prod` |
| Dev K8s cluster | `datp-kube-dev01` | `datp-kube-dev01` |
| Dev runner tag | `rancher-datp-kube-dev` | `rancher-datp-kube-dev` |
| Registry Secret | `{project}-regcred` | `botanique-regcred` |
| App Secret | `{project}-{service}-sec` | `botanique-api-sec` |
| Ingress host | `{service}.{env}.botanique.app` or `{service}.botanique.app` | `api.dev.botanique.app` |
| TLS Secret | `wildcard-botanique` | `wildcard-botanique` |
| PowerDNS A | `{host}` → `10.252.156.201` | `api.dev.botanique.app` → `10.252.156.201` |

Labels (set by bcd-web `_helpers.tpl`):

```yaml
app.kubernetes.io/name: bcd-web
app.kubernetes.io/instance: {HELM_RELEASE}
```

### Image Tag Strategy

```yaml
image:
  repository: $CI_REGISTRY_IMAGE
  tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
  suffix: {service}
```

### Secrets

Never put secret values in `values.yaml`. For the **default profile**, store them in Vault — one entry per release, containing overrides for all services in that release:

```
{argo-project}/{project}/{CI_PROJECT_ID}/{CI_COMMIT_REF_PROTECTED}/{CI_ENVIRONMENT_NAME}/helm_values@gitlab-kv
```

Examples from existing projects:
- `{argo-project}/{shared-app}/{CI_PROJECT_ID}/{CI_COMMIT_REF_PROTECTED}/{CI_ENVIRONMENT_NAME}/helm_values@gitlab-kv`
- `dir/voiceai/{CI_PROJECT_ID}/{CI_COMMIT_REF_PROTECTED}/{CI_ENVIRONMENT_NAME}/helm_values@gitlab-kv`

For the **DATP profile**, use ExternalSecret by default and SealedSecret as a reserve
mechanism; keep only Secret names in Helm values (`envFromSecrets`,
`imagePullSecrets`, and chart `existingSecret` fields). See
[references/argocd-datp.md](references/argocd-datp.md).

---

## Shared ReadWriteOnce Volumes

When two or more services mount the **same PVC** with `ReadWriteOnce`:

1. **Owner** — the service that creates the PVC via `persistence`. No affinity constraint, schedules freely.
2. **Dependents** — add `podAffinity` to the owner:

```yaml
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels:
              app.kubernetes.io/name: bcd-web
              app.kubernetes.io/instance: {project}-{owner-service}
          topologyKey: kubernetes.io/hostname
```

3. Never set mutual affinity (deadlock).
4. Dependents reference PVC by name in `volumes`, do not duplicate in `persistence`.

---

## Output Checklist

When the skill completes, the repository should contain:

### Generated Files (in project repository)

- [ ] Dockerfiles per service (if missing or improved)
- [ ] `.dockerignore` per service
- [ ] `docker-compose.yaml` with all services and infrastructure
- [ ] `.env.example` with all secret variables (empty)
- [ ] `helm/{service}/Chart.yaml` per service (bcd-web 0.2.3)
- [ ] `helm/{service}/values.yaml` per service (all env vars classified)
- [ ] `.gitlab-ci.yml` with build matrix and deploy jobs

### `DEPLOYMENT.md` (in project repository root)

Single file the engineer reads through, configures, and later keeps or deletes:

- [ ] **Vault Secrets** — ExternalSecret template per service with path and YAML, or SealedSecret command template when ESO is unavailable
- [ ] **Argo CD** — `ns-hr.yaml` (namespace, k8s-ns ~1.2.2)
- [ ] **Argo CD** — `regcred-es.yaml` (ExternalSecret for registry credentials) or `regcred-sealedsecret.yaml` when ESO is unavailable
- [ ] **Argo CD** — infrastructure component Applications with `sync-wave: "1"` (per detected dependency)
- [ ] **Argo CD** — ExternalSecret manifests per component (Vault-backed via `vault-css`) or SealedSecret command templates when ESO is unavailable
- [ ] **Argo CD** — `ingress.yaml` (if external access needed)
- [ ] **PowerDNS** — DNS record table for each Ingress host (CNAME for the default profile, A record for DATP)
- [ ] **Review Required** — summary table of all `# REVIEW:` fields across all files

## Additional Resources

- For bcd-web chart values reference, see [references/bcd-web-values.md](references/bcd-web-values.md)
- For per-environment value overlays (`HELM_VALUES_*`, deep-merge, example), see [references/overlays.md](references/overlays.md)
- For ns-chart (k8s-ns) values reference, see [references/ns-chart-values.md](references/ns-chart-values.md)
- For Argo CD infrastructure patterns, see [references/argocd-infra.md](references/argocd-infra.md)
- For DATP Argo CD infrastructure patterns, see [references/argocd-datp.md](references/argocd-datp.md)
- For Docker Compose → bcd-web mapping table, see [references/compose-mapping.md](references/compose-mapping.md)
