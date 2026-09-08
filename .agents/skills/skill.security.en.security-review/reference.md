# Security Review — Reference Examples

Detailed FAIL/PASS examples for each section of the [SKILL.md](SKILL.md).

---

## Dockerfile Examples

### FAIL — insecure Dockerfile

```dockerfile
FROM python:latest

COPY . .
RUN pip install -r requirements.txt

ARG DB_PASSWORD=secret123
ENV DATABASE_URL=postgres://admin:${DB_PASSWORD}@db:5432/app

EXPOSE 8000
CMD ["python", "main.py"]
```

Problems:
- `python:latest` — unpinned tag (D1)
- Runs as root — no `USER` directive (D2)
- No multi-stage build (D3)
- Secret in `ARG` and `ENV` — baked into image layers (D4)
- `COPY . .` without `.dockerignore` pulls in `.env`, `.git/` (D5, D7)
- Full `python` image instead of `-slim` (D6)

### PASS — hardened Dockerfile

```dockerfile
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app
WORKDIR /app

COPY --from=builder /install /usr/local
COPY --chown=app:app src/ ./src/

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"]

CMD ["python", "src/main.py"]
```

### PASS — .dockerignore

```
.env
.env.*
.git/
.gitignore
node_modules/
__pycache__/
*.pyc
*.key
*.pem
*.p12
.vscode/
.idea/
.cursor/
.claude/
docker-compose*.yml
README.md
docs/
tests/
```

---

## Docker Compose Examples

### FAIL — insecure compose

```yaml
version: "3.8"
services:
  app:
    build: .
    container_name: my-app
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://<user>:<password>@db:5432/appdb
      JWT_SECRET: my-jwt-secret-key-12345
    privileged: true

  db:
    image: postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: <password>
    volumes:
      - /var/data/postgres:/var/lib/postgresql/data
```

Problems:
- Hardcoded secrets in `environment:` (C1)
- No `.env.example` workflow (C2)
- DB port exposed to host (C3)
- No named network — all services share default bridge (C4)
- `privileged: true` (C5)
- `container_name:` breaks scaling (C8)
- Host-bind mount with absolute path (C9)
- `postgres` image unpinned (D1)

### PASS — hardened compose

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${APP_PORT:-8000}:8000"
    environment:
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
    networks:
      - frontend
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M

networks:
  frontend:
  backend:

volumes:
  pgdata:
```

### PASS — .env.example

```bash
# Приложение
APP_PORT=8000

# База данных
DB_USER=app
DB_PASSWORD=<password>
DB_NAME=appdb

# Секреты
JWT_SECRET=<jwt-secret>
```

---

## Helm Chart Security Examples

### FAIL — insecure values.yaml

```yaml
image:
  repository: myregistry.io/app
  tag: latest

containerSecurityContext:
  runAsNonRoot: false
  privileged: true

resources: {}

networkPolicy:
  enabled: false

secrets:
  dbPassword: "<password>"
  apiKey: "<api-key>"

ingress:
  enabled: true
  tls: []
```

Problems:
- `tag: latest` (H12)
- `runAsNonRoot: false` + `privileged: true` (H1, H2)
- No resource limits (H6)
- NetworkPolicy disabled (H7)
- Plain-text secrets in values (H8)
- Ingress without TLS (H11)

### PASS — hardened values.yaml

```yaml
image:
  registry: registry.biocad.ru
  repository: team/app
  tag: "1.2.3"
  pullPolicy: IfNotPresent

replicaCount: 2

podSecurityContext:
  enabled: true
  fsGroup: 1001

containerSecurityContext:
  enabled: true
  runAsUser: 1001
  runAsGroup: 1001
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

networkPolicy:
  enabled: true

serviceAccount:
  create: true
  automountServiceAccountToken: false

ingress:
  enabled: true
  ingressClassName: nginx
  tls:
    - secretName: app-tls
      hosts:
        - app.example.com
  hostname: app.example.com

pdb:
  create: true
  maxUnavailable: 1

# Secrets — reference only, actual values injected by Vault/ESO
existingSecret: app-secrets
```

### PASS — NetworkPolicy template

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ include "app.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
spec:
  podSelector:
    matchLabels:
      {{- include "app.selectorLabels" . | nindent 6 }}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
      ports:
        - port: {{ .Values.containerPorts.http }}
          protocol: TCP
  egress:
    - to: []
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: postgresql
      ports:
        - port: 5432
          protocol: TCP
```

---

## External Secrets Example

### PASS — ExternalSecret with Vault

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
  namespace: {{ .Release.Namespace | quote }}
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: secret/data/team/app
        property: database_url
    - secretKey: JWT_SECRET
      remoteRef:
        key: secret/data/team/app
        property: jwt_secret
```

---

## Kubernetes Manifest Examples

### FAIL — insecure pod spec

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: debug-pod
spec:
  hostNetwork: true
  hostPID: true
  containers:
    - name: app
      image: myapp:latest
      securityContext:
        privileged: true
      ports:
        - containerPort: 8080
```

Problems:
- `hostNetwork: true` (K1)
- `hostPID: true` (K1)
- `privileged: true` (K2)
- `image: myapp:latest` (H12)

### FAIL — insecure ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "*"
spec:
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app
                port:
                  number: 8080
```

Problems:
- CORS `*` in production (K5)
- No TLS (K4)

### PASS — hardened ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app
                port:
                  number: 8080
```

---

## GitLab CI/CD Examples

### FAIL — secrets in CI config

```yaml
stages: [build, deploy]

build:
  stage: build
  script:
    - docker build --build-arg DB_PASSWORD=<password> -t app:latest .
    - docker push registry.example.com/app:latest

deploy:
  stage: deploy
  script:
    - kubectl set image deployment/app app=registry.example.com/app:latest
  allow_failure: true
```

Problems:
- Secret in `--build-arg` in plain text (G2)
- `app:latest` tag (H12)
- `allow_failure: true` on deploy (G6)
- No security scanning stages

### PASS — secure CI pipeline

```yaml
include:
  - component: gitlab.biocad.ru/iac/ci-components/security/secret-detection/secret-detection@2.0.0
  - component: gitlab.biocad.ru/iac/ci-components/security/kics/kics@1.0.0

stages: [secrets, lint, build, deploy]

build:
  stage: build
  script:
    - docker build
        --no-cache
        -t ${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHORT_SHA}
        .
    - docker push ${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHORT_SHA}
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy:
  stage: deploy
  script:
    - helm upgrade --install app ./helm/app
        --set image.tag=${CI_COMMIT_SHORT_SHA}
        --namespace ${KUBE_NAMESPACE}
  environment:
    name: production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
```

Notes:
- `DB_PASSWORD` stored as CI/CD protected+masked variable, never in YAML (G1)
- Image tagged with commit SHA, not `latest` (H12)
- Security components included at top (G3, G4)
- No `allow_failure` on security jobs (G6)

---

## .NET Dockerfile Example (dotnet stack)

### PASS

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build

WORKDIR /src
COPY *.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=build /app .

USER app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["wget", "--spider", "-q", "http://127.0.0.1:8080/health"]

ENTRYPOINT ["dotnet", "App.dll"]
```

---

## Node.js Dockerfile Example

### PASS

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM node:22-alpine

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["wget", "--spider", "-q", "http://127.0.0.1:3000/health"]

CMD ["node", "dist/main.js"]
```
