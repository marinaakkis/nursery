# Docker Compose → bcd-web Mapping Reference

How every docker-compose construct translates to bcd-web Helm values, GitLab CI, Vault, and Argo CD. Use this as a lookup table during repository analysis.

## Table of Contents

- [Mapping Table](#mapping-table)
- [Service Classification](#service-classification)
- [Environment Variables](#environment-variables)
- [Ports](#ports)
- [Health Checks](#health-checks)
- [Resources](#resources)
- [Volumes and Storage](#volumes-and-storage)
- [Networking and Dependencies](#networking-and-dependencies)
- [Replicas and Scaling](#replicas-and-scaling)
- [Init and Sidecar Patterns](#init-and-sidecar-patterns)
- [Constructs That Do Not Map](#constructs-that-do-not-map)
- [Example: Full Conversion](#example-full-conversion)

## Mapping Table

| Docker Compose | Where It Goes | bcd-web / K8s Equivalent |
|---|---|---|
| `services.{name}` (app) | Helm chart | `helm/{service}/` — own Chart.yaml + values.yaml |
| `services.{name}` (infra: postgres, redis, etc.) | Argo CD | Separate Application in argocd-infra repo |
| `image: repo:tag` | values.yaml | `bcd-web.containers.{name}.image.repository` + `.suffix` + `.tag` (tag from CI, not hardcoded) |
| `build: ./path` | `.gitlab-ci.yml` | Matrix build entry: `BUILD_PATH`, `BUILD_FILE`, `IMAGE_SUFFIX` |
| `ports: ["8080:8080"]` | values.yaml | `bcd-web.containers.{name}.ports[]` + `bcd-web.service.{name}.ports[]` |
| `expose: ["8080"]` | values.yaml | `bcd-web.containers.{name}.ports[]` (no Service needed if internal only) |
| `environment:` (config) | values.yaml | `bcd-web.configmaps_create.{project}-{service}-config` + `envFromConfigMaps` |
| `environment:` (secret) | Vault | `secrets_create.{project}-{service}-sec` in Vault file + `envFromSecrets` |
| `env_file: .env` | Vault + values.yaml | Review each var; split config → ConfigMap, secrets → Vault |
| `volumes:` (named) | values.yaml | `bcd-web.persistence` (creates PVC) + `bcd-web.volumes` + `volumeMounts` |
| `volumes:` (bind mount, config) | values.yaml | `bcd-web.configmaps_create` with file content, or `extraObjects` for ConfigMap + volumeMount |
| `volumes:` (bind mount, data) | values.yaml | `bcd-web.persistence` + `volumes` + `volumeMounts` |
| `tmpfs: /tmp` | values.yaml | `bcd-web.volumes: [{name: tmp, emptyDir: {}}]` + `volumeMounts` |
| `deploy.resources.limits` | values.yaml | `bcd-web.containers.{name}.resources.limits` |
| `deploy.resources.reservations` | values.yaml | `bcd-web.containers.{name}.resources.requests` |
| `deploy.replicas` | values.yaml | `bcd-web.replicaCount` (or `autoscaling` if dynamic) |
| `healthcheck:` | values.yaml | `bcd-web.containers.{name}.livenessProbe` + `readinessProbe` |
| `depends_on:` (app→infra) | Argo CD | sync-wave ordering (infra at wave 1, app deployed by CI after infra exists) |
| `depends_on:` (app→app) | `.gitlab-ci.yml` | CI job dependency (`needs:`) or deploy job ordering |
| `depends_on:` (migration→db) | values.yaml | `bcd-web.initContainers` — runs before main containers |
| `restart: always` | Kubernetes | Default behavior — pods always restart. No mapping needed |
| `networks:` | values.yaml | `bcd-web.networkPolicy` — controls ingress/egress per service |
| `logging:` | Cluster-level | Handled by cluster log collector (Fluent Bit, etc.). No mapping needed |
| `secrets:` (Docker secrets) | Vault | `secrets_create` via Vault + `envFromSecrets` |
| `command:` / `entrypoint:` | values.yaml | `bcd-web.containers.{name}.command` + `args` |
| `working_dir:` | Dockerfile | Set `WORKDIR` in Dockerfile, not in Helm values |
| `user: "1000:1000"` | values.yaml | `bcd-web.containers.{name}.securityContext.runAsUser/runAsGroup` (1000:1000 required by bcd-web) |
| `labels:` | values.yaml | `bcd-web.labels` or `bcd-web.podAnnotations` |
| `extra_hosts:` | Not supported | Use CoreDNS or ExternalName Service instead |
| `cap_add/cap_drop` | Hardcoded | bcd-web hardcodes `capabilities.drop: [ALL]`, `allowPrivilegeEscalation: false` |
| `privileged: true` | Not supported | bcd-web hardcodes `privileged: false` — redesign the service |
| `pid: host` / `network: host` | values.yaml | `hostPID` / `hostNetwork` (optional, use only if absolutely required) |

## Service Classification

First step: classify every compose service as **application** or **infrastructure**.

| Type | Deploy via | Examples |
|---|---|---|
| Application | Helm chart (bcd-web) + GitLab CI | Your code: API, frontend, worker, migration |
| Infrastructure | Argo CD Application | postgres, redis, rabbitmq, kafka, mongo, minio, elasticsearch, mysql |
| One-shot / migration | `bcd-web.initContainers` | DB migration, schema setup, seed data |
| Utility / debug | Skip | adminer, pgadmin, mailhog (dev-only tools) |

**Infrastructure detection keywords:** `postgres`, `pgbouncer`, `redis`, `rabbitmq`, `kafka`, `mongo`, `elasticsearch`, `opensearch`, `minio`, `mysql`, `mariadb`, `memcached`, `nats`, `zookeeper`, `consul`, `vault` (as a compose service).

Dev-only services (not deployed to K8s): `adminer`, `pgadmin`, `phpmyadmin`, `mailhog`, `mailpit`, `jaeger` (if cluster-level), `traefik` (cluster-level ingress), `nginx` (as reverse proxy — replaced by Ingress).

## Environment Variables

### Classification Rules

| Pattern | Classification | Destination |
|---|---|---|
| `LOG_LEVEL`, `APP_ENV`, `TZ`, `NODE_ENV` | Config | `configmaps_create` |
| `PORT`, `LISTEN_ADDR`, `WORKERS` | Config | `configmaps_create` |
| Feature flags (`ENABLE_*`, `FEATURE_*`) | Config | `configmaps_create` |
| `*_PASSWORD`, `*_SECRET`, `*_TOKEN`, `*_KEY` | Secret | Vault `secrets_create` |
| `*_API_KEY`, `*_CREDENTIAL`, `*_PRIVATE_KEY` | Secret | Vault `secrets_create` |
| `DATABASE_URL`, `REDIS_URL`, `AMQP_URL` | Secret | Vault (contains credentials or internal topology) |
| `*_CONNECTION_STRING`, `*_DSN` | Secret | Vault |
| URLs without credentials (`HTTP_PROXY`, `SENTRY_DSN`) | Config | `configmaps_create` |
| `S3_ENDPOINT`, `S3_BUCKET` (no secret key) | Config | `configmaps_create` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Secret | Vault |

### Conversion

docker-compose:
```yaml
environment:
  LOG_LEVEL: info
  DATABASE_URL: postgres://user:pass@db:5432/mydb
  API_KEY: ${API_KEY}
```

bcd-web values.yaml (config only):
```yaml
bcd-web:
  configmaps_create:
    {project}-{service}-config:
      LOG_LEVEL: "info"

  containers:
    {service}:
      envFromConfigMaps:
        - {project}-{service}-config
      envFromSecrets:
        - {project}-{service}-sec
```

Vault secret file (secrets only):
```yaml
bcd-web:
  secrets_create:
    {project}-{service}-sec:
      DATABASE_URL: ""        # user fills in Vault
      API_KEY: ""
```

## Ports

docker-compose:
```yaml
ports:
  - "80:8080"        # host:container
  - "8080:8080"
```

bcd-web values.yaml:
```yaml
bcd-web:
  containers:
    {service}:
      ports:
        - containerPort: 8080            # always the CONTAINER port
          name: http
          protocol: TCP

  service:
    {service}:
      ports:
        - port: 8080                     # external port (what other pods connect to)
          targetPort: http               # references containerPort name
          protocol: TCP
          name: http
```

The host port from compose is irrelevant in K8s — Services handle routing. Port names: `http` (80/8080), `grpc` (50051), `metrics` (9090), `audiosocket`, etc.

## Health Checks

docker-compose splits into **two** K8s probes:

| Probe | Purpose | Failure Action |
|---|---|---|
| `livenessProbe` | Is the process alive? | Restart container |
| `readinessProbe` | Can it serve traffic? | Remove from Service endpoints |

docker-compose:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 15s
```

bcd-web values.yaml:
```yaml
bcd-web:
  containers:
    {service}:
      livenessProbe:
        enabled: true
        probe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 15        # from start_period
          periodSeconds: 30              # from interval
          failureThreshold: 3            # from retries
          timeoutSeconds: 10             # from timeout
      readinessProbe:
        enabled: true
        probe:
          httpGet:
            path: /health               # same or separate /ready endpoint
            port: http
          initialDelaySeconds: 10
          periodSeconds: 10
          failureThreshold: 3
          timeoutSeconds: 1
```

For non-HTTP services use `tcpSocket: { port: {port-name} }` instead of `httpGet`.

## Resources

docker-compose uses decimal CPU and byte suffixes. K8s uses millicores and binary suffixes.

| Docker Compose | Kubernetes | Conversion |
|---|---|---|
| `cpus: '0.5'` (limits) | `cpu: 500m` (limits) | multiply by 1000 |
| `cpus: '0.1'` (reservations) | `cpu: 100m` (requests) | multiply by 1000 |
| `memory: 512M` (limits) | `memory: 512Mi` (limits) | M → Mi (close enough) |
| `memory: 128M` (reservations) | `memory: 128Mi` (requests) | M → Mi |

docker-compose `deploy.resources.reservations` = K8s `requests` (guaranteed minimum).
docker-compose `deploy.resources.limits` = K8s `limits` (hard ceiling).

If compose has no resource settings, use sensible defaults:
```yaml
resources:
  requests:
    cpu: 200m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

## Volumes and Storage

### Named Volumes → PVC

docker-compose:
```yaml
services:
  api:
    volumes:
      - data:/app/data
volumes:
  data:
```

bcd-web values.yaml:
```yaml
bcd-web:
  persistence:
    {project}-data-pvc:
      size: 10Gi                         # REVIEW: estimate from usage
      accessMode: ReadWriteOnce

  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: {project}-data-pvc

  containers:
    api:
      volumeMounts:
        - name: data
          mountPath: /app/data
```

### Bind Mounts (config files) → ConfigMap

docker-compose:
```yaml
volumes:
  - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

bcd-web values.yaml (via `extraObjects`):
```yaml
bcd-web:
  extraObjects:
    - apiVersion: v1
      kind: ConfigMap
      metadata:
        name: {project}-nginx-config
      data:
        nginx.conf: |
          # ... file content ...

  volumes:
    - name: nginx-config
      configMap:
        name: {project}-nginx-config

  containers:
    {service}:
      volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
```

### tmpfs → emptyDir

docker-compose:
```yaml
tmpfs: /tmp
```

bcd-web values.yaml:
```yaml
bcd-web:
  volumes:
    - name: tmp
      emptyDir: {}

  containers:
    {service}:
      volumeMounts:
        - name: tmp
          mountPath: /tmp
```

## Networking and Dependencies

### `depends_on` → deploy ordering

| Compose pattern | K8s equivalent |
|---|---|
| app depends on infra (db, redis) | Argo CD deploys infra first (sync-wave 1), CI deploys app after infra exists |
| app depends on another app | CI job ordering via `needs:` or sequential deploy jobs |
| migration depends on db | `bcd-web.initContainers` — runs before main container starts |

### `networks` → NetworkPolicy

docker-compose network isolation maps to `bcd-web.networkPolicy`. Each service gets ingress rules allowing only expected sources:

```yaml
bcd-web:
  networkPolicy:
    enabled: true
    policyTypes:
      - Ingress
    ingress:
      - from:
          - namespaceSelector:
              matchLabels:
                kubernetes.io/metadata.name: <target-namespace> # REVIEW: cluster inventory
            podSelector:
              matchLabels:
                app.kubernetes.io/name: bcd-web
                app.kubernetes.io/instance: {project}-{caller-service}
        ports:
          - protocol: TCP
            port: {port}
```

Apply the same `namespaceSelector + podSelector` shape to egress rules. Read [the shared `bcd-web` profile](network-policy-contract.md#profile-shared-bcd-web) before generating rules: workload labels come from cluster inventory, not from an assumption about a chart name. Do not use `10.0.0.0/8` as a shortcut for an in-cluster dependency.

### Internal DNS names

Compose service names (e.g. `db`, `redis`) become K8s Service DNS names. Update connection strings:

| Compose | K8s (Argo CD infra) |
|---|---|
| `db:5432` | `{project}-postgres:5432` |
| `redis:6379` | `{project}-redis-master:6379` |
| `rabbitmq:5672` | `{project}-rabbitmq:5672` |
| `kafka:9092` | `{project}-kafka:9092` |
| `mongo:27017` | `{project}-mongodb:27017` |

These DNS names go into the Vault secret (connection strings) or ConfigMap (if host-only without credentials).

## Replicas and Scaling

| Compose | bcd-web |
|---|---|
| `deploy.replicas: 3` | `bcd-web.replicaCount: 3` |
| No replica setting | `bcd-web.replicaCount: 1` (default) |
| Dynamic scaling needed | `bcd-web.autoscaling.enabled: true` + `minReplicas` / `maxReplicas` / `targetCPUUtilizationPercentage` |

## Init and Sidecar Patterns

### Migration service → initContainer

docker-compose:
```yaml
services:
  migrate:
    image: registry/project/migrate:latest
    command: ["python", "manage.py", "migrate"]
    depends_on:
      db:
        condition: service_healthy
```

bcd-web values.yaml:
```yaml
bcd-web:
  initContainers:
    migrate:
      image:
        repository: $CI_REGISTRY_IMAGE
        tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
        suffix: migrate
      command:
        - python
        - manage.py
        - migrate
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
      envFromSecrets:
        - {project}-{service}-sec       # needs DB credentials
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 512Mi
```

### Sidecar service → additional container

If two compose services share a Pod (e.g. app + log shipper), put both in the same `bcd-web.containers` map:

```yaml
bcd-web:
  containers:
    app:
      # ... main application ...
    log-shipper:
      # ... sidecar ...
```

This is rare — most compose services become separate Helm charts.

## Constructs That Do Not Map

| Compose Construct | Why | Alternative |
|---|---|---|
| `privileged: true` | bcd-web hardcodes `privileged: false` | Redesign to avoid (use capabilities or init) |
| `cap_add: [SYS_ADMIN]` | bcd-web drops ALL capabilities | Request exception from platform team |
| `extra_hosts:` | No /etc/hosts injection | CoreDNS custom entries or ExternalName Service |
| `stdin_open` / `tty` | Interactive terminals not applicable | N/A for production workloads |
| `profiles:` | Dev-only feature | Skip — not deployed to K8s |
| `extends:` | Compose templating | Helm values handle this |
| Docker-in-Docker (`/var/run/docker.sock`) | Security risk | Use Kaniko for builds (already in CI) |

## Example: Full Conversion

### Input: docker-compose.yml

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "80:3000"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/app
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: info
      WORKERS: "4"
    volumes:
      - uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 3
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1024M
        reservations:
          cpus: '0.25'
          memory: 256M

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine

volumes:
  uploads:
  pgdata:
```

### Classification

| Service | Type | Destination |
|---|---|---|
| `frontend` | Application | `helm/frontend/` + CI build + deploy |
| `backend` | Application | `helm/backend/` + CI build + deploy |
| `db` | Infrastructure | Argo CD PostgreSQL Application |
| `redis` | Infrastructure | Argo CD Redis Application |

### Variables (backend)

| Variable | Classification | Destination |
|---|---|---|
| `DATABASE_URL` | Secret | Vault (contains credentials) |
| `REDIS_URL` | Secret | Vault (internal topology) |
| `LOG_LEVEL` | Config | `configmaps_create` |
| `WORKERS` | Config | `configmaps_create` |

### DNS Name Changes

| Compose name | K8s Service name |
|---|---|
| `db:5432` | `{project}-postgres:5432` |
| `redis:6379` | `{project}-redis-master:6379` |

Update `DATABASE_URL` and `REDIS_URL` in Vault to use K8s DNS names.

### Generated Structure

```
helm/
├── frontend/
│   ├── Chart.yaml            # bcd-web 0.2.3
│   └── values.yaml           # containers.frontend, service, networkPolicy
├── backend/
│   ├── Chart.yaml            # bcd-web 0.2.3
│   └── values.yaml           # containers.backend, service, persistence, networkPolicy
.gitlab-ci.yml                # matrix build (frontend + backend), deploy jobs
docker-compose.yaml           # generated for local dev (mirrors K8s)
.env.example                  # DATABASE_URL=, REDIS_URL=

Argo CD recommendations (text):
├── ns-hr.yaml
├── regcred-es.yaml
├── postgres.yaml + postgres-secret-es.yaml
├── redis.yaml
└── ingress.yaml
```
