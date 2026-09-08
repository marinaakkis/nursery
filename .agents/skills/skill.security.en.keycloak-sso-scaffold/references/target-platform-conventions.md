# Target platform conventions

This skill runs in the developer's repo, but the TF it generates must drop cleanly into the SSO platform's two repos:

- `route66` — Keycloak clients (resources: `keycloak_openid_client`, `keycloak_saml_client`, mappers, role-binding modules)
- `route66_ldap_groups` — AD groups via LDAP (resources: `ldap_ou`, `ldap_group` through a wrapping module)

The developer will not see those repos. The skill must encode their conventions in the generated snippets so DevOps can paste them in without rewriting.

If a future change in those repos invalidates this document, DevOps should update this file and the templates — not patch around it in the generated output.

## route66 (Keycloak clients) — what the snippet must satisfy

**Layout**: every standalone client lives at `route66/TFCODE/<app_name>.tf` (no `clients/` subfolder, no module-per-client).

**Provider**: `mrparkers/keycloak v4.3.1` against `https://route66.biocad.ru`.

**Realm**: `keycloak_realm.biocad` is *the* realm for application clients. (`keycloak_realm.external` exists but is for public registration; only used if explicitly requested.)

**Required boilerplate on every OIDC client:**

```hcl
realm_id    = keycloak_realm.biocad.id
enabled     = true
login_theme = "keycloak"

authentication_flow_binding_overrides {
  browser_id = keycloak_authentication_flow.custom-browser-login.id
}
```

**Standard mappers to include:**

- `keycloak_openid_user_attribute_protocol_mapper` — `LDAP_ID` → claim `object_guid`. Always include for `biocad` realm clients.
- `keycloak_openid_user_client_role_protocol_mapper` — claim `resource_access.$${client_id}.roles`, `multivalued = true`. Include when the client has roles.
- `keycloak_openid_audience_protocol_mapper` — for `client_credentials` clients calling another API, and for any OIDC client that will be the audience of someone else's token.

**Role-to-AD-group binding** uses the existing `route66/TFCODE/modules/keycloak_client_roles` module:

```hcl
module "keycloak_<app_name>_roles" {
  source    = "./modules/keycloak_client_roles"
  realm_id  = keycloak_realm.biocad.id
  client_id = keycloak_openid_client.<app_name>.id
  roles = [
    { name = "<role>", description = "<desc>", ldap_group_name = "KC-Role-<lower(app)>-<lower(role)>" },
  ]
}
```

The module reads each AD group via `data "keycloak_group"`. So the AD group **must already exist in Keycloak** before this `module` is applied — meaning the `route66_ldap_groups` MR has to be merged, applied, and the AD→Keycloak sync (~15 min) has to have run.

**`client_secret` handling** (this is the rule the skill enforces, not necessarily what every existing file does):

- Omit `client_secret` from `keycloak_openid_client`.
- Keycloak auto-generates one on apply.
- DevOps reads it from the Admin UI: `Clients → <app_name> → Credentials → Client secret` and delivers it to the developer through the corporate secret-sharing channel (Vault / password share). Never via git, ticket comments, Slack, email.
- Some existing files (`atlas-hcm-web.tf`, parts of `typical_oidc_clients.tf`) hardcode UUIDs as `client_secret`. That's tech debt — do not copy that pattern into new clients.

**SAML conventions** (matches `jira_saml.tf`, `confluence-saml-client.tf`, etc.):

```hcl
signature_algorithm       = "RSA_SHA256"
client_signature_required = false
sign_documents            = true
sign_assertions           = true
include_authn_statement   = false
name_id_format            = "username"
force_name_id_format      = false
front_channel_logout      = true
login_theme               = "keycloak"
```

Signing/encryption keys come from `var.saml_*` variables sourced from Vault by DevOps. **Never include keys in the generated snippet.**

**CI / formatting**: the platform repo runs `gitlab-terraform fmt` on every MR. Generated `.tf` must be `terraform fmt`-clean: 2-space indent, aligned `=` within blocks, trailing newline.

## route66_ldap_groups (AD groups) — what the snippet must satisfy

**Layout**: a single file `route66_ldap_groups/TFCODE/ldap_groups.tf` holds **every** system as separate `module "<system_name>"` blocks. The skill **does not** create per-app files in this repo — it generates a snippet to **append** at the end of the existing file.

**Provider**: `Ouest-France/ldap ~> 0.8.7`.

**Module interface** (`./modules/ldap_resources`):

```hcl
module "<system_name>" {
  source      = "./modules/ldap_resources"
  system_name = "<system_name>"
  base_ou     = "OU=keycloak,OU=Groups,OU=biocad,DC=biocad,DC=loc"
  groups = [
    { name = "<role>", description = "<desc>" },
  ]
}
```

**What the module produces:**

- `OU=<system_name>` inside `base_ou`
- `OU=Roles` inside that
- For each entry: `CN=KC-Role-<lower(system_name)>-<lower(group.name)>`, with `lifecycle { ignore_changes = [members] }`

**Naming contract with route66:**

- `system_name` in the LDAP module **must** equal `app_name` used as `client_id` in the route66 client file.
- The resulting AD group CN, `KC-Role-<lower(system_name)>-<lower(group.name)>`, **must** match the `ldap_group_name` field in the `keycloak_<app>_roles` module letter-for-letter.

**Hazards (from the repo's own README):**

- Renaming an existing group recreates the AD object → all member assignments are lost.
- New groups can only be appended to the end of an existing module's `groups = [...]` array.
- Reordering existing modules or entries breaks plan diffs and recreates groups.

These are why the generated snippet is always a single new `module "<app>"` block, not a patch into an existing one.

## Order of apply (always)

1. `route66_ldap_groups` MR — merge & apply first (only if new groups are needed).
2. Wait for AD→Keycloak sync (`changed_sync_period = 900` ⇒ up to 15 minutes), or DevOps triggers a manual sync.
3. `route66` MR — merge & apply.

If the developer asks "can these be done in parallel?" — the answer is no, because `keycloak_client_roles` reads the AD group via `data "keycloak_group"` at plan time.

## Reference values for generated docs

- Keycloak base URL: `https://route66.biocad.ru`
- Default realm: `biocad`
- Discovery endpoint: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`
- LDAP base OU: `OU=keycloak,OU=Groups,OU=biocad,DC=biocad,DC=loc`
- AD group CN format: `KC-Role-<lower(system_name)>-<lower(role_name)>`
