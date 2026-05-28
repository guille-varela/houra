# ADR-0004 — Matriz área × rol como estructura central

**Estado:** Aceptado · 2026-05-26

## Contexto

Las imputaciones de tiempo necesitan granularidad por área y rol para calcular costes y márgenes reales. Una hora de un Senior en Tech no vale lo mismo que una hora de un Junior en Design.

## Decisión

Cada entrada de tiempo (`time_entries`) lleva `area` y `role`. La tabla `rates` también es `(organization, area, role)`. La asignación de horas (`project_allocations`) es una matriz sparse de `(projectId, area, role, plannedHours)`.

Las áreas y roles válidos están definidos en `lib/matrix.ts`:

```ts
export const AREAS = ['design', 'tech', 'pm', 'strategy'] as const
export const ROLES = ['junior', 'mid', 'senior', 'lead'] as const
```

## Resolución de tarifas

Jerarquía en `lib/rates.ts` → `resolveRate()`:

```
Persona (tarifa override) > Proyecto > Workspace > Organización
```

Si no hay tarifa en ningún nivel, se lanza error con mensaje amigable pidiendo al admin que configure tarifas base.

## Consecuencias

- Traffic-light de consumo por celda: verde <80%, naranja 80–99%, rojo ≥100%
- Las celdas con consumo pero sin planificación (planned = 0) aparecen en rojo con las horas raw — más informativo que ocultarlas
- Los reports y exports incluyen coste e ingreso calculados en tiempo real con estas tarifas
