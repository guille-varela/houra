# ADR-0005 — Audit log propio

**Estado:** Aceptado · 2026-05-26

## Contexto

Se necesita trazabilidad de todas las operaciones críticas (entradas de tiempo, cambios de estado de proyecto, transfers, reports, etc.) para auditoría interna.

## Decisión

Tabla `audit_log_entries` propia. `lib/audit.ts` expone `logAuditEvent()`. Los server actions llaman a esta función manualmente tras cada operación exitosa.

```ts
await logAuditEvent({
  organizationId,
  actorId,
  action: 'time_entry.create',
  entityType: 'time_entry',
  entityId: newEntry.id,
  payload: { hours, area, role },
})
```

## UI

`/audit` — accesible solo para admins. Tabla paginada (50 por página) con filtro por tipo de entidad y badges de color por tipo de acción. Enlazado desde Settings → "Registro de actividad".

## Consecuencias

- Control total sobre qué se registra y el formato del payload JSON
- Cada nueva acción crítica debe añadir su llamada a `logAuditEvent()` — requiere disciplina del equipo
- Los eventos se guardan por `organizationId` — el log es multi-tenant desde el inicio
