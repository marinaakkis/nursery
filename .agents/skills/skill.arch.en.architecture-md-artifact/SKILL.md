---
name: skill.arch.en.architecture-md-artifact
description: Creates or updates docs/architecture.md as a mandatory architecture index and component catalog artifact when generating documentation from a source specification. Use when the user asks to generate architecture artifacts, derive docs from specifications, or requests architecture.md with linked ADR/DDS/C4/sequence/requirements sections.
---

# Architecture.md as Mandatory Documentation Artifact

This skill defines how to create and maintain `architecture.md` as a core artifact in documentation sets generated from a source specification.

> **Scope is GLOBAL.** `architecture.md` indexes **system-level** architecture (system C4, ADR/DDR, process diagrams, ERD, contracts, integrations). It **MUST NOT** index or link per-dev-request artifacts under `docs/dev-requests/**` — those are ephemeral working tasks published to external storage and must not be referenced from permanent docs (`rule.governance.ru.docs-no-dev-requests-links`).

**Priority:** follow explicit user instructions and repository rules first. If they do not conflict, apply this workflow.

## When to Apply

- The user asks to generate architecture documents from a specification.
- The user mentions a source-of-truth specification file.
- The user asks to create or refresh `docs/architecture.md`.
- Existing architectural docs (`ADR`, `DDS`, `C4`, sequence, requirements, integrations) were changed and need a synchronized index.
- The `actualize-main-docs` command actualizes global `docs/` from a finished dev-request's design artifacts (see below).

## Actualization targets (used by `command.ai-sdlc.ru.actualize-main-docs`)

This skill is the authoring engine when a dev-request's design artifacts are actualized into the **global** `docs/`. Besides the `architecture.md` index, it creates/updates the corresponding global artifact files:

| Global target dir | Source (dev-request design) | Notes |
|---|---|---|
| `docs/c4-diagrams/` | system-level C4 (C2/C3) | local task-only C3 detail is not included |
| `docs/adr-log/` | key ADR/DDR | only architecturally significant decisions |
| `docs/process-diagrams/` | global DFD/Sequence/Workflow/BPMN | only system-wide flows |
| `docs/data-models/` | system ERD | — |
| `docs/api-requirements/` | inter-service / external contracts | — |

Rules when actualizing:
- **Synthesis, not links** — copy/synthesize content into `docs/`; never link into `docs/dev-requests/**` (`rule.governance.ru.docs-no-dev-requests-links`).
- **Idempotent** — re-running updates the same target; prefer updating between `<!-- AUTOGEN:start --> … <!-- AUTOGEN:end -->` markers or a clearly bounded section, not a blind overwrite.
- **Profile-aware** — if the source dev-request ran in `docs=compact` (table-equivalents instead of Mermaid), expand tables into diagrams for the human-facing global `docs/` where a diagram is the canonical form.
- After actualization, refresh the `architecture.md` index to reference the updated global artifacts.

## Objective

Produce a self-contained `docs/architecture.md` that:

1. Aggregates architecture artifacts via links with short annotations.
2. Includes dedicated ADR and DDS tables.
3. Includes a component catalog up to C3 level.
4. Enforces bidirectional consistency:
   - what is on C4/sequence diagrams must be described in component catalog;
   - what is in component catalog must be represented on diagrams.

## Anti-Duplication Rule (Current Case)

- `docs/architecture.md` is the single source of truth for:
  - architecture index/navigation;
  - C1/C2/C3 component catalog;
  - consistency checks.
- C4 diagram content should live in `docs/c4-diagrams/` assets.
- Do not introduce separate optional C4 summary markdown files (for example `docs/architecture-c3.md`) as parallel architecture sources; keep the C4 textual summary in `docs/architecture.md`.
- Do not keep two full documents that both contain full C1/C2/C3 narrative + catalog (avoid duplicated maintenance surfaces).

## Placement and Scope

