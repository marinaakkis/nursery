# Templates Reference

Complete Go template code for every resource kind. Replace `<CHART>` with your chart name.

---

## _helpers.tpl

```gotemplate
{{/*
Expand the name of the chart.
*/}}
{{- define "<CHART>.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
Truncated at 63 chars because some Kubernetes name fields are limited to this.
*/}}
{{- define "<CHART>.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "<CHART>.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Namespace.
*/}}
{{- define "<CHART>.namespace" -}}
{{- .Release.Namespace -}}
{{- end }}

{{/*
Standard labels.
*/}}
{{- define "<CHART>.labels" -}}
helm.sh/chart: {{ include "<CHART>.chart" . }}
{{ include "<CHART>.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels (used in matchLabels and pod template).
*/}}
{{- define "<CHART>.selectorLabels" -}}
app.kubernetes.io/name: {{ include "<CHART>.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Pod labels: selectorLabels + podLabels + commonLabels.
*/}}
{{- define "<CHART>.podLabels" -}}
{{ include "<CHART>.selectorLabels" . }}
{{- with .Values.podLabels }}
{{ toYaml . }}
{{- end }}
{{- with .Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Return the proper image name.
Supports global.imageRegistry override and digest pinning.
*/}}
{{- define "<CHART>.image" -}}
{{- $registry := .Values.image.registry -}}
{{- if .Values.global }}
  {{- if .Values.global.imageRegistry }}
    {{- $registry = .Values.global.imageRegistry -}}
  {{- end }}
{{- end }}
{{- if .Values.image.digest }}
{{- printf "%s/%s@%s" $registry .Values.image.repository .Values.image.digest }}
{{- else }}
{{- $tag := .Values.image.tag | default .Chart.AppVersion -}}
{{- printf "%s/%s:%s" $registry .Values.image.repository $tag }}
{{- end }}
{{- end }}

{{/*
Return imagePullSecrets, merging global and local.
*/}}
{{- define "<CHART>.imagePullSecrets" -}}
{{- $secrets := list -}}
{{- if .Values.global }}
  {{- range .Values.global.imagePullSecrets }}
    {{- $secrets = append $secrets . -}}
  {{- end }}
{{- end }}
{{- range .Values.image.pullSecrets }}
  {{- $secrets = append $secrets . -}}
{{- end }}
{{- if $secrets }}
imagePullSecrets:
  {{- range $secrets }}
  - name: {{ . }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "<CHART>.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "<CHART>.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
```

---

## deployment.yaml

