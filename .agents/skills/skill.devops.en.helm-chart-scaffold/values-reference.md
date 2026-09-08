# values.yaml Reference

Canonical `values.yaml` structure following Bitnami conventions. All keys use camelCase. Sections are ordered by convention.

Adapt this template to your application: remove unused sections, fill in application-specific defaults (ports, paths, image coordinates).

---

```yaml
## Global parameters
## Shared across all sub-charts when using dependencies
global:
  ## Override the image registry for all images
  imageRegistry: ""
  ## Global image pull secrets
  imagePullSecrets: []
  ## Global default StorageClass
  storageClass: ""

## Chart name overrides
nameOverride: ""
fullnameOverride: ""

## ──────────────────────────────────────────────
## Container image
## ──────────────────────────────────────────────
image:
  registry: docker.io
  repository: ORGANIZATION/APPLICATION
  ## Overrides the image tag (default is .Chart.AppVersion)
  tag: ""
  ## Use digest to pin an exact image (takes precedence over tag)
  digest: ""
  pullPolicy: IfNotPresent
  ## Image pull secrets (merged with global.imagePullSecrets)
  pullSecrets: []

## ──────────────────────────────────────────────
## Workload
## ──────────────────────────────────────────────
replicaCount: 1

## Deployment revision history
revisionHistoryLimit: 10

## Deployment update strategy
updateStrategy:
  type: RollingUpdate
  # rollingUpdate:
  #   maxSurge: 25%
  #   maxUnavailable: 25%

## Override default container command / args
command: []
args: []

## Named container ports (used in service, probes, network policy)
containerPorts:
  http: 8080

## ──────────────────────────────────────────────
## Security context
## ──────────────────────────────────────────────

## Pod-level security context
podSecurityContext:
  enabled: true
  fsGroup: 1001

## Container-level security context
containerSecurityContext:
  enabled: true
  runAsUser: 1001
  runAsGroup: 1001
  runAsNonRoot: true
  ## Set false or mount writable emptyDir volumes when the runtime needs temp files,
  ## DataProtection storage, generated exports, nginx cache, or runtime env substitution.
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL

## ──────────────────────────────────────────────
## Resources
## ──────────────────────────────────────────────
## Set explicit resource requests and limits.
## Example:
##   limits:
##     cpu: 500m
##     memory: 512Mi
##   requests:
##     cpu: 100m
##     memory: 128Mi
resources: {}

## ──────────────────────────────────────────────
## Probes
## ──────────────────────────────────────────────
## Each probe has an .enabled toggle and default parameters.
## Set custom*Probe to override with arbitrary probe spec.

livenessProbe:
  enabled: true
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 3

readinessProbe:
  enabled: true
  httpGet:
    path: /readyz
    port: http
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 3

startupProbe:
  enabled: false
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: 0
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 30

## Custom probes (override defaults entirely when set)
customLivenessProbe: {}
customReadinessProbe: {}
customStartupProbe: {}

## ──────────────────────────────────────────────
## Lifecycle hooks
## ──────────────────────────────────────────────
lifecycleHooks: {}
# preStop:
#   exec:
#     command: ["/bin/sh", "-c", "sleep 15"]

## ──────────────────────────────────────────────
## Service
## ──────────────────────────────────────────────
service:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
      # nodePort: ""         # Only for NodePort / LoadBalancer
  ## Additional ports
  extraPorts: []
  ## Annotations specific to the service
  annotations: {}
  ## Fixed ClusterIP (only when type=ClusterIP)
  clusterIP: ""
  ## LoadBalancer settings
  loadBalancerIP: ""
  loadBalancerSourceRanges: []
  externalTrafficPolicy: Cluster
  ## Session affinity
  sessionAffinity: ""
  sessionAffinityConfig: {}

## ──────────────────────────────────────────────
## Ingress
## ──────────────────────────────────────────────
ingress:
  enabled: false
  ## IngressClass name
  ingressClassName: ""
  ## Hostname
  hostname: ""
  ## Path and path type
  path: /
  pathType: Prefix
  ## Backend service port name
  servicePort: http
  ## Annotations (e.g. cert-manager, rewrite rules)
  annotations: {}
  ## Enable TLS for the primary hostname
  tls: false
  ## Self-signed TLS (generate a self-signed cert)
  selfSigned: false
  ## Extra hosts
  extraHosts: []
  # - name: extra.example.com
  #   path: /
  #   pathType: Prefix
  ## Extra TLS entries
  extraTls: []
  # - hosts:
  #     - extra.example.com
  #   secretName: extra-tls
  ## Extra ingress rules (raw YAML)
  extraRules: []

## ──────────────────────────────────────────────
## Persistence
## ──────────────────────────────────────────────
persistence:
  enabled: false
  ## StorageClass ("-" for emptyDir equivalent, "" for default)
  storageClass: ""
  accessModes:
    - ReadWriteOnce
  size: 8Gi
  ## Mount path inside the container
  mountPath: /data
  ## Use an existing PVC instead of creating one
  existingClaim: ""
  ## PVC annotations
  annotations: {}

## ──────────────────────────────────────────────
## Service account
## ──────────────────────────────────────────────
serviceAccount:
  create: true
  ## Name override (defaults to fullname)
  name: ""
  annotations: {}
  automountServiceAccountToken: false

## ──────────────────────────────────────────────
## RBAC
## ──────────────────────────────────────────────
rbac:
  create: false
  rules: []
  # - apiGroups: [""]
  #   resources: ["pods"]
  #   verbs: ["get", "list", "watch"]

## ──────────────────────────────────────────────
## Network policy
## ──────────────────────────────────────────────
networkPolicy:
  enabled: false
  ## Explicit default-deny allowlists. Every peer needs namespaceSelector + podSelector.
  ingress: []
  egress: []

## ──────────────────────────────────────────────
## Autoscaling (HPA)
## ──────────────────────────────────────────────
autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 11
  ## Target CPU utilization percentage
  targetCPU: 80
  ## Target memory utilization percentage (leave empty to disable)
  targetMemory: ""

## ──────────────────────────────────────────────
## Pod disruption budget
## ──────────────────────────────────────────────
pdb:
  create: false
  ## Use minAvailable OR maxUnavailable (not both)
  minAvailable: ""
  maxUnavailable: 1

## ──────────────────────────────────────────────
## Scheduling
## ──────────────────────────────────────────────

## Direct affinity override (takes precedence over presets below)
affinity: {}

## Node selector
nodeSelector: {}

## Tolerations
tolerations: []

## Topology spread constraints
topologySpreadConstraints: []

## Affinity presets (ignored when .affinity is set)
## Values: "", "soft", "hard"
podAffinityPreset: ""
podAntiAffinityPreset: soft
nodeAffinityPreset:
  type: ""    # "soft" or "hard"
  key: ""     # node label key
  values: []  # node label values

## ──────────────────────────────────────────────
## ConfigMap (non-secret app configuration)
## ──────────────────────────────────────────────
## Set to a map to create a ConfigMap from values.
## Example:
##   configMap:
##     APP_ENV: production
##     LOG_LEVEL: info
configMap: {}

## ──────────────────────────────────────────────
## Secret
## ──────────────────────────────────────────────
## Prefer external secret management (Vault, ESO, Sealed Secrets).
## Set secret.data to create an in-cluster Opaque secret.
## Set secret.existingSecret to skip creation and reference an existing one.
secret: {}
# secret:
#   existingSecret: ""
#   data:
#     DB_PASSWORD: changeme

## ──────────────────────────────────────────────
## Extensibility
## ──────────────────────────────────────────────

## Extra environment variables (list of {name, value} or {name, valueFrom})
extraEnvVars: []

## Name of existing ConfigMap to mount as envFrom
extraEnvVarsCM: ""

## Name of existing Secret to mount as envFrom
extraEnvVarsSecret: ""

## Extra volumes to add to the pod
extraVolumes: []

## Extra volume mounts for the primary container
extraVolumeMounts: []

## Extra objects to deploy (rendered with tpl)
extraDeploy: []

## Init containers (rendered as raw YAML)
initContainers: []

## Sidecar containers (rendered as raw YAML)
sidecars: []

## ──────────────────────────────────────────────
## Common metadata
## ──────────────────────────────────────────────

## Labels added to ALL resources
commonLabels: {}

## Annotations added to ALL resources
commonAnnotations: {}

## Labels added to pods only
podLabels: {}

## Annotations added to pods only
podAnnotations: {}
```