| Item | Rule |
|---|---|
| Output file | Create/update `architecture.md` inside the target module `docs/` folder. |
| Links in `docs/` | Do not add markdown links from `docs/` to `.input/`. |
| Links to dev-requests | Do not link from `docs/` (outside `docs/dev-requests/`) into `docs/dev-requests/**`; that content is ephemeral and moves to external storage (`rule.governance.ru.docs-no-dev-requests-links`). |
| Path style | Use relative links between files in the same `docs/` folder. |
| Source input | Use specification + already generated docs as source context; keep final text self-contained. |

## Diagram Storage Rules

Use mandatory diagram directories inside module `docs/`:

- C4 diagrams (`C1`, `C2`, `C3`, optional C4 dynamic) -> `docs/c4-diagrams/`.
- Process diagrams (`BPMN`, `sequence`, `workflow`, similar process-flow views) -> `docs/process-diagrams/`.
- Data Flow diagrams (`DFD`) -> `docs/process-diagrams/`.

If `architecture.md` references diagrams directly, links must target these folders.

## Requirements Storage and Naming Rules

Requirements documents must be stored in:

- `docs/requirements/`
- `docs/api-requirements/` (for API contracts and service interaction requirements)

Naming patterns:

- FURPS: `furps.<requirements-title-or-project-title>.md`
- FR: `fr.<requirements-title-or-project-title>.md`
- NFR: `nfr.<requirements-title-or-project-title>.md`

Naming notes:

- `<requirements-title-or-project-title>` uses lowercase `kebab-case`.
- Use consistent naming across all requirement docs in one module.

API requirement naming patterns:

- External integration contract: `api.external.<system-name>.md`
- Current service API contract: `api.<project-name>.<domain-or-service-or-controller-name>.md`

API naming notes:

- `<system-name>`, `<project-name>`, `<domain-or-service-or-controller-name>` use lowercase `kebab-case`.
- Preserve prefix semantics: `api.external.` for external systems, `api.<project-name>.` for internal service API surface.
- API requirement content must explicitly cover authentication and authorization approach (authn/authz), not only endpoint contracts.

Strict naming contract (MUST):

- Create requirement files only if they match strict regex:
  - `^furps\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - `^fr\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - `^nfr\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
- Create API requirement files only if they match strict regex:
  - External: `^api\.external\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - Service: `^api\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
- Create diagram assets only if they match strict regex:
  - C4: `^(c1|c2|c3|c4d)\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
  - Sequence: `^sd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
  - Workflow: `^wf\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
  - BPMN: `^bpmn\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
  - DFD: `^dfd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
- Create integration docs only if they match strict regex:
  - Integration log: `^integrations-log\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - Integration passport: `^integration-passport\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
- Do not create files with alternative prefixes/suffixes outside these contracts.
- For requirement/API docs in these folders, extension is strictly `.md`.
- Core root docs in module `docs/` must use fixed names:
  - `README.md`
  - `architecture.md`
- Output artifact specification must be documented in a dedicated section of `docs/README.md` (for example `Output Artifacts Specification`), not as a mandatory standalone file.
- Runtime scenarios/process flow are documented inside `architecture.md` and diagram assets under `docs/process-diagrams/` (`sd.*`, `wf.*`, `bpmn.*`) rather than in a mandatory standalone workflow markdown file.
- For process diagrams, at least one of (`dfd.*`, `sd.*`, `wf.*`, `bpmn.*`) is required, chosen by scenario complexity and documentation goal; creating all four types simultaneously is not mandatory.
- If process diagram type is ambiguous from context, ask the user before generating the asset. To determine the appropriate type, refer to: `skill.arch.ru.sequence-diagrams` (request-response flows), `skill.arch.ru.workflow-diagrams` (operational/business process paths), `skill.arch.ru.bpmn-diagrams` (formal BPMN process models).

## Diagram Naming Rules

Use file names without spaces, with lowercase `kebab-case` titles.

### C4 diagrams

Pattern:

`<c4-level>.<diagram-title>.<ext>`

Where `<c4-level>` is one of:

- `c1`
- `c2`
- `c3`
- `c4d` (for C4 dynamic views)

### Sequence diagrams

Pattern:

`sd.<diagram-title>.<ext>`

### BPMN diagrams

