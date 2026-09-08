# Argo CD Infrastructure Patterns Reference

Use this reference when generating Argo CD Application manifests. These patterns are **cluster-agnostic** — the same structure, projects, and conventions apply to every `argocd-infra-*` repository regardless of which Kubernetes cluster it targets.

## Table of Contents

- [Multi-Cluster Model](#multi-cluster-model)
- [Repository Architecture](#repository-architecture)
- [App-of-Apps Pattern](#app-of-apps-pattern)
- [Namespace Application](#namespace-application)
- [Infrastructure Components](#infrastructure-components)
- [External Secrets (ESO)](#external-secrets-eso)
- [Ingress Manifests](#ingress-manifests)
- [Sync Policies and Ordering](#sync-policies-and-ordering)
- [Environment Folder Checklist](#environment-folder-checklist)

## Multi-Cluster Model

Each Kubernetes cluster has its own dedicated argocd-infra repository:

```
argocd-infra-dev    → dev cluster
argocd-infra-prod   → prod cluster
argocd-infra-dr     → disaster recovery cluster
argocd-infra-stage  → staging cluster
...
```

All repositories share the **identical directory structure** — the same Argo CD projects (`dis`, `dcm`, `dir`, `dib`, `dot`, `cluster`), the same app-of-apps pattern, the same file naming conventions. The only differences between repositories are:

- Helm values (resource sizes, replica counts, persistence settings)
- Ingress hosts (cluster-specific 3rd-level domains under `*.biocad.dev`)
- Vault paths in ExternalSecrets (cluster name prefix differs)
- Chart versions may vary during rollout across clusters

When generating Argo CD recommendations, do not hardcode a specific cluster name. Use `# REVIEW: target argocd-infra repository for your cluster` so the user places files in the correct repository.

## Repository Architecture

```
argocd-infra-{cluster}/                  # REVIEW: one repo per cluster
├── cluster/                             # platform-level (argocd, monitoring, ingress, etc.)
│   └── argocd/
│       ├── argocd-apps-app.yaml         # app-of-apps + AppProject definitions
│       └── argocd-hr.yaml               # argocd server
├── dis/{project}-{env}/                 # REVIEW: argo-project depends on team
├── dcm/{project}-{env}/
├── dir/{project}-{env}/
├── dib/{project}-{env}/
└── dot/{project}-{env}/
```

Top-level directories correspond to **Argo CD projects** (organizational units). Each is synced **recursively** by a parent Application — every YAML file placed inside is automatically applied to the cluster.

### Argo CD Projects

| Project | Scope |
|---|---|
| `cluster` | Platform infrastructure (monitoring, ingress, storage, security) |
| `dis` | Product team environments |
| `dcm` | DCM team environments |
| `dir` | Internal tools and shared services |
| `dib` | DIB team environments |
| `dot` | DOT team environments |

The project list is identical across all cluster repositories. All projects share permissive settings: `sourceRepos: ['*']`, `destinations: namespace '*'`, `clusterResourceWhitelist: '*/*'`, `orphanedResources.warn: true`.

The skill cannot determine which project a repository belongs to — mark with `# REVIEW: set correct Argo CD project (dis/dcm/dir/dib/dot)`.

## App-of-Apps Pattern

The hub is `cluster/argocd/argocd-apps-app.yaml` — an `Application` that installs the `argocd-apps` Helm chart, which defines:

1. **Child Applications** — one per top-level directory, each with `directory.recurse: true`
2. **AppProjects** — one per organizational unit

Child Applications use `prune: false, selfHeal: false` — the umbrella tracks but does not auto-prune leaf manifests. Leaf Applications within each folder define their own sync policies (typically `prune: true, selfHeal: true`).

## Namespace Application

Every environment folder starts with a namespace Application using the `k8s-ns` chart.

### Naming

- **Application name:** `{argo-project}-{project}-{env}` (e.g. `dis-parcur-dev`)
- **Destination namespace:** same as application name
- **File name:** `ns-hr.yaml` (or `ns-app.yaml`)

### Template

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {argo-project}-{project}-{env}       # REVIEW: argo-project (dis/dcm/dir/dib/dot), project name, env
  namespace: argocd
spec:
  project: {argo-project}                     # REVIEW: set correct Argo CD project
  source:
    chart: k8s-ns
    repoURL: "https://charts.k8s.biocad.ru/"
    targetRevision: ~1.2.2
    helm:
      values: |
        rbacPrefix: "oidc:"
        developers:
          - {username}                        # REVIEW: developer usernames for RBAC
        networkPolicy:
          enabled: false
        limitRange:
          - default:
              cpu: 750m
              memory: 1Gi
            defaultRequest:
              cpu: 500m
              memory: 512Mi
            type: Container
        resourceQuota:
          hard:
            limits.cpu: "16"                  # REVIEW: adjust to team resource budget
            limits.memory: 24Gi               # REVIEW: adjust to team resource budget
            persistentvolumeclaims: "5"
            pods: "10"                        # REVIEW: expected pod count
            requests.cpu: "10"
            requests.memory: 16Gi
            requests.storage: 50Gi
  destination:
    server: https://kubernetes.default.svc
    namespace: {argo-project}-{project}-{env} # REVIEW: must match metadata.name
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Resource Quota Sizing Guide

| Profile | limits.cpu | limits.memory | pods | requests.storage |
|---|---|---|---|---|
| Small (dev/test) | "4" | 8Gi | "5" | 10Gi |
| Medium | "10"-"16" | 16Gi-24Gi | "10" | 50Gi |
| Large (prod) | "32"+ | 64Gi+ | "20"+ | 100Gi+ |

## Infrastructure Components

All components follow the same Application structure with `sync-wave: "1"` to deploy after the namespace.

### PostgreSQL

Создавай Argo CD Application только для PostgreSQL как отдельного stateful-компонента.
Обычное приложение разворачивает собственный GitLab CI, поэтому `source.repoURL`,
`targetRevision` и `path` не должны указывать на репозиторий приложения.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: postgres                              # REVIEW: согласовать имя в namespace
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  project: {argo-project}                     # REVIEW: Argo CD project
  source:
    chart: postgres
    repoURL: "docker.biocad.ru/cloudpirates"
    targetRevision: 0.19.3
    helm:
      values: |
        fullnameOverride: "postgres"
        replicaCount: 1
        image:
          registry: docker.biocad.ru
          repository: postgres
          tag: "18.3@sha256:78481659c47e862334611ccdaf7c369c986b3046da9857112f3b309114a65fb4"
          imagePullPolicy: IfNotPresent
        auth:
          existingSecret: postgres-passwords
          secretKeys:
            adminPasswordKey: POSTGRES_PASSWORD
        initdb:
          scriptsConfigMap: "postgres-initdb"
        extraEnvVarsSecret: "postgres-passwords"
        service:
          type: ClusterIP
          port: 5432
        persistence:
          enabled: true
          accessModes:
            - ReadWriteOnce
          size: 10Gi
        resources:
          limits:
            memory: 1Gi
            cpu: 200m
          requests:
            memory: 256Mi
            cpu: 10m
  destination:
    server: https://kubernetes.default.svc
    namespace: {argo-project}-{project}-{env} # REVIEW: namespace
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Эта Application всегда используется вместе с `ExternalSecret` `postgres-passwords`.
Не заменяй chart/repository на Bitnami и не записывай пароль в `helm.values`.

### Redis

Создавай Argo CD Application для Redis только как отдельного stateful-компонента.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: redis                                 # REVIEW: согласовать имя в namespace
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  project: {argo-project}                     # REVIEW: Argo CD project
  source:
    chart: redis
    repoURL: "docker.biocad.ru/cloudpirates"
    targetRevision: 0.28.0
    helm:
      values: |
        architecture: standalone

        image:
          registry: docker.biocad.ru
          repository: redis
          tag: "8.6.3"
          pullPolicy: IfNotPresent

        auth:
          enabled: true
          sentinel: true
          existingSecret: "redis-secret"
          existingSecretPasswordKey: "redis-password"

        tls:
          enabled: false

        persistence:
          enabled: true
          size: 2Gi
          accessMode: ReadWriteOnce

        persistentVolumeClaimRetentionPolicy:
          enabled: true
          whenScaled: Retain
          whenDeleted: Retain

        resources:
          requests:
            cpu: 50m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi

        config:
          content: |
            # Конфигурация Redis
            bind * -::*

            maxmemory 400mb
            maxmemory-policy volatile-lru
            appendonly yes
            save 900 1
            save 300 10
            save 60 10000

        service:
          type: ClusterIP
          port: 6379
  destination:
    server: https://kubernetes.default.svc
    namespace: {argo-project}-{project}-{env} # REVIEW: namespace
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Эта Application всегда используется вместе с `ExternalSecret` `redis-secret`.

### Chart Reference Table

| Component | Chart | repoURL | Typical targetRevision |
|---|---|---|---|
| PostgreSQL | `postgres` | `docker.biocad.ru/cloudpirates` | `0.19.3` |
| Redis | `redis` | `docker.biocad.ru/cloudpirates` | `0.28.0` |

Для других инфраструктурных компонентов не выбирай chart по аналогии. Сначала
подтверди у платформенной команды допустимый chart, repository и модель секретов.

## External Secrets (ESO)

Secrets are managed via **External Secrets Operator** (ESO) with HashiCorp Vault as the backend. ExternalSecret manifests are placed alongside Application manifests in the environment folder — the recursive directory sync picks them up automatically.

All clusters use a shared `ClusterSecretStore` named `vault-css` that connects to Vault.

### Vault Path Convention

```
{cluster}/{argo-project}/{namespace}/{secret-name}
```

Examples:
- `k8s-prod/dir/dir-voiceai-prod/regcred`
- `k8s-dev/dis/dis-parcur-dev/postgres-secret`

The `{cluster}` prefix matches the target cluster name (`k8s-prod`, `k8s-dev`, etc.). Mark with `# REVIEW:` — the skill cannot determine which cluster the deployment targets.

### Registry Credentials (regcred)

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: {project}-regcred-es
  namespace: {argo-project}-{project}-{env}          # REVIEW: namespace
spec:
  refreshInterval: 1m
  secretStoreRef:
    name: vault-css
    kind: ClusterSecretStore
  target:
    name: regcred
    template:
      type: kubernetes.io/dockerconfigjson
  dataFrom:
    - extract:
        key: {cluster}/{argo-project}/{argo-project}-{project}-{env}/regcred  # REVIEW: cluster prefix and full path
```

### PostgreSQL credentials

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: postgres-passwords
  namespace: {argo-project}-{project}-{env}          # REVIEW: namespace
spec:
  refreshInterval: 1m
  secretStoreRef:
    name: vault-css
    kind: ClusterSecretStore
  target:
    name: postgres-passwords
  dataFrom:
    - extract:
        key: {cluster}/{project}/{namespace}/postgres-passwords  # REVIEW: cluster, project and namespace
```

`target.name` обязан совпадать с `auth.existingSecret` и `extraEnvVarsSecret` в
PostgreSQL Application.

### Redis credentials

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: redis-secret
  namespace: {argo-project}-{project}-{env}          # REVIEW: namespace
spec:
  refreshInterval: 1m
  secretStoreRef:
    name: vault-css
    kind: ClusterSecretStore
  target:
    name: redis-secret
  dataFrom:
    - extract:
        key: {cluster}/{project}/{namespace}/redis-secret  # REVIEW: cluster, project and namespace
```

### Generic ExternalSecret Pattern

For any secret needed in the namespace:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: {secret-name}-es
  namespace: {argo-project}-{project}-{env}          # REVIEW: namespace
spec:
  refreshInterval: 1m0s
  secretStoreRef:
    name: vault-css
    kind: ClusterSecretStore
  target:
    name: {secret-name}                              # K8s Secret name the workload expects
  dataFrom:
    - extract:
        key: {cluster}/{argo-project}/{namespace}/{secret-name}  # REVIEW: full Vault path
```

Use `target.template.type` only when a specific Secret type is required (e.g. `kubernetes.io/dockerconfigjson` for regcred). For generic Opaque secrets, omit `template`.

### Vault Secret Setup

After generating ExternalSecret manifests, remind the user to create the corresponding entries in Vault at the expected paths. The Vault data should contain key-value pairs matching what the application expects (e.g. `password`, `postgres-password` for PostgreSQL).

## Ingress Manifests

Placed as raw Kubernetes YAML (not Argo CD Applications) in the environment folder.

### Host Naming

All new hosts use **3rd-level domains** under `biocad.dev`:

```
{project}.biocad.dev
```

Not 4th-level (`{project}.kube-{env}.biocad.dev`). The 3rd-level format is the current standard.

### TLS

TLS is provided by a **purchased wildcard certificate** for `*.biocad.dev`, stored as a Kubernetes Secret (typically replicated across namespaces). Do not use `cert-manager.io/cluster-issuer` annotations — the wildcard cert covers all 3rd-level hosts.

### Template

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {project}
  namespace: {argo-project}-{project}-{env}   # REVIEW: namespace
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/whitelist-source-range: "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16" # REVIEW: CIDRs per cluster
    nginx.ingress.kubernetes.io/proxy-body-size: 25m
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/custom-http-errors: "503"
    argocd.argoproj.io/sync-wave: "1"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - {project}.biocad.dev                # REVIEW: 3rd-level domain under biocad.dev
      secretName: biocad-dev-wildcard-tls     # REVIEW: name of wildcard cert Secret in namespace
  rules:
    - host: {project}.biocad.dev              # REVIEW: must match tls[].hosts
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {service-name}
                port:
                  number: {port}
```

The wildcard TLS Secret name may vary per cluster — mark with `# REVIEW:`. If the Secret is not present in the namespace, it may need to be replicated (e.g. via kubernetes-replicator or an ExternalSecret from Vault).

### Embedded Services

Services deployed into an existing shared namespace may be exposed through an existing shared
host, for example `https://{shared-host}/{service}`. In this case:

- do not create a separate application Ingress;
- do not add a PowerDNS record;
- document the path rule that must be added to the existing shared Ingress;
- keep same-origin API routing behind the existing gateway/BFF when applicable.

## Sync Policies and Ordering

### Sync-Wave Strategy

| Wave | Resources |
|---|---|
| `0` (default) | Namespace Application (`ns-hr.yaml`) |
| `1` | Infrastructure components (postgres, redis, ingress, etc.) |

### Standard Sync Policy (leaf Applications)

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
    - CreateNamespace=true    # only on namespace Application
```

### Parent/Child Sync Policy

Parent (app-of-apps) child Applications use `prune: false, selfHeal: false` to avoid cascading deletes when files are temporarily removed from git.

## Environment Folder Checklist

Minimal set of files for a new environment. Create in the correct argocd-infra repository for the target cluster:

```
{argo-project}/{project}-{env}/
├── ns-hr.yaml                          # namespace (k8s-ns chart) — REQUIRED
├── regcred-es.yaml                     # ExternalSecret for registry credentials — REQUIRED for private images
├── ingress.yaml                        # ingress manifest — if external access needed
├── postgres.yaml (or pg-hr.yaml)       # PostgreSQL Application — if database needed
├── postgres-secret-es.yaml             # ExternalSecret for postgres credentials
├── redis.yaml (or redis-hr.yaml)       # Redis Application — if cache needed
└── ... additional components
```

For multi-cluster deployments, create the same folder structure in each argocd-infra repository, adjusting:
- Vault paths in ExternalSecrets (cluster prefix differs: `k8s-prod/...` vs `k8s-dev/...`)
- Resource sizes (prod typically larger than dev)
- Ingress hosts (3rd-level `*.biocad.dev` domains, choose appropriate name)
- Non-default `storageClass`, только если его явно требует пользователь или target inventory; обычно PVC использует класс кластера по умолчанию
- Wildcard TLS Secret name (may vary per cluster)

Commit to the appropriate `{argo-project}/` directory. The recursive directory sync handles the rest.
