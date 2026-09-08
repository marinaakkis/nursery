# Keycloak 26 — modern (non-legacy) client configuration

The user requirement is explicit: target Keycloak 26.0 and **do not generate legacy client configuration**. This page lists the attribute matrix the skill must follow when emitting `keycloak_openid_client` resources, with the rationale.

The provider in use is `mrparkers/keycloak v4.3.1`. Where Keycloak 26 introduces features the provider cannot express, prefer omitting the legacy attribute over writing a half-correct value.

## What "legacy" means here

In Keycloak 26 these flows / settings are explicitly considered legacy or deprecated and must be off by default:

| Flag | Why it's legacy |
|---|---|
| `implicit_flow_enabled = true` | OAuth 2.1 deprecates the implicit grant. Tokens leak through the URL fragment. Replace with Authorization Code + PKCE. |
| `direct_access_grants_enabled = true` (Resource Owner Password Credentials) | OAuth 2.1 deprecates ROPC. The user's password leaves the browser and reaches the client app, defeating SSO. Allowed only for trusted CLI/test tooling — never for browser apps. |
| Public client without PKCE | Public clients (SPA, mobile, native) without PKCE are vulnerable to authorization-code interception. Always set `pkce_code_challenge_method = "S256"`. |
| `pkce_code_challenge_method = "plain"` | Defeats the whole point of PKCE. Use `S256`. |
| `consent_required = false` for third-party / external clients | Not a hard rule for first-party clients, but for external integrations (SaaS / partner) consent should be on. |

The repo today contains many clients with `direct_access_grants_enabled = true`. Those exist for historical reasons and are out of scope for this skill — **do not copy them into new clients**.

## Attribute matrix

The skill picks one row based on the developer's `auth_scenario` + `client_type` answer.

### Authorization Code Flow — public (SPA / mobile / native)

```hcl
access_type                  = "PUBLIC"
standard_flow_enabled        = true
direct_access_grants_enabled = false
implicit_flow_enabled        = false
service_accounts_enabled     = false
pkce_code_challenge_method   = "S256"
valid_redirect_uris          = [...]   # exact URIs only, no wildcards in prod
web_origins                  = [...]   # explicit origins or "+" (mirror redirect URIs); avoid "*" in prod
```

### Authorization Code Flow — confidential (server-side web app)

```hcl
access_type                  = "CONFIDENTIAL"
standard_flow_enabled        = true
direct_access_grants_enabled = false
implicit_flow_enabled        = false
service_accounts_enabled     = false
# client_secret is NOT set here. Keycloak auto-generates it; DevOps hands it to the dev after apply.
valid_redirect_uris          = [...]
web_origins                  = [...]
```

### Client Credentials (service-to-service, machine-to-machine)

```hcl
access_type                  = "CONFIDENTIAL"
standard_flow_enabled        = false   # no browser flow
direct_access_grants_enabled = false
implicit_flow_enabled        = false
service_accounts_enabled     = true
# valid_redirect_uris and web_origins are not used; pass [] to satisfy the schema.
valid_redirect_uris          = []
```

For client_credentials clients, also emit an audience mapper if the developer specified `service_audience`:

```hcl
resource "keycloak_openid_audience_protocol_mapper" "<app>_audience_mapper" {
  realm_id                 = keycloak_realm.example-company.id
  client_id                = keycloak_openid_client.<app>.id
  included_client_audience = "<service_audience>"
  name                     = "audience-mapper"
  add_to_id_token          = false
  add_to_access_token      = true
}
```

### SAML

Minimal modern profile (signing keys provided separately by DevOps via `var.saml_*`):

```hcl
resource "keycloak_saml_client" "<app>" {
  realm_id                  = keycloak_realm.example-company.id
  client_id                 = "<sp_entity_id>"
  name                      = "<sp_entity_id>"
  signature_algorithm       = "RSA_SHA256"
  enabled                   = true
  client_signature_required = false
  sign_documents            = true
  sign_assertions           = true
  include_authn_statement   = false
  name_id_format            = "<name_id_format>"   # default "username"
  force_name_id_format      = false
  front_channel_logout      = true
  login_theme               = "keycloak"

  authentication_flow_binding_overrides {
    browser_id = keycloak_authentication_flow.custom-browser-login.id
  }

  valid_redirect_uris = ["<acs_url>"]
}
```

## What the skill must always include

- `enabled = true`
- `login_theme = "keycloak"`
- `realm_id = keycloak_realm.biocad.id` (unless the developer chose a different realm)
- `authentication_flow_binding_overrides { browser_id = keycloak_authentication_flow.custom-browser-login.id }` — repo-wide convention; required for the corporate login experience

## What the skill must never write

- `client_secret = "<some-uuid>"` — secrets do not belong in git
- `implicit_flow_enabled = true`
- `direct_access_grants_enabled = true` for any new client (this skill does not exist to perpetuate the existing tech debt)
- Wildcard redirect URIs (`https://*.example.com/*`) — use exact paths
- `web_origins = ["*"]` for non-development clients
- Hardcoded role-to-group mappings outside the `keycloak_client_roles` module

## Cross-references

- Authoritative attribute names and accepted values: `mrparkers/keycloak` provider docs, `keycloak_openid_client` and `keycloak_saml_client` resource pages.
- Keycloak 26 release notes on legacy / deprecated client configuration.
- OAuth 2.1 draft for the underlying rationale (no implicit, mandatory PKCE for public clients, no ROPC).
