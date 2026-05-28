# ADR-0007 — SheetJS para exports CSV/XLSX

**Estado:** Aceptado · 2026-05-28

## Contexto

Se necesitan exports de time entries en formatos CSV y XLSX. Cloudflare Workers edge runtime excluye librerías que dependan de APIs de Node.js no disponibles en edge.

## Decisión

`xlsx@0.18.5` (SheetJS) en route handlers de Next.js (`app/api/export/`). Autenticación con `requireRole('manager')`.

**Patrón para XLSX compatible con `NextResponse`:**

```ts
// ❌ type: 'buffer' — no compatible con NextResponse en Cloudflare
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

// ✅ type: 'array' + Blob wrapper
const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
const blob = new Blob([new Uint8Array(buf)], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})
return new NextResponse(blob, { headers: { 'Content-Disposition': `attachment; filename="..."` } })
```

## Endpoints disponibles

| Endpoint | Acceso | Formato |
|---|---|---|
| `GET /api/export/project/[id]?format=csv` | manager+ | CSV |
| `GET /api/export/project/[id]?format=xlsx` | manager+ | Excel |
| `GET /api/export/workspace/[id]?format=csv` | manager+ | CSV (todos los proyectos) |
| `GET /api/export/workspace/[id]?format=xlsx` | manager+ | Excel (todos los proyectos) |

Columnas: Fecha, Persona, Rol, Área, Horas, Descripción, Coste (€), Ingresos (€).
