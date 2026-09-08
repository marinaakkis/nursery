# Repository conventions — route66 & route66_ldap_groups

Extracted directly from the repos. Do not invent. If a convention is not listed here, search the repo before adding anything new.

## route66 (Keycloak clients)

### Layout
- All Terraform code lives in `route66/TFCODE/`.
- Standalone client files use one of:
  - `<app_name>.tf` (e.g. `airflow_client.tf`, `abscan.tf`, `atlas-hcm-web.tf`)
  - `<app_name>_client.tf` for OIDC, `<app_name>_saml.tf` for SAML
- The aggregated "simple" path `typical_oidc_clients.tf` + `create_clients_foreach.tf` exists. **The skill does not use it** — it is hard to extend cleanly with custom mappers and roles, and the standalone-file pattern is what every non-trivial client uses.

### Provider
- `mrparkers/keycloak v4.3.1` (declared in `TFCODE/providers.tf`)
- Provider URL: `https://route66.anonymized-domain.ru`

### Realms
- `keycloak_realm.biocad` — **the** realm for application clients. LDAP-backed (corporate AD).
- `keycloak_realm.external` — public registration realm. **No application clients live here today.** Only ask the developer about this realm if they explicitly mention external/customer-facing self-registration. Note: this realm uses a different realm_id reference (`keycloak_realm.external.id` vs `keycloak_realm.biocad.id`).

### Required boilerplate on every OIDC client
- `realm_id = keycloak_realm.example-company.id`
- `enabled = true`
- `login_theme = "keycloak"`
- `authentication_flow_binding_overrides { browser_id = keycloak_authentication_flow.custom-browser-login.id }`

### Roles + AD group binding
- Module: `./modules/keycloak_client_roles` (source: `route66/TFCODE/modules/keycloak_client_roles/main.tf`)
- Inputs:
  ```hcl
  module "keycloak_<app_name>_roles" {
    source    = "./modules/keycloak_client_roles"
    realm_id  = keycloak_realm.biocad.id
    client_id = keycloak_openid_client.<app_name>.id
    roles = [
      { name = "<role_name>", description = "<desc>", ldap_group_name = "KC-Role-<lower(app)>-<lower(role)>" }
    ]
  }
  ```
- Module behavior:
  - Creates `keycloak_role` per role
  - **Reads** the AD group via `data "keycloak_group"` (so the group must exist in Keycloak — i.e. the `route66_ldap_groups` MR must be merged and applied first, and LDAP→Keycloak sync must have completed; up to 15 minutes per the README)
  - Binds the role to the group via `keycloak_group_roles`

### Standard mappers
- `keycloak_openid_user_attribute_protocol_mapper` — `LDAP_ID` → claim `object_guid` (always include for biocad realm clients; pattern visible in `create_clients_foreach.tf` and `abscan.tf`)
- `keycloak_openid_user_client_role_protocol_mapper` — claim `resource_access.$${client_id}.roles`, `multivalued = true` (include when there are roles)
- `keycloak_openid_audience_protocol_mapper` — include for `client_credentials` (so the issued token has the target API as `aud`) and for any client that is going to be called by another service

### client_secret handling
- The repo has a mix:
  - Some clients hardcode UUIDs as `client_secret` (e.g. `atlas-hcm-web.tf`, several entries inside `typical_oidc_clients.tf`). **This is wrong** and the skill must not reproduce it.
  - Other clients omit `client_secret` entirely; Keycloak generates one and DevOps reads it from the Admin UI.
- The skill always uses the second pattern: omit `client_secret`, leave a comment pointing to `MR-README-*.md` for the post-merge step.

### Secret-store relationship
- `provider "vault"` is declared in `providers.tf` but no `data "vault_generic_secret"` references exist for client secrets. Vault is used for pipeline-time CI secrets (`kk_main_secret`, `azure_client_secret`, `ad_bind_secret`, `t1_svc_keycloak_password`) — see `.gitlab-ci.yml`. The skill does **not** generate Vault data sources for client secrets.

### CI / state
- GitLab managed Terraform state (`backend "http"`)
- Pipeline stages: validate → test (tfsec) → build (plan) → deploy (apply on `main`)
- `gitlab-terraform fmt` runs on every MR. Generated `.tf` must be `terraform fmt`-clean — keep indentation 2 spaces, align `=` within blocks.

### SAML
- `keycloak_saml_client` resource pattern is in `jira_saml.tf`, `confluence-saml-client.tf`, `mtslink_saml.tf`, `passwork_saml.tf`, etc.
- Common attributes: `signature_algorithm = "RSA_SHA256"`, `client_signature_required = false`, `sign_documents = true`, `sign_assertions = true`, `name_id_format = "username"`, `force_name_id_format = false`, `front_channel_logout = true`, `include_authn_statement = false`.
- Signing/encryption keys come from `var.saml_*` variables (`variables.tf`) and are populated by DevOps via Vault. **Do not put keys in the generated client file.**

## route66_ldap_groups (AD groups via LDAP)

### Layout
- All code in `route66_ldap_groups/TFCODE/`
- **Single file** `ldap_groups.tf` holds every system. Each system is a `module "<system_name>"` block. **Never split per-app.**

### Provider
- `Ouest-France/ldap ~> 0.8.7` (declared in `TFCODE/providers.tf`)
- Bind user: `T1-SRV-ADDS-TF`, password from `var.bind_password`

### Module interface
- Path: `./modules/ldap_resources` (source: `route66_ldap_groups/TFCODE/modules/ldap_resources/main.tf`)
- Inputs:
  ```hcl
  module "<system_name>" {
    source      = "./modules/ldap_resources"
    system_name = "<system_name>"
    base_ou     = "OU=keycloak,OU=Groups,OU=biocad,DC=biocad,DC=loc"
    groups = [
      { name = "<role_name>", description = "<desc>" }
    ]
  }
  ```
- The module:
  - Creates `OU=<system_name>` inside `base_ou`
  - Creates `OU=Roles` inside that
  - For each group, creates `CN=KC-Role-<lower(system_name)>-<lower(group.name)>` with `ignore_changes = [members]` (members are managed by AD admins, not Terraform)

### Naming contract with route66
- The `system_name` in the LDAP module **must** equal the `app_name` used as `client_id` in the route66 client file.
- The resulting AD group CN, `KC-Role-<lower(system_name)>-<lower(group.name)>`, **must** match the `ldap_group_name` field in the `keycloak_<app>_roles` module exactly (case-insensitive at the AD level but the convention is lowercase).

### Hazards (from README.md)
- Renaming an existing group recreates it in AD → all member assignments are lost. The skill must never rename, only append.
- New groups can only be appended to the end of an existing module's `groups = [...]` array. Reordering breaks Terraform plan diffs and recreates groups.
- LDAP→Keycloak sync runs every 15 minutes (`changed_sync_period = 900` on `keycloak_ldap_user_federation` in route66/realms.tf). DevOps may need to wait or trigger a manual sync before the route66 MR can apply cleanly.

### CI / state
- Same pattern as route66: GitLab managed Terraform state, `validate → test → deploy`.
- The route66_ldap_groups pipeline must succeed and AD must replicate before route66 client roles can be applied.
