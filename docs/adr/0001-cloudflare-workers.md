# ADR-0001 — Cloudflare Workers en lugar de Vercel

**Estado:** Aceptado · 2026-05-25

## Contexto

Vercel está bloqueado en Gut por un incidente de seguridad corporativo. Se necesita un host serverless compatible con Next.js App Router y sin restricciones en la red de la empresa.

## Decisión

Cloudflare Workers via `@opennextjs/cloudflare`. El build command es `pnpm build:cf` (no el `pnpm build` estándar de Next.js).

## Consecuencias

**Positivas:**
- Compatible con la política de seguridad de Gut
- Cold starts muy bajos (edge runtime global)

**Negativas / limitaciones a tener en cuenta:**
- `@react-pdf/renderer` no funciona en el edge runtime de Cloudflare porque depende de `canvas` de Node.js. **Los exports PDF no están implementados** — se usan CSV/XLSX como alternativa.
- El build command es distinto al default de Next.js. Si configuras CI (Cloudflare dashboard), el comando correcto es `pnpm build:cf`, no `pnpm run build`.
- Secrets se gestionan con `wrangler secret put`, no con variables de entorno en dashboard.

## Comandos de deploy

```bash
pnpm build:cf      # Build para Cloudflare Workers
pnpm preview:cf    # Preview local
pnpm deploy:cf     # Deploy a producción
```