```gotemplate
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  revisionHistoryLimit: {{ .Values.revisionHistoryLimit }}
  {{- with .Values.updateStrategy }}
  strategy:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "<CHART>.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "<CHART>.podLabels" . | nindent 8 }}
      annotations:
        {{- /* Trigger rolling restart on config change */}}
        {{- if .Values.configMap }}
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- end }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
    spec:
      {{- include "<CHART>.imagePullSecrets" . | nindent 6 }}
      serviceAccountName: {{ include "<CHART>.serviceAccountName" . }}
      automountServiceAccountToken: {{ .Values.serviceAccount.automountServiceAccountToken | default false }}
      {{- if .Values.podSecurityContext.enabled }}
      securityContext:
        fsGroup: {{ .Values.podSecurityContext.fsGroup }}
        {{- with .Values.podSecurityContext.sysctls }}
        sysctls:
          {{- toYaml . | nindent 10 }}
        {{- end }}
      {{- end }}
      {{- if .Values.affinity }}
      affinity:
        {{- toYaml .Values.affinity | nindent 8 }}
      {{- else }}
      affinity:
        {{- if eq .Values.podAntiAffinityPreset "soft" }}
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 1
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    {{- include "<CHART>.selectorLabels" . | nindent 20 }}
                topologyKey: kubernetes.io/hostname
        {{- else if eq .Values.podAntiAffinityPreset "hard" }}
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels:
                  {{- include "<CHART>.selectorLabels" . | nindent 18 }}
              topologyKey: kubernetes.io/hostname
        {{- end }}
        {{- with .Values.nodeAffinityPreset }}
        {{- if .type }}
        nodeAffinity:
          {{- if eq .type "soft" }}
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 1
              preference:
                matchExpressions:
                  - key: {{ .key }}
                    operator: In
                    values:
                      {{- toYaml .values | nindent 22 }}
          {{- else if eq .type "hard" }}
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: {{ .key }}
                    operator: In
                    values:
                      {{- toYaml .values | nindent 22 }}
          {{- end }}
        {{- end }}
        {{- end }}
      {{- end }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.topologySpreadConstraints }}
      topologySpreadConstraints:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.initContainers }}
      initContainers:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: {{ include "<CHART>.name" . }}
          image: {{ include "<CHART>.image" . }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          {{- if .Values.containerSecurityContext.enabled }}
          securityContext:
            runAsUser: {{ .Values.containerSecurityContext.runAsUser }}
            runAsGroup: {{ .Values.containerSecurityContext.runAsGroup }}
            runAsNonRoot: {{ .Values.containerSecurityContext.runAsNonRoot }}
            readOnlyRootFilesystem: {{ .Values.containerSecurityContext.readOnlyRootFilesystem }}
            allowPrivilegeEscalation: {{ .Values.containerSecurityContext.allowPrivilegeEscalation }}
            {{- with .Values.containerSecurityContext.capabilities }}
            capabilities:
              {{- toYaml . | nindent 14 }}
            {{- end }}
          {{- end }}
          {{- with .Values.command }}
          command:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.args }}
          args:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          env:
            {{- with .Values.extraEnvVars }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
          envFrom:
            {{- if .Values.extraEnvVarsCM }}
            - configMapRef:
                name: {{ .Values.extraEnvVarsCM }}
            {{- end }}
            {{- if .Values.extraEnvVarsSecret }}
            - secretRef:
                name: {{ .Values.extraEnvVarsSecret }}
            {{- end }}
          ports:
            {{- range $name, $port := .Values.containerPorts }}
            - name: {{ $name }}
              containerPort: {{ $port }}
              protocol: TCP
            {{- end }}
          {{- /* --- Probes: custom override takes priority, then default, then omit --- */}}
          {{- if .Values.customStartupProbe }}
          startupProbe:
            {{- toYaml .Values.customStartupProbe | nindent 12 }}
          {{- else if .Values.startupProbe.enabled }}
          startupProbe:
            {{- if .Values.startupProbe.httpGet }}
            httpGet:
              path: {{ .Values.startupProbe.httpGet.path }}
              port: {{ .Values.startupProbe.httpGet.port }}
            {{- else if .Values.startupProbe.tcpSocket }}
            tcpSocket:
              port: {{ .Values.startupProbe.tcpSocket.port }}
            {{- end }}
            initialDelaySeconds: {{ .Values.startupProbe.initialDelaySeconds | default 0 }}
            periodSeconds: {{ .Values.startupProbe.periodSeconds | default 10 }}
            timeoutSeconds: {{ .Values.startupProbe.timeoutSeconds | default 5 }}
            successThreshold: {{ .Values.startupProbe.successThreshold | default 1 }}
            failureThreshold: {{ .Values.startupProbe.failureThreshold | default 30 }}
          {{- end }}
          {{- if .Values.customLivenessProbe }}
          livenessProbe:
            {{- toYaml .Values.customLivenessProbe | nindent 12 }}
          {{- else if .Values.livenessProbe.enabled }}
          livenessProbe:
            {{- if .Values.livenessProbe.httpGet }}
            httpGet:
              path: {{ .Values.livenessProbe.httpGet.path }}
              port: {{ .Values.livenessProbe.httpGet.port }}
            {{- else if .Values.livenessProbe.tcpSocket }}
            tcpSocket:
              port: {{ .Values.livenessProbe.tcpSocket.port }}
            {{- end }}
            initialDelaySeconds: {{ .Values.livenessProbe.initialDelaySeconds | default 10 }}
            periodSeconds: {{ .Values.livenessProbe.periodSeconds | default 10 }}
            timeoutSeconds: {{ .Values.livenessProbe.timeoutSeconds | default 5 }}
            successThreshold: {{ .Values.livenessProbe.successThreshold | default 1 }}
            failureThreshold: {{ .Values.livenessProbe.failureThreshold | default 3 }}
          {{- end }}
          {{- if .Values.customReadinessProbe }}
          readinessProbe:
            {{- toYaml .Values.customReadinessProbe | nindent 12 }}
          {{- else if .Values.readinessProbe.enabled }}
          readinessProbe:
            {{- if .Values.readinessProbe.httpGet }}
            httpGet:
              path: {{ .Values.readinessProbe.httpGet.path }}
              port: {{ .Values.readinessProbe.httpGet.port }}
            {{- else if .Values.readinessProbe.tcpSocket }}
            tcpSocket:
              port: {{ .Values.readinessProbe.tcpSocket.port }}
            {{- end }}
            initialDelaySeconds: {{ .Values.readinessProbe.initialDelaySeconds | default 10 }}
            periodSeconds: {{ .Values.readinessProbe.periodSeconds | default 10 }}
            timeoutSeconds: {{ .Values.readinessProbe.timeoutSeconds | default 5 }}
            successThreshold: {{ .Values.readinessProbe.successThreshold | default 1 }}
            failureThreshold: {{ .Values.readinessProbe.failureThreshold | default 3 }}
          {{- end }}
          {{- with .Values.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- with .Values.lifecycleHooks }}
          lifecycle:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          volumeMounts:
            {{- if and .Values.persistence .Values.persistence.enabled }}
            - name: data
              mountPath: {{ .Values.persistence.mountPath | default "/data" }}
            {{- end }}
            {{- with .Values.extraVolumeMounts }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
        {{- with .Values.sidecars }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      volumes:
        {{- if and .Values.persistence .Values.persistence.enabled }}
        - name: data
          persistentVolumeClaim:
            claimName: {{ .Values.persistence.existingClaim | default (include "<CHART>.fullname" .) }}
        {{- end }}
        {{- with .Values.extraVolumes }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
```

