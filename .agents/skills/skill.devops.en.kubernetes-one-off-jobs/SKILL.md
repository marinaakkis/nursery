---
name: kubernetes-one-off-jobs
description: >-
  Scaffold reusable GitLab CI/CD jobs for manual one-off Kubernetes tasks using
  bcd-web-chart 0.2.3 and the standard main CI component.
  Use when adding or reviewing migration down/to, seed up/down, Alembic or
  dotnet commands, legacy data imports, backfills, verification jobs, S3/object
  storage upload jobs, app rollback buttons, or other scripts that must run
  inside Kubernetes from the same Helm values, Vault values, images, secrets,
  security context, and NetworkPolicy as the service.
---

# Kubernetes One-Off Jobs Scaffold

Use this scaffold when a project needs **manual operational buttons** in GitLab
that render and run exactly one Kubernetes Job from the shared `bcd-web` chart.

This is for tasks such as migration down, explicit migration target, seed
up/down, legacy import, backfill, repair, verification, or asset upload. It is
not a Helm hook and it is not a pre-deploy migration pipeline unless the user
explicitly asks for that architecture.

For complete `.gitlab-ci.yml` and `Chart.yaml` scaffolds, see
[templates-reference.md](templates-reference.md). For a complete `values.yaml`
scaffold and job examples, see [values-reference.md](values-reference.md).
For troubleshooting and safety review, see [operations-reference.md](operations-reference.md).

## Workflow

### Step 1: Analyze Project Runtime

Inspect the repository before editing:

1. `.gitlab-ci.yml` — includes, stages, deploy job, environment rules, runner tags.
2. `helm/<service>/Chart.yaml` — current `bcd-web` dependency version.
3. `helm/<service>/values.yaml` — containers, image suffixes, secrets,
   NetworkPolicy, existing `bcd-web.jobs`.
4. Dockerfiles — whether the command lives in the app image or a separate
   migration image.
5. Existing migration/seed/import scripts — command, runtime, env vars, safety.

Collect these values:

| Property | Example placeholder |
|---|---|
| Release name | `<release>` |
| Chart path | `<chart-dir>` |
| Values file | `<values-file>` |
| Environment variable | `${ENVIRONMENT}` |
| Vault helm values file variable | `$helm_values` |
| Resource group | `deploy:<release>` |
| Main app container key | `<app-container>` |
| Migration image suffix | `<image-suffix>` |

Use actual project names in real code. In scaffold text, use neutral
placeholders such as `<project>`, `<service>`, `<release>`, and `<job-key>`;
do not use names copied from sample repositories.

### Step 2: Pin Standard Versions

`Chart.yaml` must use:

```yaml
dependencies:
  - name: bcd-web
    version: 0.2.3
    repository: "https://charts.k8s.biocad.ru/"
```

`.gitlab-ci.yml` must include the standard main component:

```yaml
include:
  - component: $CI_SERVER_HOST/iac/ci-components/main/ci@2.1.2
```

`main/ci@2.1.2` уже содержит шаблоны, необходимые для ручных операций.
Не добавляй отдельные include для Job или rollback-кнопки.

### Step 3: Preserve Deploy Runtime

Do not rewrite working deploy jobs unless required. Reuse the same Helm release,
chart, values, Vault values file, environment, tags, and `resource_group`.

If the project uses a Vault file, keep `before_script` minimal:

```yaml
before_script:
  - |
    cat "$helm_values" > helm_values.tmp.yaml
```

Do not add envsubst, Helm repo setup, kubeconfig setup, image tag exports, or
debug printing to project `before_script`. The CI component owns those steps.

### Step 4: Add CI Scaffold

Use this shape:

