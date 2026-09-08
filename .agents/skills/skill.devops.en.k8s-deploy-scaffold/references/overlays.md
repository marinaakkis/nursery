# Namespace-scoped value overlays

How to vary Helm values by Kubernetes namespace — resource limits, replica counts, env
vars, feature flags — **without duplicating the deploy job** and without forking
`values.yaml`.

## Namespace contract

`ENVIRONMENT` is the exact name of the target Kubernetes namespace. One GitLab
environment maps to one namespace, and their names must be identical; do not derive a
second namespace name from an environment label or suffix.

| Field | Required value |
|---|---|
| `ENVIRONMENT` | Kubernetes namespace name, compliant with Kubernetes naming rules. |
| `environment.name` | `${ENVIRONMENT}` — the same namespace name for GitLab deployment tracking. |
| `HELM_VALUES_OVERLAY` | `helm/<service>/overlays/${ENVIRONMENT}/values_patch.yaml`. |

The deployment component must target this same namespace through its documented namespace
setting. `environment.name` records the deployment in GitLab; it does not by itself change
the namespace passed to Helm. Keep the component's namespace setting and `ENVIRONMENT`
equal, and verify the rendered command or release metadata before delivery.

## Mechanism (`.k8s.Helm.Install`)

At deploy time the component (`iac/ci-components/k8s/helm`) scans the job environment for
**every** variable named `HELM_VALUES` or matching `HELM_VALUES_*` (except
`HELM_VALUES_DEFAULT_FILE`) and passes each as an additional `helm upgrade --values <file>`:

- Files are ordered **by variable name**, case-insensitively; each later file overrides the
  previous (`--values` layering).
- The Vault secret file (`HELM_VALUES_SECRET`, default `helm_values.tmp.yaml`) is appended
  **last** → highest precedence.
- Each file is rendered by the custom `envsubst` if it contains `$` (`${VAR}`,
  `${VAR:-fallback}`; bare unset variable → error).

**Precedence (low → high):** `values.yaml` (`HELM_VALUES`) → overlay(s) (`HELM_VALUES_*`,
by name) → Vault secret (`helm_values.tmp.yaml`).

Naming controls order: to layer several overlays deterministically, name them
`HELM_VALUES_1_ENV`, `HELM_VALUES_2_REGION`, … A `HELM_VALUES_OVERLAY` sorts before
`HELM_VALUES_SECRET`, so the Vault secret still wins — which is what you want.

## Convention

- Single-chart repo: `helm/<service>/overlays/${ENVIRONMENT}/values_patch.yaml`
- Wire it in the (single) deploy job — `ENVIRONMENT` is set by `workflow.rules` to the
  exact target namespace:

```yaml
deploy:<service>:
  extends: .k8s.Helm.Install
  variables:
    HELM_RELEASE: "<project>-<service>"
    HELM_CHART: "helm/<service>"
    HELM_VALUES: "helm/<service>/values.yaml"
    HELM_VALUES_OVERLAY: "helm/<service>/overlays/${ENVIRONMENT}/values_patch.yaml"
    HELM_VALUES_SECRET: "helm_values.tmp.yaml"
  environment:
    name: "${ENVIRONMENT}"
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
    - if: $CI_COMMIT_BRANCH == "dev" || $CI_COMMIT_BRANCH == "stage"
```

One deploy job handles all target namespaces; the overlay path resolves per namespace
because GitLab expands `${ENVIRONMENT}` in the variable value before the job runs.

## Deep-merge vs list — patch only what changes

Helm merges values files as follows:

- **Maps are deep-merged** → an overlay that sets a nested key overrides only that key; all
  sibling keys from `values.yaml` are preserved.
- **Lists (YAML sequences) are replaced wholesale** → an overlay that provides a list must
  restate the entire list.

This makes the bcd-web schema important: `bcd-web.containers` is a **map keyed by container
name**, NOT a list. Базовый `values.yaml` остаётся полным; overlay содержит только
изменения конкретного namespace. Не используй flow-стиль YAML (`{...}` и `[...]`):
развёрнутая запись обязательна.

Фундаментальные секции присутствуют и в base, и в каждом overlay: `resources`,
`configmaps_create`, закомментированный шаблон `secrets_create` и NetworkPolicy.
Внутри них overlay содержит только значения, отличающиеся для namespace; для
`secrets_create` в Git остаются только имена ключей и `<ЗНАЧЕНИЕ_ИЗ_VAULT>`.

```yaml
# overlays/<namespace>/values_patch.yaml
bcd-web:
  containers:
    backend:
      resources:
        limits:
          cpu: "1"
          memory: 1Gi
  configmaps_create:
    <project>-backend-config:
      APP_ENVIRONMENT: "production"
  # secrets_create:
  #   <project>-backend-sec:
  #     API_TOKEN: "<ЗНАЧЕНИЕ_ИЗ_VAULT>"
  networkPolicy:
    # Полные ingress/egress-списки для конкретного namespace.
```

The backend container's `image`, `ports`, `probes`, and the whole `frontend` container are
untouched. If a field you need to vary is a YAML list (e.g. `ports`, `env` arrays in some
charts), the overlay must contain the complete list, not a fragment.

## ⚠️ A missing overlay file fails the deploy

If a `HELM_VALUES_*` variable points to a file that does not exist, the component aborts:
`Helm values file not found`. Therefore:

- Create an overlay file for **every** target namespace selected by `ENVIRONMENT`.
- An **empty** file (comment-only) is a valid no-op — use it when a namespace needs no
  override.

## Example — per-namespace backend resources

`deploy:<service>` sets `HELM_VALUES_OVERLAY: "helm/<service>/overlays/${ENVIRONMENT}/values_patch.yaml"`.

`helm/<service>/overlays/<namespace-a>/values_patch.yaml`:
```yaml
bcd-web:
  containers:
    backend:
      resources:
        requests:
          cpu: 200m
          memory: 256Mi
        limits:
          cpu: 500m
          memory: 512Mi
```

`helm/<service>/overlays/<namespace-b>/values_patch.yaml`:
```yaml
bcd-web:
  containers:
    backend:
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 1
          memory: 1Gi
```

Same-Pod `frontend` (nginx) resources stay as defined in `values.yaml` — deep-merge leaves
them alone.

## Verify before merge

Prove the merge renders what you expect (maps deep-merge, lists don't):

```bash
helm repo add bcd https://charts.k8s.biocad.ru/ && helm repo update
helm dependency build helm/<service>
helm template x helm/<service> \
  --namespace <namespace> \
  -f helm/<service>/values.yaml \
  -f helm/<service>/overlays/<namespace>/values_patch.yaml \
  | grep -A6 'name: backend'
# expect the stage limits/requests; other containers unchanged
```