---

## statefulset.yaml

Use instead of `deployment.yaml` for stateful workloads. Key differences from Deployment:

```gotemplate
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  serviceName: {{ printf "%s-headless" (include "<CHART>.fullname" .) }}
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  revisionHistoryLimit: {{ .Values.revisionHistoryLimit }}
  {{- with .Values.updateStrategy }}
  updateStrategy:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "<CHART>.selectorLabels" . | nindent 6 }}
  template:
    {{- /* Same pod template as deployment.yaml */}}
    ...
  {{- if and .Values.persistence .Values.persistence.enabled (not .Values.persistence.existingClaim) }}
  volumeClaimTemplates:
    - metadata:
        name: data
        labels:
          {{- include "<CHART>.selectorLabels" . | nindent 10 }}
        {{- with .Values.persistence.annotations }}
        annotations:
          {{- toYaml . | nindent 10 }}
        {{- end }}
      spec:
        accessModes:
          {{- range .Values.persistence.accessModes }}
          - {{ . | quote }}
          {{- end }}
        resources:
          requests:
            storage: {{ .Values.persistence.size | quote }}
        {{- if .Values.persistence.storageClass }}
        {{- if (eq "-" .Values.persistence.storageClass) }}
        storageClassName: ""
        {{- else }}
        storageClassName: {{ .Values.persistence.storageClass | quote }}
        {{- end }}
        {{- else if .Values.global }}
        {{- if .Values.global.storageClass }}
        storageClassName: {{ .Values.global.storageClass | quote }}
        {{- end }}
        {{- end }}
  {{- end }}
```

---

## service.yaml

```gotemplate
apiVersion: v1
kind: Service
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- if or .Values.service.annotations .Values.commonAnnotations }}
  annotations:
    {{- with .Values.commonAnnotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
    {{- with .Values.service.annotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- end }}
spec:
  type: {{ .Values.service.type }}
  {{- if and .Values.service.clusterIP (eq .Values.service.type "ClusterIP") }}
  clusterIP: {{ .Values.service.clusterIP }}
  {{- end }}
  {{- if or (eq .Values.service.type "LoadBalancer") (eq .Values.service.type "NodePort") }}
  externalTrafficPolicy: {{ .Values.service.externalTrafficPolicy | default "Cluster" }}
  {{- end }}
  {{- if and (eq .Values.service.type "LoadBalancer") .Values.service.loadBalancerIP }}
  loadBalancerIP: {{ .Values.service.loadBalancerIP }}
  {{- end }}
  {{- with .Values.service.loadBalancerSourceRanges }}
  loadBalancerSourceRanges:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- if .Values.service.sessionAffinity }}
  sessionAffinity: {{ .Values.service.sessionAffinity }}
  {{- end }}
  {{- with .Values.service.sessionAffinityConfig }}
  sessionAffinityConfig:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  ports:
    {{- range .Values.service.ports }}
    - name: {{ .name }}
      port: {{ .port }}
      targetPort: {{ .targetPort }}
      protocol: {{ .protocol | default "TCP" }}
      {{- if and (or (eq $.Values.service.type "NodePort") (eq $.Values.service.type "LoadBalancer")) .nodePort }}
      nodePort: {{ .nodePort }}
      {{- end }}
    {{- end }}
    {{- with .Values.service.extraPorts }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  selector:
    {{- include "<CHART>.selectorLabels" . | nindent 4 }}
```