```yaml
.ops_template:
  stage: ops
  when: manual
  environment:
    name: "${ENVIRONMENT}"
  tags:
    - ${DEPLOY_RUNNER_TAG}
  resource_group: deploy:<release>

.db_job_template:
  extends:
    - .ops_template
    - .k8s.Job.Run
  before_script:
    - |
      cat "$helm_values" > helm_values.tmp.yaml
  secrets:
    helm_values:
      vault: "<vault-helm-values-path>"
      file: true
  variables:
    HELM_RELEASE: "<release>"
    HELM_CHART: "<chart-dir>"
    HELM_VALUES: "<values-file>"
    HELM_VALUES_SECRET: "helm_values.tmp.yaml"
    JOB_TEMPLATE: "charts/bcd-web/templates/job.yaml"
    JOB_VALUES_PATH: "bcd-web.jobs"
    JOB_STREAM_LOGS: "false"
```

Use `JOB_STREAM_LOGS: "false"` as the default. Job logs are normally inspected
from Kubernetes observability, not streamed through CI.

### Step 5: Add Values Scaffold

All one-off tasks live under:

```yaml
bcd-web:
  jobs:
    <job-key>:
      enabled: false
```

Keep `enabled: false` committed. `.k8s.Job.Run` enables only the selected
`JOB_KEY` during render.

Use `containerRef` when the command already exists in an application container.
Use a dedicated image when the task has a separate Dockerfile/runtime, for
example Python data migration or Alembic tooling.

With `bcd-web` `0.2.3`, the rendered Job must have `runAsUser` and
`runAsGroup`. They can be inherited from `containerRef` or explicitly set in
`jobs.<key>.securityContext`.

### Step 6: Add Manual Buttons

Create one GitLab job per `bcd-web.jobs.<key>`:

```yaml
db:<job-key>:<env>:
  extends: .db_job_template
  variables:
    JOB_KEY: <job-key>
  rules:
    - if: <environment-rule>
```

For destructive or targeted operations, require confirmation:

```yaml
variables:
  JOB_KEY: migrate-to
  JOB_REQUIRED_ENV: "MIGRATE_TARGET"
  JOB_REQUIRE_CONFIRM: "true"
  JOB_CONFIRM_EXPECTED: "<release>/migrate-to"
  MIGRATE_TARGET: ""
```

### Step 7: Add Rollback Button When Needed

App rollback rolls back manifests, image, and config. It must not mutate the
database.

```yaml
rollback:app:<env>:
  extends:
    - .ops_template
    - .k8s.Helm.Rollback
  variables:
    HELM_RELEASE: "<release>"
  rules:
    - if: <environment-rule>
```

Database rollback, seed down, and data repair are separate manual jobs.

### Step 8: Validate

Run the strongest available local validation:

```bash
helm dependency build <chart-dir>

helm template <release> <chart-dir> \
  --values <values-file> \
  --set bcd-web.jobs.<job-key>.enabled=true \
  --show-only charts/bcd-web/templates/job.yaml
```

Check that exactly one `kind: Job` renders and inspect image, command,
envFrom, secrets by name, resources, deadlines, and security context.

### Step 9: Report

Report:

- chart/component versions;
- CI jobs added;
- values keys added;
- image strategy (`containerRef` or dedicated image);
- secrets and network assumptions;
- safety gates;
- validation result;
- remaining script-level idempotency risks.

Say clearly when app rollback does not roll back database or data changes.

---

## Standard Decisions

### Use `.k8s.Job.Run` 

One-off Jobs are explicit manual operations.

### Do Not Add Pre-Deploy Migration Up By Default

If the application already applies migration `up` on startup, keep that
architecture. Add manual `migrate-down`, `migrate-to`, `seed-down`, verify, or
legacy import jobs only when they are needed.

### Keep Image Tags In Values

This is valid with the custom CI component envsubst:

```yaml
tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
```

Do not synthesize `IMAGE_TAG` in the reusable CI component or project job when
the values file already contains the fallback policy.

### Keep Logs Out Of CI By Default

Set `JOB_STREAM_LOGS: "false"`. CI should create the Job and wait for status;
operators can inspect logs in Kubernetes.

### Serialize Operations

Use the same `resource_group` for deploy, rollback, and one-off Jobs:

```yaml
resource_group: deploy:<release>
```

This prevents a deploy and data operation from racing each other.
