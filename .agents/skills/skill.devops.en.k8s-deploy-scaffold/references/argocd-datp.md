# Argo CD DATP Reference

Use this reference when generating deployment recommendations for DATP infrastructure.
DATP differs from the standard `argocd-infra-*` profile only by its dedicated Argo CD repository pair, a single Argo CD project, namespace folders under `datp/{namespace}`, and PowerDNS A records to the ingress IP. Secrets use ExternalSecret through `vault-css` by default; SealedSecret remains a reserve mechanism for clusters without ESO.

## DATP Cluster Model

| Environment | Argo CD repo | Kubernetes cluster | Runner tag |
|---|---|---|---|
| `dev` | `argocd-datp-dev` | `datp-kube-dev01` | `rancher-datp-kube-dev` |
| `qa` | `argocd-datp-dev` | `datp-kube-dev01` | `rancher-datp-kube-dev` |
| `uat` | `argocd-datp-dev` | `datp-kube-dev01` | `rancher-datp-kube-dev` |
| `prod` | `argocd-datp-prod` | `TBD` # REVIEW: confirm future prod cluster name | `TBD` # REVIEW: confirm future prod runner tag |

GitLab CI environment names are plain environment slugs: `dev`, `qa`, `uat`, `prod`.

## Repository Layout

DATP Argo CD files are committed to namespace folders:

```text
argocd-datp-dev/
└── datp/
    └── {namespace}/
        ├── ns-hr.yaml
        ├── regcred-es.yaml                  # или regcred-sealedsecret.yaml без ESO
        ├── {project}-{service}-secret-es.yaml # или SealedSecret без ESO
        ├── ingress.yaml
        ├── postgresql.yaml
        └── ...
```

Use Argo CD project `datp` for all DATP Applications.

## Namespace Naming

Default namespace pattern:

```text
datp-ais-{app}-{env}
```

Known common case:

```text
datp-ais-botanique-{env}
```

Valid environment suffixes are `dev`, `qa`, `uat`, `prod`.
Some applications may use another `{app}` segment, for example `datp-ais-{another-app}-{env}`. Mark namespace values with `# REVIEW:` whenever the repository name does not clearly identify the DATP application segment.

## Namespace Application

Create `datp/{namespace}/ns-hr.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: {namespace}                         # REVIEW: confirm namespace name
  namespace: argocd
spec:
  project: datp
  source:
    chart: k8s-ns
    repoURL: "https://charts.k8s.biocad.ru/"
    targetRevision: ~1.2.2
    helm:
      values: |
        rbacPrefix: "oidc:"
        developers:
          - {username}                      # REVIEW: developer usernames for RBAC
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
            limits.cpu: "16"                # REVIEW: DATP has no default quota yet
            limits.memory: 24Gi             # REVIEW: DATP has no default quota yet
            persistentvolumeclaims: "5"     # REVIEW: adjust for stateful dependencies
            pods: "10"                      # REVIEW: expected pod count
            requests.cpu: "10"              # REVIEW: DATP has no default quota yet
            requests.memory: 16Gi           # REVIEW: DATP has no default quota yet
            requests.storage: 50Gi          # REVIEW: storage budget
  destination:
    server: https://kubernetes.default.svc
    namespace: {namespace}                  # REVIEW: must match metadata.name
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

## GitLab CI Deploy Jobs

Use plain environment names and DATP runner tags. The deploy component normally selects the target Kubernetes access by the runner tag and CI component configuration; no additional kube-context variable is documented in this skill. If a project already uses a cluster variable, preserve it and mark it with `# REVIEW:`.

```yaml
.deploy_datp_dev: &deploy_datp_dev_template
  environment:
    name: "dev"
  rules:
    - !reference [.protected_tag_rules, rules]
  tags:
    - rancher-datp-kube-dev

.deploy_datp_qa: &deploy_datp_qa_template
  environment:
    name: "qa"
  rules:
    - !reference [.protected_tag_rules, rules]
  tags:
    - rancher-datp-kube-dev

.deploy_datp_uat: &deploy_datp_uat_template
  environment:
    name: "uat"
  rules:
    - !reference [.protected_tag_rules, rules]
  tags:
    - rancher-datp-kube-dev

.deploy_datp_prod: &deploy_datp_prod_template
  environment:
    name: "prod"
  rules:
    - !reference [.protected_tag_rules, rules]
  tags:
    - TBD                                   # REVIEW: confirm future prod runner tag
```

DATP application credentials are delivered by ExternalSecret from `vault-css`. If ESO is unavailable in the target cluster, use a SealedSecret instead. Do not put their values in GitLab CI variables or Helm values.

## External Secrets

Create ExternalSecret manifests in `datp/{namespace}/`. They refer to the shared
`ClusterSecretStore` `vault-css`; secret values stay in Vault and are never written to Git.

### Registry credentials

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: {project}-regcred-es
  namespace: {namespace}                    # REVIEW: namespace
