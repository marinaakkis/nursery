# k8s-ns (ns-chart) Values Reference

Namespace provisioning chart from `https://charts.k8s.biocad.ru/`. Installs RBAC, quotas, limits, and optional network isolation into an existing namespace.

Chart metadata: `apiVersion: v2`, `name: k8s-ns`, `version: 1.2.2`. No dependencies.

## Table of Contents

- [Resource Quota](#resource-quota)
- [Limit Range](#limit-range)
- [RBAC](#rbac)
- [Network Policy](#network-policy)
- [Ceph Storage](#ceph-storage)
- [Generated Resources](#generated-resources)

## Resource Quota

Always created as `ResourceQuota` named `compute-resources`. The `resourceQuota` value maps directly to `spec`:

```yaml
resourceQuota:
  hard:
    limits.cpu: "8"
    limits.memory: 2Gi
    limits.ephemeral-storage: 8Gi
    persistentvolumeclaims: "10"
    pods: "10"
    requests.cpu: "2"
    requests.memory: 2Gi
    requests.storage: 10G
    requests.ephemeral-storage: 200Mi
```

Real-world examples range from small dev (`limits.cpu: "4"`, `pods: "5"`) to medium (`limits.cpu: "16"`, `pods: "10"`, `requests.storage: 50Gi`).

## Limit Range

Always created as `LimitRange` named `default-limits`. The `limitRange` value is a list under `spec.limits`:

```yaml
limitRange:
  - default:
      cpu: "1"
      memory: 1Gi
    defaultRequest:
      cpu: 100m
      memory: 128Mi
    type: Container
```

Platform engineers commonly adjust defaults per environment:
- **Dev/test:** `default.cpu: 200m-750m`, `default.memory: 512Mi-1Gi`
- **Prod:** `default.cpu: 1`, `default.memory: 1Gi`

## RBAC

### Admins

Users with full namespace access. Always creates `Role` named `admin` with `apiGroups: ["*"]`, `resources: ["*"]`, `verbs: ["*"]`. `RoleBinding` named `admins` binds listed users.

```yaml
admins:
  - admin-username
```

### Developers

Users with scoped namespace access. Creates `Role` named `developer` (when `rbac.developer.create: true`) with a comprehensive rule set covering apps, core, batch, networking, Helm secrets, SealedSecrets, and more. `RoleBinding` named `developers` binds listed users.

```yaml
developers:
  - developer-username
```

### RBAC Prefix

Prepended to each User subject name:

```yaml
rbacPrefix: "oidc:"    # produces subjects like "oidc:developer-username"
```

### CI Deploy

ServiceAccount `ci-deploy` with long-lived token Secret `ci-deploy-sa-token` is **always created** regardless of `rbac.ci_deploy.create`.

When `rbac.ci_deploy.create: true` (default), also creates `Role` named `ci-deploy` and `RoleBinding` named `ci-deploy-binding`:

```yaml
rbac:
  ci_deploy:
    create: true
    accessRights:
      - apiGroups: ["apps"]
        resources: ["deployments", "statefulsets", "daemonsets"]
        verbs: ["*"]
      - apiGroups: [""]
        resources: ["configmaps", "secrets", "services", "pods", "serviceaccounts"]
        verbs: ["*"]
      - apiGroups: ["batch"]
        resources: ["jobs", "cronjobs"]
        verbs: ["*"]
      - apiGroups: ["networking.k8s.io"]
        resources: ["ingresses", "networkpolicies"]
        verbs: ["*"]
      - apiGroups: ["policy"]
        resources: ["poddisruptionbudgets"]
        verbs: ["*"]
      - apiGroups: ["autoscaling"]
        resources: ["horizontalpodautoscalers"]
        verbs: ["*"]
      # ... additional rules for kafka.strimzi.io kafkatopics etc.
```

### Developer Role

```yaml
rbac:
  developer:
    create: true
    accessRights:
      # Broad access to most namespace resources
      - apiGroups: ["", "apps", "batch", "networking.k8s.io", ...]
        resources: ["*"]
        verbs: ["*"]
      # Helm secrets
      - apiGroups: [""]
        resources: ["secrets"]
        resourceNames: ["sh.helm.*"]
        verbs: ["get", "list"]
      # SealedSecrets
      - apiGroups: ["bitnami.com"]
        resources: ["sealedsecrets"]
        verbs: ["*"]
      # Read-only for namespace, quota, ingress
      - apiGroups: [""]
        resources: ["namespaces", "resourcequotas"]
        verbs: ["get", "list"]
      # PSP
      - apiGroups: ["policy"]
        resources: ["podsecuritypolicies"]
        resourceNames: ["developers"]
        verbs: ["use"]
```

## Network Policy

Disabled by default. When enabled, creates **two** NetworkPolicy resources:

```yaml
networkPolicy:
  enabled: false
```

1. **`deny-from-other-ns`** — denies ingress from pods in other namespaces; allows same-namespace traffic
2. **`allow-all-for-external-label`** — pods with label `networkPolicy: external` accept all ingress (used for Ingress controller targets)

## Ceph Storage

Optional Ceph RBD secret for PVC access:

```yaml
ceph:
  enabled: false
  name: "ceph-secret-example"
  data: {}    # base64-encoded key-value pairs
```

## Generated Resources

| Template | Condition | Resource |
|---|---|---|
| `resourcequota.yml` | always | ResourceQuota `compute-resources` |
| `limitranges.yml` | always | LimitRange `default-limits` |
| `admin-role.yml` | always | Role `admin` (full namespace access) |
| `admins-rolebinding.yml` | always | RoleBinding `admins` → Role `admin` |
| `developer-role.yml` | `rbac.developer.create` | Role `developer` |
| `developers-rolebinding.yml` | always | RoleBinding `developers` → Role `developer` |
| `ci-deploy-sa.yaml` | always | ServiceAccount `ci-deploy` + Secret `ci-deploy-sa-token` |
| `ci-deploy-role.yml` | `rbac.ci_deploy.create` | Role `ci-deploy` |
| `ci-deploy-rolebinding.yml` | `rbac.ci_deploy.create` | RoleBinding `ci-deploy-binding` |
| `networkpolicy.yml` | `networkPolicy.enabled` | 2x NetworkPolicy |
| `ceph.yml` | `ceph.enabled` | Secret (type `kubernetes.io/rbd`) |

The chart does **not** create the Namespace itself — use `CreateNamespace=true` in Argo CD syncOptions or `helm install -n ... --create-namespace`.
