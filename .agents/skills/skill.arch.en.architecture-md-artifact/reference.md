# architecture.md template reference

Use this template as a starting point when creating `docs/architecture.md`.

## Template

```markdown
# Architecture Overview and Component Catalog

<1-2 sentences: purpose and scope>

## 1. Navigation by Architecture Artifacts

### 1.1 Requirements (FR/NFR)

Table 1 - Requirements artifact map

| № | Document | What it describes | When to use | Комментарий |
|---|---|---|---|---|
| 1 | [`furps.<requirements-title-or-project-title>.md`](./requirements/furps.<requirements-title-or-project-title>.md) | FURPS requirements baseline | Functional + usability + reliability + performance + supportability baseline | - |
| 2 | [`fr.<requirements-title-or-project-title>.md`](./requirements/fr.<requirements-title-or-project-title>.md) | Functional requirements | Mandatory functional scope and behavior | - |
| 3 | [`nfr.<requirements-title-or-project-title>.md`](./requirements/nfr.<requirements-title-or-project-title>.md) | Non-functional requirements | Quality attributes, constraints, SLO/SLA expectations | - |

Table 2 - API requirements artifact map

| № | Document | What it describes | When to use | Комментарий |
|---|---|---|---|---|
| 1 | [`api.external.<system-name>.md`](./api-requirements/api.external.<system-name>.md) | External system interaction contract | Integration contract: endpoints, payloads, errors, limits, authentication/authorization model | - |
| 2 | [`api.<project-name>.<domain-or-service-or-controller-name>.md`](./api-requirements/api.<project-name>.<domain-or-service-or-controller-name>.md) | Service API contract for internal/external consumers | Service API contract including authn/authz expectations (roles/scopes/policies) | - |

### 1.2 Integrations and Workflows

Table 3 - Integration and workflow artifacts

| № | Document | What it describes | When to use | Комментарий |
|---|---|---|---|---|
| 1 | [`integrations/integrations-log.<project-name>.md`](./integrations/integrations-log.<project-name>.md) | Integration execution log and operational status | Integration reliability review and release readiness checks | - |
| 2 | [`integrations/integration-passport.<integration-name>.md`](./integrations/integration-passport.<integration-name>.md) | Formal integration passport with SLA, limits, dependencies and controls | Audit/compliance checks and production support onboarding | - |
| 3 | [`process-diagrams/README.md`](./process-diagrams/README.md) | Process diagrams index (`sd.*`, `wf.*`, `bpmn.*`) | Runtime flow analysis and interaction review | - |

### 1.3 C4 Architecture (assets-first)

Table 4 - C4 architecture artifact map

| № | Document | What it describes | When to use | Комментарий |
|---|---|---|---|---|
| 1 | [`architecture.md`](./architecture.md) | Aggregated C4-oriented architecture description and component catalog | Primary static architecture narrative and C1/C2/C3 traceability | - |

Table 5 - C4 diagram assets

| № | Diagram asset | What it describes | When to use | Комментарий |
|---|---|---|---|---|
| 1 | [`c1.<diagram-title>.<ext>`](./c4-diagrams/c1.<diagram-title>.<ext>) | C1 context view | System boundary and external actors/systems | Use C4 naming pattern `<c4-level>.<diagram-title>.<ext>`. |
| 2 | [`c2.<diagram-title>.<ext>`](./c4-diagrams/c2.<diagram-title>.<ext>) | C2 container view | Container-level decomposition | Use lowercase kebab-case title. |
| 3 | [`c3.<diagram-title>.<ext>`](./c4-diagrams/c3.<diagram-title>.<ext>) | C3 component view | Component-level decomposition | For dynamic C4 use prefix `c4d.`. |

### 1.4 Process Diagrams

Table 6 - Process diagram assets

| № | Diagram asset | What it describes | When to use | Комментарий |
|---|---|---|---|---|
| 1 | [`sd.<diagram-title>.<ext>`](./process-diagrams/sd.<diagram-title>.<ext>) | Sequence flow | Request-response and runtime call ordering | Use `sd.` prefix. |
| 2 | [`wf.<title>.<ext>`](./process-diagrams/wf.<title>.<ext>) | Workflow/process flow | Operational or business process paths | Use `wf.` prefix. |
| 3 | [`bpmn.<title>.<ext>`](./process-diagrams/bpmn.<title>.<ext>) | BPMN process model | Formal business process modeling | Use `bpmn.` prefix. |

### 1.5 ADR Log

Table 7 - ADR register

| № | ADR | Status | Decision summary | Why it matters | Комментарий |
|---|---|---|---|---|---|
| 1 | [`adr.<nnn>.<kebab-case-title>.md`](./adr-log/adr.<nnn>.<kebab-case-title>.md) | Accepted/Proposed/... | ... | ... | - |

### 1.6 DDS Log

Table 8 - DDS register

| № | DDS | Status | Decision summary | Why it matters | Комментарий |
|---|---|---|---|---|---|
| 1 | [`dds.<nnn>.<kebab-case-title>.md`](./dds-log/dds.<nnn>.<kebab-case-title>.md) | Accepted/Proposed/... | ... | ... | - |

## 2. Component Catalog (up to C3)

### 2.1 C1: System Context Elements

Table 9 - C1 system context catalog

| № | Название элемента | C4-тип | Ответственность | Отражен в | Комментарий |
|---|---|---|---|---|---|
| 1 | ... | Person / Software System | ... | C1, C2 (architecture.md), Sequence (process-diagrams/sd.<diagram-title>.<ext>) | ... |

### 2.2 C2: Containers

Table 10 - C2 container catalog

| № | Контейнер | Тип | Технологии | Ответственность | Ключевые взаимодействия | Отражен в | Комментарий |
|---|---|---|---|---|---|---|---|
| 1 | ... | Container | ... | ... | ... | C2, C3 (architecture.md), Sequence (process-diagrams/sd.<diagram-title>.<ext>) | ... |

### 2.3 C3: Components

Table 11 - C3 component catalog

| № | Компонент | Тип | Роль в сценарии | Вход/выход | Связи | Отражен в | Комментарий |
|---|---|---|---|---|---|---|---|
| 1 | ... | Component/Service/Policy/Adapter | ... | ... | ... | C3 (architecture.md), Sequence (process-diagrams/sd.<diagram-title>.<ext>) | - |

### 2.4 Sequence Participant Mapping

Table 12 - Sequence to C4/C3 mapping

| № | Sequence participant | Participant type | Mapping to C4/C3 | Notes | Комментарий |
|---|---|---|---|---|---|
| 1 | ... | Internal/External/Actor | ... | ... | - |

## 3. Diagram-to-Catalog Consistency

Table 13 - Consistency checks

| № | Check | Current status | Комментарий |
|---|---|---|---|
| 1 | Every C4 element has a catalog row | Done/TBD | - |
| 2 | Every sequence participant is mapped to C1/C2/C3 | Done/TBD | - |
| 3 | ADR/DDS decisions are reflected in components/interactions | Done/TBD | - |

<Short rule: updates must keep both docs and diagrams synchronized>
```