spec:
  refreshInterval: 1m
  secretStoreRef:
    name: vault-css
    kind: ClusterSecretStore
  target:
    name: {project}-regcred
    template:
      type: kubernetes.io/dockerconfigjson
  dataFrom:
    - extract:
        key: {cluster}/{project}/{namespace}/regcred  # REVIEW: Vault path
```

For application and infrastructure secrets, use the identical pattern. The target
Secret name must exactly match the name referenced by Helm.

## SealedSecret (резервный вариант)

Используй этот вариант только когда в целевом кластере нет ESO. Не создавай
одновременно ExternalSecret и SealedSecret для одного Secret name.

```bash
kubeseal \
  --controller-name=sealed-secrets \
  --controller-namespace=kube-system \
  --fetch-cert > {cluster}-sealed-secrets.pem  # REVIEW: controller name/namespace
```

### Registry credentials

```bash
kubectl create secret docker-registry {project}-regcred \
  --namespace {namespace} \
  --docker-server="$CI_REGISTRY" \
  --docker-username="{registry-username}" \
  --docker-password="{registry-token}" \
  --dry-run=client \
  -o yaml \
| kubeseal \
  --cert {cluster}-sealed-secrets.pem \
  --format yaml \
  --scope strict \
> regcred-sealedsecret.yaml
```

### Application and infrastructure secrets

```bash
kubectl create secret generic {secret-name} \
  --namespace {namespace} \
  --from-literal=SECRET_KEY_1="" \
  --dry-run=client \
  -o yaml \
| kubeseal \
  --cert {cluster}-sealed-secrets.pem \
  --format yaml \
  --scope strict \
> {secret-name}-sealedsecret.yaml
```

Перечисли все реальные ключи, но не записывай их значения в Git. Имя полученного
Secret должно совпадать с `existingSecret`, `envFromSecrets` или `imagePullSecrets`.

## Infrastructure Dependencies

Use Argo CD Application manifests only for dependencies that need in-cluster state or separate deployment permissions. Ordinary application workloads are deployed by GitLab CI from their own repository.

Mark these fields with `# REVIEW:`:

- persistence size
- resource requests and limits
- database usernames and database names
- whether the dependency should be deployed in-cluster or provided externally

Не указывай `storageClass`: PVC использует StorageClass кластера по умолчанию.
Добавляй это поле только когда пользователь или inventory явно требуют нестандартный
класс хранения.

PostgreSQL uses the same `cloudpirates` + ExternalSecret contract as the standard
profile; only the Argo CD project and namespace convention differ.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: postgres
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "1"
spec:
  project: datp
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
    namespace: {namespace}                    # REVIEW: namespace
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: postgres-passwords
  namespace: {namespace}                    # REVIEW: namespace
spec:
  refreshInterval: 1m
  secretStoreRef:
    name: vault-css
    kind: ClusterSecretStore
  target:
    name: postgres-passwords
  dataFrom:
    - extract:
        key: {cluster}/{project}/{namespace}/postgres-passwords  # REVIEW: Vault path
```

Redis uses the same `cloudpirates` chart and ExternalSecret as the standard profile:
`chart: redis`, `repoURL: "docker.biocad.ru/cloudpirates"`, `targetRevision: 0.28.0`,
`auth.existingSecret: "redis-secret"` and
`auth.existingSecretPasswordKey: "redis-password"`.

## Ingress

DATP uses nginx ingress and the TLS Secret `wildcard-botanique`, which exists in all namespaces.

Allowed host patterns:

```text
{service}.{env}.botanique.app
{service}.botanique.app
```

Mark the selected host with `# REVIEW:` because both patterns are currently acceptable.

Create `datp/{namespace}/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {project}
  namespace: {namespace}                    # REVIEW: namespace
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    argocd.argoproj.io/sync-wave: "1"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - {service}.{env}.botanique.app     # REVIEW: or {service}.botanique.app
      secretName: wildcard-botanique
  rules:
    - host: {service}.{env}.botanique.app   # REVIEW: must match tls[].hosts
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

No DATP-specific nginx annotations are currently required beyond `ingressClassName: nginx` and TLS.

## PowerDNS

DATP does not use a load balancer or cluster GSLB CNAME for application hosts. Create an A record per ingress host.

Dev target:

| Type | Name | Content | TTL |
|---|---|---|---|
| A | `{service}.{env}.botanique.app` | `10.252.156.201` | 300 |

Rules:

- Do not recommend wildcard DNS records; create one A record for each ingress host.
- Keep TTL `300`.
- For prod, mark the IP with `# REVIEW:` until `argocd-datp-prod` networking is defined.

## DATP Review Checklist

Include these DATP-specific items in the final `Review Required` table:

- namespace name and environment suffix
- target Argo CD repo (`argocd-datp-dev` or `argocd-datp-prod`)
- prod runner tag and prod cluster name, if environment is `prod`
- Vault path for every ExternalSecret либо параметры SealedSecret, если ESO недоступен
- Secret names and keys referenced by each Helm chart
- registry Secret credentials source
- ingress host pattern
- PowerDNS A record host and IP
- chart versions, resources, and whether the dependency is in-cluster or external
- non-default `storageClass`, только если он явно требуется целевым inventory
