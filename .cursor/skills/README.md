# Cursor Skills Adapter

Canonical project skills live in `.agents/skills`.

Current Cursor versions can discover project-level Agent Skills from the shared
`.agents/skills/<skill-name>/SKILL.md` layout. Keep `.cursor/skills` free of
skill copies to avoid duplicate skill injection when both locations are scanned.

VERSION-SENSITIVE: if a pinned enterprise Cursor build does not discover
`.agents/skills`, create a temporary mirror from `.agents/skills` to
`.cursor/skills` during workstation provisioning instead of editing the
canonical corpus.
