# Initialization choices

## Presets

- `quick`: memory data source, zero-dependency preview, object-storage configuration capability.
- `standard`: PostgreSQL + Prisma with Redis, object storage, and email capabilities declared.
- `custom`: choose only capabilities the repository currently implements.

## Configuration boundaries

- Commit `project.config.json`; it contains non-secret capability declarations.
- Never commit `.env`; it contains database credentials, JWT secrets, encryption keys, and the generated initial password.
- Use `DATA_SOURCE=memory` only for local preview and tests. Production requires Prisma/PostgreSQL.
- Object storage has no local-file fallback. Avatar upload requires an enabled supported remote provider; Tencent COS is the currently tested adapter.
- SQL, Redis, SMS, email, payment, and object-storage credentials are managed through the service configuration module and are never returned in plaintext.

## Verification

- Normal project: `pnpm template:doctor && pnpm check && pnpm test:e2e`.
- Template release: `pnpm template:verify -- --full`.
- PostgreSQL: dry-run and confirm before `pnpm template:provision`.
