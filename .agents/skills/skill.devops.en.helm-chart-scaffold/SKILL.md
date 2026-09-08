---
name: helm-chart-scaffold
description: >-
  Scaffold production-grade Helm charts with templates, values, and helpers
  following Bitnami best practices. Analyzes repository content (Dockerfiles,
  docker-compose, source code) and generates a complete self-contained chart.
  Use when creating Helm charts from scratch, writing Chart.yaml, values.yaml,
  templates/, _helpers.tpl, or packaging applications for Kubernetes — even
  if the user just says "create a chart" or "helm init".
---

# Helm Chart Development (Bitnami Best Practices)
## Workflow

Use this scaffold when a project needs a **standalone Helm chart** with its own
`templates/` directory. For standard application deployments that use
the shared `bcd-web` dependency chart and do not commit local templates, follow
`deploy/k8s-deploy-scaffold` instead.

### Step 1: Analyze Repository

Before generating anything, inspect the repository to extract:

1. **Dockerfiles** — base image, exposed ports, entrypoint/cmd, build args
2. **docker-compose files** — services, images, ports, env vars, volumes, depends_on, resource limits, healthchecks
3. **Source code** — HTTP server ports, health/readiness endpoints, config file paths
4. **Existing configs** — `.env` files (note but do NOT embed secrets), config files, nginx/apache configs

Collect into a mental model:

| Property | Where to find |
|---|---|
| Container ports | `EXPOSE` in Dockerfile, `ports:` in compose |
| Health endpoint | Source code routes (`/health`, `/ready`, `/livez`) |
| Env vars | `ENV` in Dockerfile, `environment:` in compose |
| Volumes / mounts | `VOLUME` in Dockerfile, `volumes:` in compose |
| Resource needs | `deploy.resources:` in compose, or estimate from app type |
| Secrets | Vars with PASSWORD, SECRET, TOKEN, API_KEY, CREDENTIAL |

### Step 2: Create Chart Scaffold

```
<chart-name>/
├── Chart.yaml
├── values.yaml
├── .helmignore
└── templates/
    ├── NOTES.txt
    ├── _helpers.tpl
    ├── deployment.yaml          # or statefulset.yaml
    ├── service.yaml
    ├── serviceaccount.yaml
    ├── configmap.yaml           # if app config needed
    ├── secret.yaml              # if non-external secrets
    ├── ingress.yaml
    ├── hpa.yaml
    ├── pdb.yaml
    ├── networkpolicy.yaml
    └── extra-list.yaml          # renders extraDeploy
```

Only include templates relevant to the application. Stateful apps (databases, queues) use `statefulset.yaml` + headless service instead of `deployment.yaml`.

### Step 3: Generate Files

Follow the conventions below for each file. For complete template code, see [templates-reference.md](templates-reference.md). For the full values.yaml structure, see [values-reference.md](values-reference.md).

### Step 4: Validate

```bash
helm lint <chart-dir>
helm template test-release <chart-dir> --debug
```

### Step 5: Report

List created files, summarize key decisions (ports, probes, persistence), flag any detected secrets. Say: **"Ready for feedback."**

---

## Chart.yaml

```yaml
apiVersion: v2
name: <chart-name>
description: A Helm chart for <Application>
type: application
version: 0.1.0
appVersion: "<app-version>"
keywords:
  - <keyword>
maintainers:
  - name: <team-or-person>
```

- `version` — chart version, follows SemVer
- `appVersion` — application version (from Dockerfile tag or source)
- Add `dependencies:` only when consuming actual sub-charts

---

## _helpers.tpl (Named Templates)

Every chart must define these helpers. Replace `<CHART>` with actual chart name.

### Name resolution

```
{{- define "<CHART>.name" -}}
  Truncate .Chart.Name to 63 chars
{{- end }}

{{- define "<CHART>.fullname" -}}
  If fullnameOverride set → use it (truncated to 63)
  Else if nameOverride set → combine with .Release.Name (truncated to 63)
  Else → combine .Release.Name + .Chart.Name (truncated to 63)
{{- end }}

{{- define "<CHART>.chart" -}}
  printf "%s-%s" .Chart.Name .Chart.Version, replace "+" with "_", truncate 63
{{- end }}

{{- define "<CHART>.namespace" -}}
  .Release.Namespace
{{- end }}
```

### Labels (Kubernetes recommended)

```
{{- define "<CHART>.labels" -}}
  helm.sh/chart: {{ include "<CHART>.chart" . }}
  {{ include "<CHART>.selectorLabels" . }}
  app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
  app.kubernetes.io/managed-by: {{ .Release.Service }}
  + merge .Values.commonLabels if set
{{- end }}

{{- define "<CHART>.selectorLabels" -}}
  app.kubernetes.io/name: {{ include "<CHART>.name" . }}
  app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
```