Pattern:

`bpmn.<title>.<ext>`

### Workflow diagrams

Pattern:

`wf.<title>.<ext>`

### DFD diagrams

Pattern:

`dfd.<diagram-title>.<ext>`

Where `<diagram-title>` may encode the DFD level (e.g., `l0-context`, `l1-payments`) for multi-level sets or use a plain descriptive title for single-level assets.

General notes:

- `<diagram-title>` / `<title>` uses lowercase `kebab-case` (`a-z`, `0-9`, `-`).
- `<ext>` depends on tooling (`mmd`, `puml`, `bpmn`, `svg`, `png`, etc.).
- Keep naming scheme consistent within one module.

## Required Sections in `architecture.md`

Use the template from [reference.md](reference.md) as the starting point for this structure.

Use this minimum structure (titles may vary slightly, meaning must stay):

1. **Architecture Overview**
   - Short purpose of the document.
2. **Navigation by Artifact Types**
   - Requirements (FR/NFR, FURPS+).
   - Integrations and workflow/sequence.
   - C4 views.
   - DFD views (if present).
   - ADR table.
   - DDS table.
3. **Component Catalog (C1/C2/C3)**
   - C1 entities (people + software systems).
   - C2 containers.
   - C3 components.
   - Sequence participants mapping to C4/C3 elements.
4. **Consistency Rules**
   - Explicit statement and checklist/table confirming diagram-to-catalog alignment.

## Artifact Linking Rules

For each linked file in `architecture.md`:

- Add a short annotation on **what** it describes.
- Add a short annotation on **when** to use it.
- Prefer tables for discoverability.
- Number every table in document order and add a caption line before each table:
  - `Table <N> - <short title>`
  - numbering must be continuous across the whole `architecture.md` file (`1, 2, 3...` without gaps).

Mandatory link groups:

- **MUST** requirements document(s) (functional + non-functional constraints).
- **MUST** integration/API and workflow/sequence document(s).
- **MUST** C4 diagram assets for context/container/component views.
- **OPTIONAL (if present)** optional concise C4 summary document (if the module keeps one).
- **MUST** All ADR files matching `docs/adr-log/adr.<nnn>.<kebab-case-title>.md`.
- **MUST** All DDS files matching `docs/dds-log/dds.<nnn>.<kebab-case-title>.md`.
- **OPTIONAL (if present)** C4 diagram assets from `docs/c4-diagrams/`.
- **OPTIONAL (if present)** DFD diagram assets from `docs/process-diagrams/` matching `dfd.*`.
- **OPTIONAL (if present)** process diagram assets from `docs/process-diagrams/` matching `sd.*`, `wf.*`, `bpmn.*`.
- **OPTIONAL (if present)** requirements assets from `docs/requirements/`, including FURPS/FR/NFR docs by naming pattern.
- **OPTIONAL (if present)** API requirements assets from `docs/api-requirements/`, including:
  - `api.external.<system-name>.md`
  - `api.<project-name>.<domain-or-service-or-controller-name>.md`

If a group has no files yet, keep a placeholder row with `TBD`.

## Universal Table Contract

Apply this to every table in `architecture.md` (not only C1/C2/C3):

- First column is always `№` (row numbering).
- Last column is always `Комментарий`.
- `Комментарий` may be filled by the user or by AI:
  - on user request;
  - proactively by AI when an observation, note, assumption, risk, limitation, or caveat must be preserved but does not fit other columns.
- If there is no note, use `-` in `Комментарий`.

## Component Catalog Rules (C3 Depth)

The catalog must include every architecture element used in static and dynamic views:

| Level | Minimum coverage |
|---|---|
| C1 | Actors, system-in-focus, external systems. |
| C2 | All internal containers shown on C4 container view. |
| C3 | Core internal components from component view (or clearly planned target C3 decomposition). |
| Sequence | All participants mapped to C1/C2/C3 entities with explanation of abstraction level. |

For each row, include at least:

- Name
- Type/level
- Responsibility
- Key interactions or input/output
- Where represented (C1/C2/C3/Sequence)