For StatefulSets, add a headless service (`headless-svc.yaml`):

```gotemplate
{{- if eq .Values.workloadType "statefulset" }}
apiVersion: v1
kind: Service
metadata:
  name: {{ printf "%s-headless" (include "<CHART>.fullname" .) }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  clusterIP: None
  ports:
    {{- range .Values.service.ports }}
    - name: {{ .name }}
      port: {{ .port }}
      targetPort: {{ .targetPort }}
    {{- end }}
  selector:
    {{- include "<CHART>.selectorLabels" . | nindent 4 }}
{{- end }}
```

---

## ingress.yaml

```gotemplate
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- if or .Values.ingress.annotations .Values.commonAnnotations }}
  annotations:
    {{- with .Values.commonAnnotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
    {{- with .Values.ingress.annotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- end }}
spec:
  {{- if .Values.ingress.ingressClassName }}
  ingressClassName: {{ .Values.ingress.ingressClassName | quote }}
  {{- end }}
  rules:
    {{- if .Values.ingress.hostname }}
    - host: {{ .Values.ingress.hostname | quote }}
      http:
        paths:
          - path: {{ .Values.ingress.path | default "/" }}
            pathType: {{ .Values.ingress.pathType | default "Prefix" }}
            backend:
              service:
                name: {{ include "<CHART>.fullname" . }}
                port:
                  name: {{ .Values.ingress.servicePort | default "http" }}
    {{- end }}
    {{- range .Values.ingress.extraHosts }}
    - host: {{ .name | quote }}
      http:
        paths:
          - path: {{ .path | default "/" }}
            pathType: {{ .pathType | default "Prefix" }}
            backend:
              service:
                name: {{ include "<CHART>.fullname" $ }}
                port:
                  name: {{ $.Values.ingress.servicePort | default "http" }}
    {{- end }}
    {{- with .Values.ingress.extraRules }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- if or .Values.ingress.tls .Values.ingress.extraTls }}
  tls:
    {{- if .Values.ingress.tls }}
    - hosts:
        - {{ .Values.ingress.hostname | quote }}
      secretName: {{ printf "%s-tls" .Values.ingress.hostname | trunc 63 | trimSuffix "-" }}
    {{- end }}
    {{- with .Values.ingress.extraTls }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- end }}
{{- end }}
```

---

## hpa.yaml

```gotemplate
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "<CHART>.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPU }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPU }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemory }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemory }}
    {{- end }}
{{- end }}
```

---

## networkpolicy.yaml

```gotemplate
{{- if .Values.networkPolicy.enabled }}
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  podSelector:
    matchLabels:
      {{- include "<CHART>.selectorLabels" . | nindent 6 }}
  policyTypes:
    - Ingress
    - Egress
  egress:
    {{- toYaml .Values.networkPolicy.egress | nindent 4 }}
  ingress:
    {{- toYaml .Values.networkPolicy.ingress | nindent 4 }}
{{- end }}
```

---

## pdb.yaml

```gotemplate
{{- if .Values.pdb.create }}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.pdb.minAvailable }}
  minAvailable: {{ .Values.pdb.minAvailable }}
  {{- end }}
  {{- if or .Values.pdb.maxUnavailable (not .Values.pdb.minAvailable) }}
  maxUnavailable: {{ .Values.pdb.maxUnavailable | default 1 }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "<CHART>.selectorLabels" . | nindent 6 }}
{{- end }}
```

---

## serviceaccount.yaml

```gotemplate
{{- if .Values.serviceAccount.create }}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "<CHART>.serviceAccountName" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- if or .Values.serviceAccount.annotations .Values.commonAnnotations }}
  annotations:
    {{- with .Values.commonAnnotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
    {{- with .Values.serviceAccount.annotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  {{- end }}
automountServiceAccountToken: {{ .Values.serviceAccount.automountServiceAccountToken | default false }}
{{- end }}
```

---