### Image

```
{{- define "<CHART>.image" -}}
  If .Values.global.imageRegistry → use as registry override
  Build: registry/repository:tag (or @digest if digest set)
{{- end }}

{{- define "<CHART>.imagePullSecrets" -}}
  Merge .Values.global.imagePullSecrets + .Values.image.pullSecrets
  Render as imagePullSecrets list
{{- end }}
```

### ServiceAccount

```
{{- define "<CHART>.serviceAccountName" -}}
  If .Values.serviceAccount.create → default to fullname
  Else → default to "default"
{{- end }}
```

Full template code: [templates-reference.md#helpers](templates-reference.md)

---

## values.yaml Structure

All keys use **camelCase**. Sections in canonical order:

```yaml
global:                    # Cross-chart overrides
  imageRegistry: ""
  imagePullSecrets: []
  storageClass: ""

image:                     # Primary container image
  registry: docker.io
  repository: <org>/<app>
  tag: ""                  # Defaults to .Chart.AppVersion
  digest: ""
  pullPolicy: IfNotPresent
  pullSecrets: []

nameOverride: ""
fullnameOverride: ""

replicaCount: 1
revisionHistoryLimit: 10
updateStrategy:
  type: RollingUpdate

containerPorts:            # Named ports
  http: 8080

podSecurityContext:        # Pod-level
  enabled: true
  fsGroup: 1001

containerSecurityContext:  # Container-level
  enabled: true
  runAsUser: 1001
  runAsGroup: 1001
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL

resources:                 # Explicit limits/requests
  limits:
    cpu: "500m"
    memory: 512Mi
  requests:
    cpu: "200m"
    memory: 256Mi

# Probes — each has .enabled + defaults, plus custom*Probe override
livenessProbe:
  enabled: true
  # httpGet/tcpSocket/exec + timing params

readinessProbe:
  enabled: true

startupProbe:
  enabled: false

customLivenessProbe: {}
customReadinessProbe: {}
customStartupProbe: {}

service:                   # Service configuration
ingress:                   # Ingress (enabled: false by default)
persistence:               # PVC (enabled: false by default)
serviceAccount:            # SA creation
rbac:                      # RBAC rules
networkPolicy:             # NetworkPolicy
autoscaling:               # HPA
pdb:                       # PodDisruptionBudget

# Scheduling
affinity: {}
nodeSelector: {}
tolerations: []
topologySpreadConstraints: []
podAffinityPreset: ""
podAntiAffinityPreset: soft
nodeAffinityPreset:
  type: ""
  key: ""
  values: []

# Extensibility hooks
extraEnvVars: []
extraEnvVarsCM: ""
extraEnvVarsSecret: ""
extraVolumes: []
extraVolumeMounts: []
extraDeploy: []
initContainers: []
sidecars: []
commonLabels: {}
commonAnnotations: {}
podLabels: {}
podAnnotations: {}
```

Full reference with defaults: [values-reference.md](values-reference.md)

---

## Template Patterns

### Deployment / StatefulSet

Key conventions:
- **Replicas**: omit `replicas:` when `.Values.autoscaling.enabled` is true (HPA owns scaling)
- **Labels**: metadata gets `<CHART>.labels`, pod template and selector get `<CHART>.selectorLabels` merged with `podLabels` + `commonLabels`
- **Affinity**: if `.Values.affinity` is set, use it directly; otherwise compute from presets (`podAffinityPreset`, `podAntiAffinityPreset`, `nodeAffinityPreset`)
- **Security context**: render `podSecurityContext` and `containerSecurityContext` only when `.enabled: true`
- **Probes**: three-way branch per probe: `custom*Probe` → user override; `*.enabled` → default; else omit
- **Resources**: use `.Values.resources` if set
- **Env**: render `extraEnvVars` list, `envFrom` with `extraEnvVarsCM` / `extraEnvVarsSecret`
- **Volumes/Mounts**: merge persistence volume + `extraVolumes` / `extraVolumeMounts`
- **Init containers / Sidecars**: render `initContainers` and `sidecars` from values
- **Namespace**: always set `metadata.namespace: {{ .Release.Namespace | quote }}`

### Service

- Conditional fields based on `.Values.service.type` (ClusterIP → clusterIP, LoadBalancer → loadBalancerIP/sourceRanges/externalTrafficPolicy, NodePort → nodePorts + externalTrafficPolicy)
- `sessionAffinity` and `sessionAffinityConfig` support
- Selector uses `<CHART>.selectorLabels`

### Ingress

- Gate with `{{- if .Values.ingress.enabled }}`
- Use `ingressClassName` (modern) over annotation-based class
- TLS block: cert-manager auto-detection from annotations, selfSigned support, extraTls
- Support `extraHosts` and `extraRules`
- For an embedded service exposed under an existing portal host path, keep chart ingress disabled and document the shared ingress path rule instead of creating another host

### Writable Filesystem

- Keep `readOnlyRootFilesystem: true` only when the runtime has no writable-path requirements
- Set it to `false`, or mount writable `emptyDir` volumes, for .NET temp files and DataProtection, runtime-generated exports, nginx cache, and frontend runtime env substitution

### HPA

- Gate with `{{- if .Values.autoscaling.enabled }}`
- `scaleTargetRef` points to Deployment (or StatefulSet)
- Metrics: CPU and memory as Resource type with `averageUtilization`

### NetworkPolicy

- Gate with `{{- if .Values.networkPolicy.enabled }}`
- Default to deny-by-default ingress and egress; do not enable broad external ingress.
- Use `namespaceSelector` plus `podSelector` for every in-cluster caller and dependency. Obtain both from target-cluster inventory.
- Allow DNS only through an inventory-confirmed CoreDNS/kube-dns selector. Use `extraEgress` for explicit dependencies.
- Treat an external endpoint as an exception: use an approved narrow CIDR or an egress-gateway selector, never `10.0.0.0/8`.
- Keep all rules selecting one workload in a single policy; use a separate policy only for a distinct Job or StatefulSet selector.
- Read the [standalone-chart profile](../k8s-deploy-scaffold/references/network-policy-contract.md#profile-standalone-chart). Do not add a `bcd-web` label to a standalone chart merely to match another workflow.

### PDB

- Gate with `{{- if .Values.pdb.create }}`
- Mutually exclusive: `minAvailable` or `maxUnavailable` (default to `maxUnavailable: 1`)

### ServiceAccount

- Gate with `{{- if .Values.serviceAccount.create }}`
- Set `automountServiceAccountToken`
- Merge annotations with `commonAnnotations`

### ConfigMap

- For non-secret application configuration
- Add checksum annotation to pod template to trigger rolling restart on config change:
  ```
  checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
  ```

### Secret

- For credentials that must live in-cluster
- **Prefer external secret management** (Vault, External Secrets Operator, Sealed Secrets)
- If generating: use `lookup` to preserve existing secret data across upgrades

### extra-list.yaml

Renders arbitrary manifests from `.Values.extraDeploy`:
```
{{- range .Values.extraDeploy }}
---
{{ tpl (toYaml .) $ }}
{{- end }}
```

Full template code for all resources: [templates-reference.md](templates-reference.md)

---

## Sensitive Data Handling

When analyzing the repository, scan for variables matching:
`PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, `CREDENTIAL`, `PRIVATE_KEY`, `CONNECTION_STRING`

**If found**, notify the user:

> **Sensitive Data Detected**
>
> The following secrets were identified: [list]
>
> These should NOT be hardcoded in values.yaml. Recommended approaches:
> 1. **External Secrets Operator** — syncs from Vault/AWS/GCP to K8s Secrets
> 2. **Sealed Secrets** — encrypted secrets safe for git
> 3. **Helm `--set`** — pass at install time from CI/CD pipeline
> 4. **HashiCorp Vault** with CSI driver or sidecar injector

Place secret references in values.yaml as `existingSecret` fields, not literal values.

---

## Checklist

```
- [ ] Analyze repository (Dockerfile, compose, source)
- [ ] Identify ports, env vars, volumes, health endpoints
- [ ] Check for sensitive data — warn user if found
- [ ] Create Chart.yaml
- [ ] Create _helpers.tpl with all named templates
- [ ] Create values.yaml with all sections
- [ ] Create deployment.yaml (or statefulset.yaml)
- [ ] Create service.yaml
- [ ] Create ingress.yaml (if web-facing)
- [ ] Create serviceaccount.yaml
- [ ] Create hpa.yaml
- [ ] Create pdb.yaml
- [ ] Create networkpolicy.yaml
- [ ] Create configmap.yaml / secret.yaml (if needed)
- [ ] Create NOTES.txt
- [ ] Create extra-list.yaml
- [ ] Create .helmignore
- [ ] Run helm lint
- [ ] Report to user
```

## Additional Resources

- For complete Go template code for every resource, see [templates-reference.md](templates-reference.md)
- For full default values.yaml structure, see [values-reference.md](values-reference.md)
