---
name: create-admin-project
description: Create a new AI-friendly Admin, optional user-facing Web, and API project from the nsmiling Git template; collect project, database, user-Web, and infrastructure choices; run initialization and validation; and establish durable AI context. Use when starting a new full-stack or internal-management project from this template or reinitializing a fresh clone.
---

# Create Admin Project

Create the project from the Git template and preserve its contract-first, API-authoritative architecture.

## Workflow

1. Confirm the destination directory is new or contains only the freshly cloned template. Never overwrite an unrelated project.
2. Ask only for decisions not already supplied: project/display name, package scope, ports, default UI language, `quick|standard|custom` preset, database mode, initial administrator phone/name, whether to enable the user-facing Web, and optional infrastructure capabilities. When multiple locales exist, require explicit default and supported-locale choices. Keep API status codes stable and render user-visible statuses through locale labels. Enabling user identity also enables SMS and Redis; verify registration code, code login, password reset, session-device revocation, Admin delivery testing, and masked delivery observability. Never expose provider secrets, raw verification targets, or production verification codes to Web or Admin.
   When Web is enabled, use shadcn-vue for business controls and VueUse Motion only for optional motion enhancement. Keep effects independent from business state, SSR, accessibility, and reduced-motion behavior.
3. Clone `https://cnb.cool/nsmiling.com/ai-template`, unless already inside a fresh clone.
4. Run `pnpm install`, then `pnpm template:init`; answer the interactive prompts from the confirmed decisions. Never put passwords or service keys in chat, command arguments, `project.config.json`, or AI documents.
5. Run `pnpm install` again after initialization so renamed workspace packages are relinked.
6. Run `pnpm template:doctor`. Fix every failure before developing features.
7. For memory mode, run `pnpm dev:local`. For PostgreSQL, first run `pnpm template:provision -- --dry-run`; execute provisioning only after the user confirms the target database.
8. Verify Admin, API health, login and the selected modules. When user Web is enabled, also verify registration/login, personal profile, and Admin customer management. Update `docs/ai/PROJECT.md` through `pnpm template:sync`, never by storing secrets there.

## Development rules

- Read `AGENTS.md`, `docs/ai/CONTEXT.md`, and the nearest application `AGENTS.md` before editing.
- Implement in the order: shared contract, API validation/business rule, Admin integration, tests, documentation.
- Register new permissions in `permissionCatalog`, protect API operations with `RequirePermissions`, and use client permission checks only for experience.
- Treat `userWeb` and `customerAuthentication` as one capability: enable or disable both. Enabling it also exposes customer-management permissions and the Admin customer list; disabling it excludes Web from default tasks and removes those runtime routes and menus.
- Do not enable a provider or database choice that the repository does not implement.
- Require `pnpm check` and relevant E2E tests before declaring a feature complete.

Read [references/choices.md](references/choices.md) when deciding presets, data sources, or provider capabilities.
