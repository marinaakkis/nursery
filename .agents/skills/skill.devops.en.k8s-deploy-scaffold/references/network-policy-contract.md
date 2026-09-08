# Golden contract for NetworkPolicy

Use this contract when generating or changing Helm `networkPolicy` values.

## Source of selector values

Do not invent labels and do not use `ipBlock: 10.0.0.0/8` for an in-cluster flow.

| Value | Authoritative source |
|---|---|
| `namespaceSelector.matchLabels.kubernetes.io/metadata.name` | Target namespace from the deployment environment or a cluster inventory. |
| `podSelector.matchLabels` for an application | `Deployment.spec.template.metadata.labels` or `Service.spec.selector` in the target-cluster inventory. |
| Kafka/Postgres/Redis/MinIO selector | Labels on the target workload Pods, not the Service name alone. |
| DNS selector | Labels of CoreDNS/kube-dns Pods plus their namespace from the cluster inventory. |
| External service destination | A platform-owned egress gateway selector, or an explicitly approved narrow CIDR. Never infer it from an FQDN or replace it with `10/8`. |

## Profile: shared `bcd-web`

For a shared application chart, derive the workload selector from the rendered Deployment or the cluster inventory. A common convention is:

```yaml
app.kubernetes.io/instance: <release-name>
app.kubernetes.io/name: bcd-web
```

Verify it against the inventory before using it. The release name alone is not sufficient for a special workload, listener, Job or StatefulSet.

Use this profile only when the workload actually has both labels. A Job, listener or StatefulSet may use different labels and requires its own inventory-confirmed selector.

```yaml
networkPolicy:
  enabled: true
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: <target-namespace> # REVIEW: inventory
          podSelector:
            matchLabels:
              app.kubernetes.io/instance: <caller-release>
              app.kubernetes.io/name: bcd-web
      ports:
        - protocol: TCP
          port: <service-port>
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: <target-namespace> # REVIEW: inventory
          podSelector:
            matchLabels:
              app.kubernetes.io/instance: <dependency-release>
              app.kubernetes.io/name: bcd-web
      ports:
        - protocol: TCP
          port: <dependency-port>
```

## Profile: standalone chart

Use this profile for a chart that owns its Deployment templates. The selector must match the chart's own selector helper, normally:

```yaml
app.kubernetes.io/name: <chart-name>
app.kubernetes.io/instance: <release-name>
```

Do not require `app.kubernetes.io/name: bcd-web` in this profile. Render the chart and compare the `NetworkPolicy.spec.podSelector` with the Deployment selector before delivery.

Use both namespace and Pod selectors for every cross-workload in-cluster rule:

```yaml
networkPolicy:
  enabled: true
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: <target-namespace> # REVIEW: inventory
          podSelector:
            matchLabels:
              app.kubernetes.io/instance: <caller-release>
              app.kubernetes.io/name: <caller-chart-name>
      ports:
        - protocol: TCP
          port: <service-port>
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: <target-namespace> # REVIEW: inventory
          podSelector:
            matchLabels:
              app.kubernetes.io/instance: <dependency-release>
              app.kubernetes.io/name: <dependency-chart-name>
      ports:
        - protocol: TCP
          port: <dependency-port>
```

Replace `<caller-chart-name>` and `<dependency-chart-name>` with `bcd-web` only for the shared profile. Rules are additive. Put all required callers in one `ingress` list and all dependencies in one `egress` list for the selected workload. Do not create a second policy for the same Pods unless it serves a distinct Job/StatefulSet selector.

## Exceptions

Use only one of these exceptions, with a comment naming the owner and reason:

```yaml
# External destination behind a platform egress gateway.
- to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: <egress-gateway-namespace> # REVIEW: inventory
      podSelector:
        matchLabels:
          app.kubernetes.io/name: <egress-gateway> # REVIEW: inventory
  ports:
    - protocol: TCP
      port: 443

# External destination without an egress gateway.
- to:
    - ipBlock:
        cidr: <approved-external-cidr> # REVIEW: platform/network owner
  ports:
    - protocol: TCP
      port: <port>
```

Never use a `0.0.0.0/0` or `10.0.0.0/8` exception. If the external CIDR is unknown, stop and request it; a restrictive but guessed CIDR is not safe.

## Generation and validation

1. Obtain a fresh inventory containing namespaces, workload labels, Services, CoreDNS, ingress controller and existing NetworkPolicy resources.
2. Build a flow table: caller workload, destination workload, destination port, reason.
3. Render the chart with its target namespace and check the generated `NetworkPolicy`.
4. Reject a rendered policy when it has a broad in-cluster `ipBlock`, an empty peer selector, a selector not present in inventory, or a duplicate policy that selects the same Pods with a superset of rules.
5. Keep application authentication and service identity checks: NetworkPolicy is a transport control, not authorization.
