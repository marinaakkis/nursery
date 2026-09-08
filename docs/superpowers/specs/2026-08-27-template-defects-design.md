# Template Defects Remediation Design

## Goal

Repair the nine reproduced defects from `template-defects.md` while preserving
the template's current CI policy and fail-closed integration governance.

## Canonical CI Security Block

The existing aggregate `main/ci@2.1.2` block in `.gitlab-ci.yml` is canonical.
Its exact contents will live in a dedicated template fixture. The validator will
extract the leading security block through the closing separator after `stages:`
and compare it to that fixture. Rules and skills will link to the fixture rather
than duplicating versions, components, or a fixed line count.

## Git Hook Installers

All four installers derive the repository root from Git, not from the directory
depth of the installer. This makes invocation location-independent and keeps the
existing metadata behaviour. Linux/macOS behaviour is exercised in a temporary
repository; PowerShell changes use the equivalent Git command and static checks
when PowerShell is unavailable.

## Integration Passport Lifecycle

Log names use normalized lower-kebab-case. Existing logs are authoritative for a
module and duplicates are reported rather than silently selected. A detector may
create a row with an empty Scope only when it cannot safely infer one; that first
run reports an actionable setup message instead of a generic malformed-log error.
Deletion detection is disabled for a module with no source files, preserving
design-stage integration records. Passport field labels remain parseable with or
without `[ОБЯЗАТЕЛЬНО]`. Pre-push without a Git `HEAD` succeeds with a concise
message.

## Skill Size

The Kubernetes deployment skill keeps routing, safety constraints, and workflow
selection in `SKILL.md`. Detailed provider/manifests/checklist material moves to
linked files in `references/`, keeping the entrypoint within the validator limit.

## Verification

Regression tests cover root resolution, CI block extraction and validation,
normalized and existing integration logs, unscoped-row guidance, no-code deletion
protection, optional passport markers, and an unborn `HEAD`. Existing unit tests,
template validation, generated Claude adapters/index, and an isolated Linux/macOS
installer smoke test are run before handoff.
