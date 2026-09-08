# Templates Reference

Copy these snippets and replace placeholders with actual project values.

Do not use project-specific names from sample repositories as generic
placeholder names. Use neutral placeholders such as `<release>`, `<service>`,
`<chart-dir>`, `<values-file>`, `<job-key>`, and `<env>`.

## Chart.yaml Dependency

```yaml
apiVersion: v2
name: <chart-name>
description: <description>
type: application
version: 0.0.1
appVersion: "no"

dependencies:
  - name: bcd-web
    version: 0.2.3
    repository: "https://charts.k8s.biocad.ru/"
```

## CI Includes

```yaml
include:
  - component: $CI_SERVER_HOST/iac/ci-components/main/ci@2.1.2
```

## Deploy Template

Use this when creating a complete scaffold. If the project already has a
working deploy template, preserve it and only align ops values with it.

```yaml
.deploy_template:
  stage: deploy:chart
  extends: .k8s.Helm.Install
  before_script:
    - |
      cat "$helm_values" > helm_values.tmp.yaml
  secrets:
    helm_values:
      vault: "<vault-helm-values-path>"
      file: true
  environment:
    name: "${ENVIRONMENT}"
  tags:
    - ${DEPLOY_RUNNER_TAG}
  resource_group: deploy:<release>
  variables:
    HELM_RELEASE: "<release>"
    HELM_CHART: "<chart-dir>"
    HELM_VALUES: "<values-file>"
    HELM_VALUES_SECRET: "helm_values.tmp.yaml"
```

## Ops And One-Off Job Template

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

## App Rollback Button

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

## Manual Job Button

```yaml
db:<job-key>:<env>:
  extends: .db_job_template
  variables:
    JOB_KEY: <job-key>
  rules:
    - if: <environment-rule>
```

## Confirmed Target Job Button

```yaml
db:migrate:to:<env>:
  extends: .db_job_template
  allow_failure: false
  variables:
    JOB_KEY: migrate-to
    JOB_REQUIRED_ENV: "MIGRATE_TARGET"
    JOB_REQUIRE_CONFIRM: "true"
    JOB_CONFIRM_EXPECTED: "<release>/migrate-to"
    MIGRATE_TARGET: ""
  rules:
    - if: <environment-rule>
```

Operator variables:

```text
MIGRATE_TARGET=<target>
JOB_CONFIRM=<release>/migrate-to
```

## Complete `.gitlab-ci.yml` Scaffold

Use this as a full starting point when adding deploy, one-off jobs, and app
rollback. Keep existing build/test jobs and project-specific includes outside
this scaffold as needed.

```yaml
include:
  - component: $CI_SERVER_HOST/iac/ci-components/main/ci@2.1.2

stages:
  - build:image
  - test
  - deploy:chart
  - ops

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "<default-branch>"
      variables:
        ENVIRONMENT: "<dev-environment>"
        DEPLOY_RUNNER_TAG: "<dev-runner-tag>"
    - if: $CI_COMMIT_TAG
      variables:
        ENVIRONMENT: "<prod-environment>"
        DEPLOY_RUNNER_TAG: "<prod-runner-tag>"
    - if: $CI_COMMIT_BRANCH

.helm_runtime_template:
  before_script:
    - |
      cat "$helm_values" > helm_values.tmp.yaml
  secrets:
    helm_values:
      vault: "<vault-helm-values-path>"
      file: true
  environment:
    name: "${ENVIRONMENT}"
  tags:
    - ${DEPLOY_RUNNER_TAG}
  variables:
    HELM_RELEASE: "<release>"
    HELM_CHART: "<chart-dir>"
    HELM_VALUES: "<values-file>"
    HELM_VALUES_SECRET: "helm_values.tmp.yaml"

.deploy_template:
  stage: deploy:chart
  extends:
    - .helm_runtime_template
    - .k8s.Helm.Install
  interruptible: false
  resource_group: deploy:<release>

deploy:<env>:
  extends: .deploy_template
  rules:
    - if: <environment-rule>

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
    - .helm_runtime_template
    - .ops_template
    - .k8s.Job.Run
  interruptible: false
  variables:
    JOB_TEMPLATE: "charts/bcd-web/templates/job.yaml"
    JOB_VALUES_PATH: "bcd-web.jobs"
    JOB_STREAM_LOGS: "false"

db:migrate:down:<env>:
  extends: .db_job_template
  variables:
    JOB_KEY: migrate-down
  rules:
    - if: <environment-rule>

db:migrate:to:<env>:
  extends: .db_job_template
  allow_failure: false
  variables:
    JOB_KEY: migrate-to
    JOB_REQUIRED_ENV: "MIGRATE_TARGET"
    JOB_REQUIRE_CONFIRM: "true"
    JOB_CONFIRM_EXPECTED: "<release>/migrate-to"
    MIGRATE_TARGET: ""
  rules:
    - if: <environment-rule>

db:seed:up:<env>:
  extends: .db_job_template
  variables:
    JOB_KEY: seed-up
  rules:
    - if: <environment-rule>

db:seed:down:<env>:
  extends: .db_job_template
  variables:
    JOB_KEY: seed-down
    JOB_REQUIRE_CONFIRM: "true"
    JOB_CONFIRM_EXPECTED: "<release>/seed-down"
  rules:
    - if: <environment-rule>

db:legacy:import:<env>:
  extends: .db_job_template
  variables:
    JOB_KEY: legacy-import
    JOB_TIMEOUT: "1860"
  rules:
    - if: <environment-rule>

db:verify:<env>:
  extends: .db_job_template
  allow_failure: true
  variables:
    JOB_KEY: verify
  rules:
    - if: <environment-rule>

rollback:app:<env>:
  extends:
    - .ops_template
    - .k8s.Helm.Rollback
  variables:
    HELM_RELEASE: "<release>"
  rules:
    - if: <environment-rule>
```

If the project already has `.deploy_template`, keep it and add only the ops
section. The critical invariant is that deploy and one-off jobs use the same
Helm release, chart, values file, Vault values file, environment, runner tag,
and `resource_group`.
