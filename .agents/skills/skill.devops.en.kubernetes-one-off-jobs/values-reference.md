# Values Reference

Use these snippets inside `bcd-web.jobs`. Every job must be committed with
`enabled: false`.

## Complete `values.yaml` Scaffold

Use this as a full starting point for one-off Job related values. Merge it into
the existing `bcd-web:` values instead of replacing unrelated service settings.

```yaml
bcd-web:
  fullnameOverride: "<release>"

  imagePullSecrets:
    - name: regcred

  podSecurityContext:
    fsGroup: 1654

  containers:
    <app-container>:
      image:
        repository: "${CI_REGISTRY_IMAGE}"
        tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
        suffix: <app-image-suffix>
        pullPolicy: IfNotPresent
      ports:
        - containerPort: <app-port>
          name: http
          protocol: TCP
      envFromConfigMaps:
        - <app-configmap>
      envFromSecrets:
        - <app-secret>
      securityContext:
        runAsUser: 1654
        runAsGroup: 1654
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: false
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 512Mi

  jobs:
    migrate-down:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "migrate", "down"]
      env:
        - name: ALLOW_MIGRATION_DOWN_ONE
          value: "true"
      backoffLimit: 0
      activeDeadlineSeconds: 600
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 25m
          memory: 128Mi
        limits:
          cpu: 200m
          memory: 512Mi

    migrate-to:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "migrate", "to", "$(MIGRATE_TARGET)"]
      env:
        - name: MIGRATE_TARGET
          value: "${MIGRATE_TARGET}"
      backoffLimit: 0
      activeDeadlineSeconds: 600
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 25m
          memory: 128Mi
        limits:
          cpu: 200m
          memory: 512Mi

    seed-up:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "seed", "up"]
      backoffLimit: 0
      activeDeadlineSeconds: 600
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 25m
          memory: 128Mi
        limits:
          cpu: 200m
          memory: 512Mi

    seed-down:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "seed", "down"]
      backoffLimit: 0
      activeDeadlineSeconds: 600
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 25m
          memory: 128Mi
        limits:
          cpu: 200m
          memory: 512Mi

    legacy-import:
      enabled: false
      image:
        repository: "${CI_REGISTRY_IMAGE}"
        tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
        suffix: <migration-image-suffix>
        pullPolicy: IfNotPresent
      command: ["python", "/app/<legacy-import-script>.py"]
      envFromSecrets:
        - <app-secret>
        - <data-migration-secret>
      securityContext:
        runAsUser: 1654
        runAsGroup: 1654
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: false
      backoffLimit: 0
      activeDeadlineSeconds: 1800
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 512Mi

    verify:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "migrate", "verify"]
      backoffLimit: 0
      activeDeadlineSeconds: 300
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 25m
          memory: 64Mi
        limits:
          cpu: 100m
          memory: 256Mi

  jobNetworkPolicy:
    enabled: false
    policyTypes:
      - Egress
    egress:
      # Заполни правилами из NetworkPolicy основного workload.
```

For Alembic projects, replace dotnet commands with commands such as:

```yaml
command: ["alembic", "upgrade", "head"]
command: ["alembic", "downgrade", "$(MIGRATE_TARGET)"]
command: ["python", "-m", "<package>.seed", "up"]
command: ["python", "-m", "<package>.seed", "down"]
```

## Dotnet Migration Down With `containerRef`

Use this when the application image already contains the CLI command.

```yaml
bcd-web:
  jobs:
    migrate-down:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "migrate", "down"]
      env:
        - name: ALLOW_MIGRATION_DOWN_ONE
          value: "true"
      backoffLimit: 0
      activeDeadlineSeconds: 600
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 25m
          memory: 128Mi
        limits:
          cpu: 200m
          memory: 512Mi
```

`containerRef` inherits image, env, ConfigMaps, Secrets, security context,
resources, and volume mounts from the referenced app container. Override only
what differs.

## Explicit Migration Target

```yaml
bcd-web:
  jobs:
    migrate-to:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "migrate", "to", "$(MIGRATE_TARGET)"]
      env:
        - name: MIGRATE_TARGET
          value: "${MIGRATE_TARGET}"
      backoffLimit: 0
      activeDeadlineSeconds: 600
      ttlSecondsAfterFinished: 600
```

For Alembic:

```yaml
command: ["alembic", "downgrade", "$(MIGRATE_TARGET)"]
```

`$(MIGRATE_TARGET)` is Kubernetes container environment expansion. The custom
CI envsubst does not replace this form.

## Seed Up And Seed Down

```yaml
bcd-web:
  jobs:
    seed-up:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "seed", "up"]
      backoffLimit: 0
      activeDeadlineSeconds: 600

    seed-down:
      enabled: false
      containerRef: <app-container>
      command: ["dotnet", "<App>.dll", "seed", "down"]
      backoffLimit: 0
      activeDeadlineSeconds: 600
```

`seed-down` should normally require `JOB_REQUIRE_CONFIRM`.

## Dedicated Data-Migration Image

Use this when scripts are packaged into a separate image suffix.

```yaml
bcd-web:
  jobs:
    legacy-import:
      enabled: false
      image:
        repository: "${CI_REGISTRY_IMAGE}"
        tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
        suffix: <image-suffix>
        pullPolicy: IfNotPresent
      command: ["python", "/app/<script>.py"]
      envFromSecrets:
        - <data-migration-secret>
      securityContext:
        runAsUser: 1654
        runAsGroup: 1654
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: false
      backoffLimit: 0
      activeDeadlineSeconds: 1800
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 512Mi
```

Use a separate secret for migration-only credentials when changing those
credentials must not restart the application deployment.

## Asset Upload Job

```yaml
bcd-web:
  jobs:
    assets-upload:
      enabled: false
      image:
        repository: "${CI_REGISTRY_IMAGE}"
        tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
        suffix: <image-suffix>
        pullPolicy: IfNotPresent
      command: ["python", "/app/<upload-script>.py", "--skip-convert"]
      envFromSecrets:
        - <app-secret>
      securityContext:
        runAsUser: 1654
        runAsGroup: 1654
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: false
      backoffLimit: 0
      activeDeadlineSeconds: 600
      ttlSecondsAfterFinished: 600
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 512Mi
```

## Job NetworkPolicy

Use explicit `jobNetworkPolicy` only when one-off job egress differs from the
deployment or the cluster default-deny policy blocks the job.

```yaml
bcd-web:
  jobNetworkPolicy:
    enabled: true
    policyTypes:
      - Egress
    egress:
      - to:
          - ipBlock:
              cidr: <cidr>
        ports:
          - protocol: TCP
            port: 443
          - protocol: TCP
            port: 5432
          - protocol: TCP
            port: 9092
          - protocol: TCP
            port: 53
          - protocol: UDP
            port: 53
```

If normal deployment `networkPolicy.egress` already covers the job, do not add
a separate policy.

## Envsubst Rules

The Helm CI component uses custom envsubst:

```sh
envsubst -no-unset -fail-fast
```

Valid values expression:

```yaml
tag: "${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
```

Do not add `IMAGE_TAG` synthesis to CI when values already define this fallback.