Additional mandatory typing for component catalog:

- C2 container table must include an explicit `Type` column (for example `Container`).
- C3 component table must include an explicit `Type` column (for example `Component`, `Service`, `Policy`, `Adapter`).

## Exact Column Contracts for C1/C2/C3 Tables

> **Note:** Column names in C1/C2/C3 tables use Russian labels as specified below. This is intentional — it keeps consistency with existing project documentation standards.

Use the exact mandatory column order below.

### C1 table contract

Mandatory columns (fixed order):

`№ | Название элемента | C4-тип | Ответственность | Отражен в | Комментарий`

Rules:

- `Комментарий` is optional by content, but the column is present in the table.
- `C4-тип` allowed values: `Software System`, `External Software System`, `Person`, `Deployment Node`, `Infrastructure Node`, `Data Store`.

### C2 table contract

Mandatory columns (fixed order):

`№ | Контейнер | Тип | Технологии | Ответственность | Ключевые взаимодействия | Отражен в | Комментарий`

Rules:

- `Тип` allowed values: `Container`, `Deployment Node`, `Infrastructure Node`, `Data Store`.
- For `Data Store`, `Deployment Node`, `Infrastructure Node`, technology stack is still required in `Технологии`.

### C3 table contract

Mandatory columns (fixed order):

`№ | Компонент | Тип | Роль в сценарии | Вход/выход | Связи | Отражен в | Комментарий`

Rules:

- `Тип` baseline whitelist:
  - `Component`, `Service`, `Policy`, `Resolver`, `Mapper`, `Validator`, `Command`, `Query`, `Handler`, `Builder`, `Adapter`, `Client`, `Provider`, `Strategy`, `Factory`, `Controller`, `Dto`, `Entity`, `DbContext`, `Context`.
- Additional GoF-derived or supporting types (`Extensions`, `Helper`, `Manager`, `Constants`, etc.) are allowed only when contextually justified and agreed. If the type is absent from the whitelist, justify the choice in the `Комментарий` column.

### Shared rules for all C1/C2/C3 tables

- Row numbering is mandatory in column `№`.
- `Отражен в` must use the fixed format (variant B):
  - fixed level codes from `C1`, `C2`, `C3`, `Sequence`;
  - optionally add concrete artifact names in parentheses.
  - format pattern: `<LEVEL>, <LEVEL> (<artifact-file>.md), <LEVEL> (<artifact-file>.md)`.
- Last column is `Комментарий`; use it for notes outside scope of other columns.

## Related Skills

| Skill | When to use |
|---|---|
| `skill.arch.ru.c4-diagrams` | Generating C1/C2/C3/C4d diagram assets stored in `docs/c4-diagrams/`. |
| `skill.arch.ru.sequence-diagrams` | Generating `sd.*` sequence diagrams stored in `docs/process-diagrams/`. |
| `skill.arch.ru.workflow-diagrams` | Generating `wf.*` workflow diagrams stored in `docs/process-diagrams/`. |
| `skill.arch.ru.bpmn-diagrams` | Generating `bpmn.*` BPMN diagrams stored in `docs/process-diagrams/`. |
| `skill.arch.ru.dfd-diagrams` | Generating `dfd.*` data flow diagrams stored in `docs/process-diagrams/`. |
| `skill.arch.ru.erd-diagrams` | Generating ERD diagrams for data model documentation. |
| `skill.integration.ru.api-endpoint-doc` | Documenting individual REST API endpoints linked from `docs/api-requirements/`. |
| `skill.integration.ru.integration-doc` | Documenting integration passports linked from `docs/integrations/`. |

## Update Workflow

**Pre-condition:** If `docs/architecture.md` does not exist — use the template from [reference.md](reference.md) as the base for the new file. If it exists — execute steps 1–9 below to update it.