## rbac.yaml

```gotemplate
{{- if .Values.rbac.create }}
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
rules:
  {{- toYaml .Values.rbac.rules | nindent 2 }}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: {{ include "<CHART>.fullname" . }}
subjects:
  - kind: ServiceAccount
    name: {{ include "<CHART>.serviceAccountName" . }}
    namespace: {{ .Release.Namespace | quote }}
{{- end }}
```

---

## configmap.yaml

```gotemplate
{{- if .Values.configMap }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
data:
  {{- range $key, $value := .Values.configMap }}
  {{ $key }}: {{ $value | quote }}
  {{- end }}
{{- end }}
```

---

## secret.yaml

```gotemplate
{{- if and .Values.secret (not .Values.secret.existingSecret) }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.commonAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
type: Opaque
data:
  {{- /* Preserve existing secret data across helm upgrade */}}
  {{- $existingSecret := lookup "v1" "Secret" .Release.Namespace (include "<CHART>.fullname" .) }}
  {{- range $key, $value := .Values.secret.data }}
  {{- if and $existingSecret (index $existingSecret.data $key) }}
  {{ $key }}: {{ index $existingSecret.data $key }}
  {{- else }}
  {{ $key }}: {{ $value | b64enc | quote }}
  {{- end }}
  {{- end }}
{{- end }}
```

---

## pvc.yaml (for Deployments only)

StatefulSets use `volumeClaimTemplates` instead. For Deployments with persistence:

```gotemplate
{{- if and .Values.persistence .Values.persistence.enabled (not .Values.persistence.existingClaim) }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "<CHART>.fullname" . }}
  namespace: {{ .Release.Namespace | quote }}
  labels:
    {{- include "<CHART>.labels" . | nindent 4 }}
  {{- with .Values.persistence.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  accessModes:
    {{- range .Values.persistence.accessModes }}
    - {{ . | quote }}
    {{- end }}
  resources:
    requests:
      storage: {{ .Values.persistence.size | quote }}
  {{- if .Values.persistence.storageClass }}
  {{- if (eq "-" .Values.persistence.storageClass) }}
  storageClassName: ""
  {{- else }}
  storageClassName: {{ .Values.persistence.storageClass | quote }}
  {{- end }}
  {{- else if .Values.global }}
  {{- if .Values.global.storageClass }}
  storageClassName: {{ .Values.global.storageClass | quote }}
  {{- end }}
  {{- end }}
{{- end }}
```

---

## NOTES.txt

```gotemplate
{{- $fullName := include "<CHART>.fullname" . -}}

1. Get the application URL by running these commands:

{{- if .Values.ingress.enabled }}
  http{{ if .Values.ingress.tls }}s{{ end }}://{{ .Values.ingress.hostname }}{{ .Values.ingress.path | default "/" }}
{{- else if contains "NodePort" .Values.service.type }}
  export NODE_PORT=$(kubectl get --namespace {{ .Release.Namespace }} -o jsonpath="{.spec.ports[0].nodePort}" services {{ $fullName }})
  export NODE_IP=$(kubectl get nodes --namespace {{ .Release.Namespace }} -o jsonpath="{.items[0].status.addresses[0].address}")
  echo http://$NODE_IP:$NODE_PORT
{{- else if contains "LoadBalancer" .Values.service.type }}
  NOTE: It may take a few minutes for the LoadBalancer IP to be available.
  export SERVICE_IP=$(kubectl get svc --namespace {{ .Release.Namespace }} {{ $fullName }} --template "{{"{{ range (index .status.loadBalancer.ingress 0) }}{{.}}{{ end }}"}}")
  echo http://$SERVICE_IP:{{ (index .Values.service.ports 0).port }}
{{- else if contains "ClusterIP" .Values.service.type }}
  kubectl --namespace {{ .Release.Namespace }} port-forward svc/{{ $fullName }} {{ (index .Values.service.ports 0).port }}:{{ (index .Values.service.ports 0).port }}
  echo "Visit http://127.0.0.1:{{ (index .Values.service.ports 0).port }}"
{{- end }}
```

---

## extra-list.yaml

```gotemplate
{{- range .Values.extraDeploy }}
---
{{ tpl (toYaml .) $ }}
{{- end }}
```

---

## .helmignore

```
.git
.gitignore
.idea/
*.swp
*.bak
*.tmp
*.orig
.project
.DS_Store
```
