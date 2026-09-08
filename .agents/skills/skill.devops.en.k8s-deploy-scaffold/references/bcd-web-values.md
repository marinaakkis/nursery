# bcd-web Chart Values Reference

Complete list of values supported by `bcd-web` from `https://charts.k8s.biocad.ru/`.

Chart metadata: `apiVersion: v2`, `name: bcd-web`, `type: application`, `appVersion: "no"`. No dependencies.

## Table of Contents

- [Common](#common)
- [Autoscaling](#autoscaling)
- [Pod](#pod)
- [Containers](#containers)
- [Init Containers](#init-containers)
- [ConfigMaps and Secrets](#configmaps-and-secrets)
- [Volumes and Persistence](#volumes-and-persistence)
- [Service](#service)
- [Ingress](#ingress)
- [NetworkPolicy](#networkpolicy)
- [PodDisruptionBudget](#poddisruptionbudget)
- [Metrics](#metrics)
- [Scheduling](#scheduling)
- [Extra Objects](#extra-objects)
- [Generated Resources](#generated-resources)
- [Helpers](#helpers)

## Common

| Key | Default | Description |
|---|---|---|
| `fullnameOverride` | `""` | Override all resource names |
| `nameOverride` | `""` | Override chart name portion |
| `labels` | `{}` | Extra labels on all resources |
| `annotations` | `{}` | Extra annotations on Deployment metadata |
| `replicaCount` | `1` | Replicas (ignored if autoscaling enabled) |
| `updateStrategy` | `{}` | Deployment strategy (e.g. `type: Recreate`) |

## Autoscaling

| Key | Default |
|---|---|
| `autoscaling.enabled` | `false` |
| `autoscaling.minReplicas` | `1` |
| `autoscaling.maxReplicas` | `3` |
| `autoscaling.targetCPUUtilizationPercentage` | `80` |
| `autoscaling.targetMemoryUtilizationPercentage` | *(optional, uncomment to set)* |

When `autoscaling.enabled` is `true`, `replicaCount` is omitted from the Deployment spec and an HPA is created. At least one of CPU or memory utilization must be set for a valid HPA.

## Pod

| Key | Default | Notes |
|---|---|---|
| `imagePullSecrets` | `[{name: regcred}]` | |
| `serviceAccount.create` | `false` | |
| `serviceAccount.name` | `""` | Falls back to `"default"` if not creating |
| `serviceAccount.annotations` | `{}` | |
| `serviceAccount.imagePullSecrets` | *(not in values.yaml but supported)* | Sets imagePullSecrets on ServiceAccount |
| `podAnnotations` | `{}` | |
| `podSecurityContext.fsGroup` | `1000` | **REQUIRED** |
| `podSecurityContext.supplementalGroups` | *(optional)* | |
| `podSecurityContext.supplementalGroupsPolicy` | *(optional)* | |
| `podSecurityContext.fsGroupChangePolicy` | *(optional)* | |
| `podSecurityContext.seccompProfile` | *(optional)* | |

Host namespace flags (`hostUsers`, `hostPID`, `hostNetwork`, `hostIPC`) are optional — only emitted if the key exists (`hasKey` check in template).

## Containers

Containers are defined as a **map** (name -> spec). Each container supports:

```yaml
containers:
  app:
    image:
      repository: registry.example.com
      suffix: "myapp"           # optional: repository/suffix:tag
      tag: "1.0.0"              # default: "no-tag" if missing
      pullPolicy: IfNotPresent
    ports:
      - containerPort: 8080
        name: http
        protocol: TCP
    command: []
    args: []
    securityContext:
      runAsUser: 1000           # REQUIRED
      runAsGroup: 1000          # REQUIRED
      readOnlyRootFilesystem: true  # default true (template)
    envFromConfigMaps: []       # list of ConfigMap names
    envFromSecrets: []          # list of Secret names
    startupProbe:
      enabled: false
      probe: {}
    livenessProbe:
      enabled: true
      probe:
        httpGet:
          path: /healthz
          port: http
        failureThreshold: 3
        initialDelaySeconds: 30
        periodSeconds: 10
        timeoutSeconds: 5
    readinessProbe:
      enabled: true
      probe:
        httpGet:
          path: /ready
          port: http
        failureThreshold: 3
        initialDelaySeconds: 5
        periodSeconds: 5
        timeoutSeconds: 1
    resources:
      requests:
        cpu: 200m
        memory: 256Mi
      limits:
        cpu: 1000m
        memory: 1Gi
    volumeMounts: []
```

### Hardcoded Security Defaults (per container)

The deployment template **hardcodes** these regardless of values:
- `allowPrivilegeEscalation: false`
- `capabilities.drop: [ALL]`
- `runAsNonRoot: true` (default, overridable)
- `privileged: false` (default, overridable)

`runAsUser` and `runAsGroup` are **required** per container — the template renders them from `securityContext`.

### Image Resolution

`repository` + optional `suffix` → `repository/suffix:tag` or `repository:tag`. Default tag is **`no-tag`** if missing.

## Init Containers

Same structure as containers (map: name -> spec):

```yaml
initContainers:
  migrate:
    image: { repository, suffix, tag, pullPolicy }
    command: []
    args: []
    securityContext: { runAsUser, runAsGroup, ... }
    envFromConfigMaps: []
    envFromSecrets: []
    resources: {}
    volumeMounts: []
```

## ConfigMaps and Secrets

```yaml
configmaps_create:
  my-config:
    KEY: "value"
    nested-key:               # nested map values produce nested YAML structure
      sub-key: "value"

secrets_create:
  my-secret:
    SECRET_KEY: "value"       # base64-encoded in template
```

ConfigMap values: flat strings are quoted or literal block for multiline. Nested maps produce nested YAML.

Secret values: string values are base64-encoded; multiline strings encoded as a block.

## Volumes and Persistence

```yaml
volumes:
  - name: data
    persistentVolumeClaim:
      claimName: my-pvc

persistence:
  my-pvc:
    accessMode: ReadWriteOnce
    size: 10Gi
    # storageClass: "standard"   # optional, rendered via tplvalues
    # selector: {}               # optional, rendered via tplvalues
```

## Service

Services are defined as a **map** (name -> spec). Each entry creates a separate Service resource. The map **key** becomes the Service name.

```yaml
service:
  my-svc:
    type: ClusterIP             # default if omitted
    # clusterIP: None           # headless
    # sessionAffinity: ClientIP
    # loadBalancerIP: "10.0.0.1"
    annotations: {}
    ports:
      - name: http
        port: 80
        targetPort: 8080
        protocol: TCP
```

## Ingress

Single Ingress resource; name = fullname.

```yaml
ingress:
  enabled: false
  className: "nginx"
  pathType: Prefix
  annotations: []
  hosts:
    - host: app.example.com
      paths:
        - path: /
          serviceName: my-svc      # references Service name from service map
          servicePort: 80
  tls:
    - secretName: app-tls
      hosts: [app.example.com]
```

## NetworkPolicy

Read [the shared `bcd-web` profile in network-policy-contract.md](network-policy-contract.md#profile-shared-bcd-web) before generating this section. The example below is only valid after replacing every selector with labels observed in the target-cluster inventory.

```yaml
networkPolicy:
  enabled: false
  policyTypes:                    # MUST be supplied when enabled
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: <target-namespace> # REVIEW: inventory
          podSelector:
            matchLabels:
              app.kubernetes.io/instance: <caller-release> # REVIEW: inventory
              app.kubernetes.io/name: bcd-web
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: <target-namespace> # REVIEW: inventory
          podSelector:
            matchLabels:
              app.kubernetes.io/instance: <dependency-release> # REVIEW: inventory
              app.kubernetes.io/name: bcd-web
      ports:
        - protocol: TCP
          port: 8080
```

`policyTypes` must be explicitly provided when enabling — the template renders it directly from values. Never replace a selector with `ipBlock: 10.0.0.0/8`; external egress needs an approved narrow CIDR or a documented egress-gateway selector.

## PodDisruptionBudget

```yaml
podDisruptionBudget:
  enabled: false
  # minAvailable: 1
  # maxUnavailable: 1
```

## Metrics

```yaml
metrics:
  enabled: false
  serviceMonitor:
    labels: {}
    endpoints: []               # MUST define when enabled for valid ServiceMonitor
```

Requires Prometheus Operator CRDs installed in the cluster. Selects pods with same selector labels as the Deployment.

## Scheduling

```yaml
nodeSelector: {}

tolerations: []

affinity: {}
```

Example anti-affinity (spread pods across nodes):

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
            - key: app.kubernetes.io/name
              operator: In
              values: [bcd-web]
        topologyKey: kubernetes.io/hostname
```

## Extra Objects

Escape hatch for arbitrary Kubernetes manifests. Each item is `tpl`'d with the root context `$`, so template expressions work:

```yaml
extraObjects: []
  # - apiVersion: v1
  #   kind: ConfigMap
  #   metadata:
  #     name: extra-config
  #   data:
  #     key: value
```

## Generated Resources

| Template | Condition | Kubernetes Resource |
|---|---|---|
| `deployment.yaml` | always | Deployment (name = `chart.fullname`) |
| `service.yaml` | per entry in `service` map | Service (name = map key) |
| `serviceaccount.yaml` | `serviceAccount.create` | ServiceAccount |
| `configmap.yaml` | per entry in `configmaps_create` | ConfigMap |
| `secret.yaml` | per entry in `secrets_create` | Secret (type Opaque) |
| `pvc.yaml` | per entry in `persistence` | PersistentVolumeClaim |
| `ingress.yaml` | `ingress.enabled` | Ingress |
| `hpa.yaml` | `autoscaling.enabled` | HorizontalPodAutoscaler |
| `networkpolicy.yaml` | `networkPolicy.enabled` | NetworkPolicy |
| `poddisruptionbudget.yaml` | `podDisruptionBudget.enabled` | PodDisruptionBudget |
| `servicemonitor.yaml` | `metrics.enabled` | ServiceMonitor |
| `extra-manifests.yaml` | per entry in `extraObjects` | Arbitrary (tpl'd) |

## Helpers

### `_helpers.tpl`

| Template | Purpose |
|---|---|
| `chart.name` | Chart name, truncated to 63 chars; respects `nameOverride` |
| `chart.fullname` | Release-aware full name; uses `fullnameOverride` or `Release.Name-chartName` |
| `chart.chart` | `chartName-chartVersion` for `helm.sh/chart` label |
| `chart.labels` | Full label set: `helm.sh/chart`, selector labels, `app.kubernetes.io/version`, user `labels`, `managed-by` |
| `chart.annotations` | Renders `.Values.annotations` via `tplvalues.render` |
| `chart.selectorLabels` | `app.kubernetes.io/name` + `app.kubernetes.io/instance` |
| `chart.serviceAccountName` | If creating: fullname; else: `serviceAccount.name` or `"default"` |

### `_tplvalues.tpl`

| Template | Purpose |
|---|---|
| `helpers.tplvalues.render` | If value is string: `tpl` it. If object: `toYaml` then `tpl`. Enables template expressions inside values. |

Used for: labels, annotations, service ports, persistence size/storageClass/selector, network policy sections, init/main container command/args.
