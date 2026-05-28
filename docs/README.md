# Houra — Documentación

Documentación técnica del proyecto para el equipo.

## Contenido

- [phases.md](phases.md) — Qué se construyó en cada fase de desarrollo
- [adr/](adr/) — Architecture Decision Records: por qué el stack es como es

## ADRs

| # | Decisión | Estado |
|---|----------|--------|
| [0001](adr/0001-cloudflare-workers.md) | Cloudflare Workers en lugar de Vercel | Aceptado |
| [0002](adr/0002-mantine-v9.md) | Mantine v9 (no v7) | Aceptado |
| [0003](adr/0003-better-auth.md) | Better Auth + tabla `persons` propia | Aceptado |
| [0004](adr/0004-area-role-matrix.md) | Matriz área × rol como estructura central | Aceptado |
| [0005](adr/0005-audit-log.md) | Audit log propio (no librería externa) | Aceptado |
| [0006](adr/0006-dm-sans-palette.md) | DM Sans + paleta azul-gris | Aceptado |
| [0007](adr/0007-sheetjs-exports.md) | SheetJS para exports CSV/XLSX | Aceptado |
| [0008](adr/0008-error-handling.md) | Patrón de error handling: toasts vs. Alert inline | Aceptado |
