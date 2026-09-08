# Operations Reference

Use this for review and troubleshooting.

## Safety Checklist

- `enabled: false` is committed for every job.
- `JOB_KEY` exactly matches `bcd-web.jobs.<job-key>`.
- `JOB_TEMPLATE` is `charts/bcd-web/templates/job.yaml`.
- `JOB_VALUES_PATH` is `bcd-web.jobs`.
- Deploy, rollback, and one-off jobs use the same `resource_group`.
- `backoffLimit: 0` is set for non-idempotent work.
- `JOB_TIMEOUT` is slightly greater than `activeDeadlineSeconds`.
- `runAsUser` and `runAsGroup` are inherited or explicitly set.
- Secrets are referenced by Secret name, never placed in `command` or `args`.
- Logs are inspected in Kubernetes; CI uses `JOB_STREAM_LOGS: "false"` by
  default.

## Failure Diagnosis

| Symptom | Check |
|---|---|
| No Job rendered | `JOB_KEY`, `JOB_VALUES_PATH`, chart dependency, values path |
| Envsubst fails | unset `${VAR}`, wrong variable name, broken fallback expression |
| Wrong image tag | rendered values and `${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}` |
| Helm ownership error | changed `HELM_RELEASE` or fullname override |
| Job exists but pod does not start | quota, admission policy, pull secret, scheduler |
| ImagePullBackOff | image suffix, tag pushed, registry secret |
| Permission denied | non-root uid/gid, file ownership, read-only filesystem |
| DeadlineExceeded | NetworkPolicy, DB locks, source system timeout, script hang |
| DNS errors | egress policy lacks TCP/UDP 53 |

## Data-Migration Checklist

For legacy imports and backfills, require:

- source system and target system;
- credentials through Kubernetes Secrets;
- stable idempotency key;
- upsert/conflict behavior;
- batch size;
- dry-run or verification mode when practical;
- resume behavior after partial success;
- expected runtime;
- compensating operation when needed.

Prefer:

- upsert by stable business key;
- source external IDs stored in target;
- checkpoints after successful batches;
- separate migration-only Secret when app restart must be avoided;
- logs with counts and skipped identifiers, not full payloads or secrets.

## Anti-Patterns

Flag these:

- Helm hook for manual destructive operations.
- Automatic DB downgrade during Helm rollback.
- CI runner connecting directly to application DB.
- Pre-deploy migrate-up job when app startup intentionally applies `up`.
- `IMAGE_TAG` computed in CI instead of values fallback.
- Secrets in `command`, `args`, logs, or saved artifacts.
- Large default CPU/memory limits that hit namespace quota.
- YAML anchors referenced from blocks developers may comment out.
- Changing `HELM_RELEASE` and breaking Helm ownership.