## Quick quality checks

- Keep section titles stable for discoverability.
- Keep tables compact and factual.
- Number all tables continuously using `Table <N> - <title>`.
- Start every table with `№` and end every table with `Комментарий`.
- Follow fixed C1/C2/C3 column contracts and order.
- Keep row numbering in `№` for all C1/C2/C3 tables.
- Fill `Отражен в` using variant B: fixed level codes + optional artifact names in parentheses.
- Store C4 diagram assets under `docs/c4-diagrams/`.
- Store BPMN/sequence/workflow assets under `docs/process-diagrams/`.
- Process-diagram baseline is at least one relevant asset (`sd.*` or `wf.*` or `bpmn.*`), not mandatory all three.
- If process-diagram type is ambiguous, clarify preferred format with user before generating.
- Store requirements artifacts under `docs/requirements/`.
- Store API requirement artifacts under `docs/api-requirements/`.
- Name requirements docs with `furps.<requirements-title-or-project-title>.md`.
- Name FR docs with `fr.<requirements-title-or-project-title>.md`.
- Name NFR docs with `nfr.<requirements-title-or-project-title>.md`.
- Name external API contracts as `api.external.<system-name>.md`.
- Name service API contracts as `api.<project-name>.<domain-or-service-or-controller-name>.md`.
- Enforce strict regex for created requirement/API docs:
  - `^furps\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - `^fr\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - `^nfr\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - `^api\.external\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - `^api\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
- Enforce strict regex for created diagram assets:
  - `^(c1|c2|c3|c4d)\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
  - `^sd\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
  - `^wf\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
  - `^bpmn\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$`
- Enforce strict regex for integration docs:
  - `^integrations-log\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
  - `^integration-passport\.[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
- Use fixed names for core root docs in module `docs/`:
  - `README.md`
  - `architecture.md`
- Keep output artifact specification in a dedicated section of `docs/README.md` (for example `Output Artifacts Specification`) instead of a standalone mandatory markdown file.
- Name C4 diagrams as `<c4-level>.<diagram-title>.<ext>` (`c1`, `c2`, `c3`, `c4d`).
- Name sequence diagrams as `sd.<diagram-title>.<ext>`.
- Name BPMN diagrams as `bpmn.<title>.<ext>`.
- Name workflow diagrams as `wf.<title>.<ext>`.
- Keep `architecture.md` as single source for index/catalog/consistency.
- Optional C4 summary docs must stay concise and link-driven.
- Do not duplicate full content from linked documents.
- Use links + annotations, not copy-paste.
- Prefer exact naming parity with diagrams.
