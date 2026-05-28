# ADR-0002 — Mantine v9 (no v7)

**Estado:** Aceptado · 2026-05-25

## Contexto

Mantine v7 no es compatible con React 19. El proyecto usa React 19.

## Decisión

Mantine v9 en modo wireframe (grayscale neutral) hasta Phase 09, donde se aplican los brand tokens.

## Consecuencias

**Gotcha conocida — compound components en Server Components:**

Los compound components de Mantine v9 (`Tabs.Panel`, `Table.Thead`, etc.) no resuelven correctamente en Turbopack Server Components.

**Solución aplicada en este proyecto:**
- `Tabs`: el shell `<Tabs>` se extrae a un wrapper `'use client'`. Los `Tabs.Panel` y `Tabs.List` viven dentro de ese wrapper.
- `Table.*`: usar los named exports standalone en lugar de los compound components:
  ```tsx
  // ❌ No usar en Server Components:
  import { Table } from '@mantine/core'
  <Table.Thead>...</Table.Thead>

  // ✅ Usar en Server Components:
  import { TableThead, TableTbody, TableTr, TableTh, TableTd } from '@mantine/core'
  <TableThead>...</TableThead>
  ```