1. Read existing docs in the target module `docs/`.
2. Collect existing ADR/DDS files and include them in tables.
3a. Build/update the **Navigation** section — link all requirements, integration, C4, process diagram, ADR, DDS, and API artifacts; use TBD placeholder rows for missing files.
3b. Build/update the **Component Catalog** (C1, C2, C3 tables and sequence participant mapping) following exact column contracts.
3c. Build/update the **Consistency Rules** section — fill the consistency check table confirming diagram-to-catalog alignment.
4. Ensure names used in component catalog match diagram naming.
5. Ensure C4 diagram files are stored in `docs/c4-diagrams/`; process diagrams (including DFD `dfd.*` when present) are stored in `docs/process-diagrams/`.
6. Ensure requirements files are stored under `docs/requirements/` and follow `furps.*`, `fr.*`, `nfr.*` naming patterns.
7. Ensure API requirement files are stored under `docs/api-requirements/` and follow `api.external.*` and `api.<project-name>.*` naming patterns.
8. Update `docs/README.md` to include `architecture.md` in the main artifacts table if missing.
9. Re-check that there are no links from `docs/` to `.input/`, and no links from `docs/` (outside `docs/dev-requests/`) into `docs/dev-requests/**` (`rule.governance.ru.docs-no-dev-requests-links`).

**Sync rule:** If table contracts (C1/C2/C3 column order or allowed types) change, update all three artifacts in the same task:
- `.agents/skills/skill.arch.en.architecture-md-artifact/SKILL.md`
- `.agents/skills/skill.arch.en.architecture-md-artifact/reference.md`
- active module `docs/architecture.md`

## Definition of Done

- [ ] `docs/architecture.md` exists.
- [ ] Document contains annotated links across requirements, integrations, workflows, C4, ADR, DDS.
- [ ] Every table has mandatory numbering (`Table <N> - <title>`) with continuous order.
- [ ] Every table starts with `№` and ends with `Комментарий`.
- [ ] C1/C2/C3 tables follow exact mandatory column contracts and order.
- [ ] Every C1/C2/C3 table has row numbering in `№`.
- [ ] ADR and DDS are represented as separate tables with status and short rationale.
- [ ] Component catalog covers C1/C2/C3 and sequence participants mapping.
- [ ] Consistency rule between diagrams and component catalog is explicit.
- [ ] C4 diagrams are stored under `docs/c4-diagrams/`.
- [ ] `dfd.*` diagrams, if present, are stored under `docs/process-diagrams/`.
- [ ] DFD file names follow `^dfd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`.
- [ ] BPMN/sequence/workflow diagrams are stored under `docs/process-diagrams/`.
- [ ] Requirements docs are stored under `docs/requirements/`.
- [ ] FURPS/FR/NFR file names follow `furps.*`, `fr.*`, `nfr.*`.
- [ ] API requirement docs are stored under `docs/api-requirements/`.
- [ ] API requirement file names follow `api.external.<system-name>.md` and `api.<project-name>.<domain-or-service-or-controller-name>.md`.
- [ ] Diagram asset names follow strict patterns for `c1/c2/c3/c4d`, `sd`, `wf`, `bpmn`.
- [ ] Integration doc names follow `integrations-log.<project-name>.md` and `integration-passport.<integration-name>.md`.
- [ ] Core root docs use fixed names: `README.md`, `architecture.md`.
- [ ] Output artifact specification is captured in `docs/README.md` section (for example `Output Artifacts Specification`).
- [ ] Runtime scenarios are captured in `architecture.md` and/or `docs/process-diagrams/` assets (`sd.*`, `wf.*`, `bpmn.*`) without a required standalone workflow markdown file.
- [ ] Process-diagram baseline is satisfied: at least one process diagram from (`dfd.*`, `sd.*`, `wf.*`, `bpmn.*`) is present; creating all four types simultaneously is not mandatory.
- [ ] `docs/README.md` references `architecture.md`.
- [ ] No duplicate full C1/C2/C3 narrative across `architecture.md` and optional C4 summary docs.
- [ ] No forbidden links from `docs/` to `.input/`.
- [ ] No links from `docs/` (outside `docs/dev-requests/`) into `docs/dev-requests/**`; `architecture.md` indexes GLOBAL system artifacts, not per-dev-request.

Detailed templates and fill patterns are in [reference.md](reference.md).
