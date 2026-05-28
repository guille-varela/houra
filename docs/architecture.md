# Houra — Architecture & Information Design

Documento de referencia. Describe la forma del sistema: entidades, relaciones, reglas de negocio, permisos y navegación. Actualizar cuando cambien el schema o las rutas.

> **Último estado:** v1.0.0 (Sprint 1). Sprint 2 proyectado al final del documento.

---

## 1. Dominio — qué resuelve Houra

Houra es un tracker de horas para una consultora de diseño. El problema central: saber en tiempo real si un proyecto está siendo rentable, quién está imputando qué, y si el equipo asignado va a agotar el presupuesto antes de que acabe el trabajo.

**Tres perguntas que Houra responde en todo momento:**
1. ¿Cuántas horas quedan en este proyecto por área y perfil?
2. ¿El ritmo actual nos lleva a terminarlo dentro del presupuesto?
3. ¿Qué margen real estamos obteniendo vs. el que estimamos?

---

## 2. Mapa de entidades

```
ORGANIZACIÓN
│
├── DEPARTAMENTOS (agrupación informativa de personas)
│
├── PERSONAS ──────────────────── vinculada a USER (auth)
│   ├── professionalCategory (head/lead/senior/mid/junior/trainee)
│   └── appRole (admin / manager / contributor)
│
├── WORKSPACES (agrupación de proyectos, ej: "Gut Main", "Clientes Externos")
│   └── PROYECTOS
│       ├── ASIGNACIONES (Persona ↔ Proyecto, con allowedAreas)
│       ├── ENTRADAS DE TIEMPO (la transacción core)
│       ├── AMENDMENTS (ajustes manuales de presupuesto)
│       └── TRASPASOS DE HORAS (de Proyecto A → Proyecto B)
│
├── TARIFAS (coste/venta por área × rol, en 4 niveles de especificidad)
│
├── AUSENCIAS (vacaciones, festivos, bajas)
│
├── REPORTS (vistas compartibles con snapshot frozen)
│   └── REPORT SNAPSHOTS
│
├── PRESETS DE FESTIVOS (calendarios regionales, ES + 17 CCAA)
│
└── AUDIT LOG (rastro de todas las operaciones críticas)
```

---

## 3. Inventario de tablas

### `organizations`
El tenant raíz. En v1 hay una sola organización. Multi-tenant preparado.

| Campo clave | Tipo | Descripción |
|---|---|---|
| `slug` | text | Identificador de URL de la org |
| `currency` | text | EUR por defecto |
| `defaultWeeklyHours` | numeric | 37.5h |
| `dailyHoursSoftCap` | numeric | Límite suave diario (alerta, no bloqueo) |
| `defaultRenewalBehavior` | enum | `reset` o `carry_over` para bolsas renovables |

### `departments`
Agrupación informativa de personas dentro de una org. No afecta permisos ni precios.

### `persons`
La entidad de negocio central para personas. Separada de `users` (que es de Better Auth).

| Campo clave | Tipo | Descripción |
|---|---|---|
| `userId` | FK → users | Vincula la identidad de auth con la persona de negocio |
| `appRole` | enum | `admin`, `manager`, `contributor` — controla acceso |
| `professionalCategory` | enum | `head`, `lead`, `senior`, `mid`, `junior`, `trainee` — controla precio |
| `primaryArea` | enum | `research`, `ux`, `ui` |
| `deactivatedAt` | timestamp | Soft delete — persona inactiva sigue en histórico |

> **Regla:** `professionalCategory === 'trainee'` → horas imputadas no son facturables. Derivado en cálculo, no almacenado.

### `workspaces`
Agrupa proyectos. Ejemplo: un workspace por cuenta de cliente o por línea de negocio.

### `projects`
La unidad de trabajo y facturación.

| Campo clave | Tipo | Descripción |
|---|---|---|
| `type` | enum | `fixed_bag`, `renewable_bag`, `ongoing_capacity` |
| `status` | enum | `draft` → `active` → `paused` → `closed` |
| `originalAllocation` | jsonb | Matriz `{ area: { role: hours } }` — el presupuesto original |
| `areasEnabled` | jsonb | Qué áreas están activas en este proyecto |
| `weeklyHours` | numeric | Horas/semana estándar del proyecto (para proyecciones) |
| `startDate` / `endDate` | date | Temporalidad del proyecto |
| `contributorDashboardAccess` | enum | `none`, `assigned_only`, `all` |

**Transiciones de estado válidas:**
```
draft → active
active → paused
active → closed
paused → active
paused → closed
```
> `active → draft` está bloqueado intencionalmente.

### `project_assignments`
Tabla pivote Persona ↔ Proyecto. Controla en qué áreas puede imputar cada persona.

| Campo clave | Descripción |
|---|---|
| `allowedAreas` | jsonb array — áreas habilitadas para esta persona en este proyecto |
| `isActive` | Soft deactivation — el histórico de horas se conserva |

### `rates`
Sistema de tarifas con cuatro niveles de especificidad. La resolución sigue una jerarquía:

```
Persona (más específico)
  └── Proyecto
        └── Workspace
              └── Organización (más genérico)
```

`resolveRate()` en `lib/rates.ts` busca de más específico a más genérico. Si no hay tarifa en ningún nivel, devuelve error.

Cada tarifa aplica a una combinación `(area, role)` con un rango de fechas (`effectiveFrom` / `effectiveTo`).

### `time_entries`
La transacción core del sistema. Cada entrada registra:
- Quién imputó (`personId`)
- A qué proyecto (`projectId`)
- Qué día, cuántas horas, en qué área
- **Las tarifas vigentes en el momento de la imputación** (`costRateAtEntryCents`, `soldRateAtEntryCents`) — snapshot inmutable para proteger el histórico

> Las tarifas se snapshot-ean al crear la entrada. Cambiar una tarifa futura no altera el pasado.

### `amendments`
Ajustes formales al presupuesto de un proyecto. Añaden o restan horas de la allocation matrix mediante un `deltaAllocation`. Requieren `reason` y opcionalmente una `clientReference` (nº OC, email de aprobación, etc.).

### `hour_transfers`
Mueve horas no consumidas de un proyecto a otro dentro de la misma organización. Registra `fromProjectId`, `toProjectId`, `area`, `role`, `hours`, `reason` y `performedBy`. Inmutable tras crearse (solo audit, no se puede deshacer vía UI).

### `time_off_entries`
Ausencias de una persona: `holiday` (festivo), `vacation` (vacaciones), `sick_leave` (baja). No bloquean la imputación — son informativas para el cálculo de disponibilidad.

### `reports` + `report_snapshots`
Un report es una vista compartible de un proyecto, workspace, organización o persona. Tiene un `shareUrlSlug` único y puede tener contraseña. Los `report_snapshots` son copias frozen del estado en un momento dado, generadas manualmente o por el job automático de Inngest.

### `audit_log_entries`
Rastro inmutable de todas las operaciones críticas (creación, modificación, borrado de entidades clave). Cada entrada tiene `entityType`, `entityId`, `action`, `payload` (jsonb), `performedBy`, `performedAt`.

### `holiday_presets`
Calendarios de festivos regionales precargados. En v1 incluye España + 17 CCAA para 2026. Se asignan a personas por `holidayRegion`.

---

## 4. Jerarquía de tarifas

```
resolveRate(area, role, { personId, projectId, workspaceId, orgId })

1. Busca tarifa donde personId = X  → más específico (tarifa pactada individualmente)
2. Busca tarifa donde projectId = X → tarifa acordada para este proyecto
3. Busca tarifa donde workspaceId = X → tarifa de la cuenta de cliente
4. Busca tarifa donde solo orgId = X → tarifa estándar de la organización
```

Las tarifas tienen vigencia temporal (`effectiveFrom`, `effectiveTo`). Si en la misma fecha hay varias filas al mismo nivel, gana la más reciente.

---

## 5. Matriz de permisos por rol

| Sección | Admin | Manager | Contributor |
|---|---|---|---|
| `/today` — imputar horas | ✅ | ✅ | ✅ |
| `/week` — vista semanal | ✅ | ✅ | ✅ |
| `/my-projects` | — | — | ✅ Solo sus asignados |
| `/projects` — lista global | ✅ | ✅ | ❌ → redirige a `/my-projects` |
| `/projects/[id]` — detalle | ✅ | ✅ | ⚙️ Según `contributorDashboardAccess` |
| `/projects/[id]` tab Equipo | ✅ | ❌ | ❌ |
| `/projects/[id]` tab Ajustes | ✅ | ❌ | ❌ |
| `/dashboard` | ✅ | ✅ | ❌ |
| `/workspaces` | ✅ | ✅ | ❌ |
| `/people` | ✅ | ❌ | ❌ |
| `/time-off` | ✅ | ✅ | ✅ |
| `/settings` | ✅ | ❌ | ❌ |
| `/audit` | ✅ | ❌ | ❌ |
| `/r/[slug]` — report público | 🌐 Sin auth | 🌐 Sin auth | 🌐 Sin auth |
| Role preview (sidebar) | ✅ Solo admin | — | — |

> **`contributorDashboardAccess` en proyectos:**
> - `none` → contributor no ve el detalle
> - `assigned_only` → solo ve sus propias horas
> - `all` → ve el dashboard completo (como manager, sin poder editar)

---

## 6. Árbol de rutas

```
/ ──────────────────────────────────────────────── redirige a /today
│
├── (auth)
│   └── /login ──────────────────────────────────── público
│
├── (app) ──────────────────────────────────────── require auth
│   ├── /today ──────────────────────────────────── todos los roles
│   ├── /week ───────────────────────────────────── todos los roles
│   ├── /time-off ───────────────────────────────── todos los roles
│   ├── /my-projects ────────────────────────────── contributor
│   ├── /projects ───────────────────────────────── admin + manager
│   │   └── /projects/[id]
│   │       ├── overview (matrix + burn rate + KPIs)
│   │       ├── entradas (tabla paginada)
│   │       ├── equipo (admin only)
│   │       └── ajustes (admin only)
│   ├── /dashboard ──────────────────────────────── admin + manager
│   ├── /workspaces ─────────────────────────────── admin + manager
│   │   └── /workspaces/[id]
│   ├── /people ─────────────────────────────────── admin
│   ├── /settings ───────────────────────────────── admin
│   └── /audit ──────────────────────────────────── admin
│
├── /r/[slug] ───────────────────────────────────── público (report compartido)
│
└── /api
    ├── /auth/[...all] ──────────────────────────── Better Auth handler
    ├── /inngest ────────────────────────────────── Inngest webhook
    ├── /search ─────────────────────────────────── require auth (Sprint 1)
    ├── /export/project/[id] ────────────────────── CSV / XLSX
    └── /export/workspace/[id] ─────────────────── CSV / XLSX
```

---

## 7. Lógica de negocio clave

### Consumo de matriz (traffic-light)
Para cada celda `(area, role)` en un proyecto:
```
consumption = consumedHours / plannedHours

verde:   < 80%
naranja: 80% – 99%
rojo:    ≥ 100%
sin planificar (planned = 0, consumed > 0): rojo con horas brutas
```

### Fecha proyectada de cierre
Para proyectos `fixed_bag` y `renewable_bag`:
```
weeklyRate = horasÚltimas4Semanas / 4
horasRestantes = totalPlanned - totalConsumed
proyección = hoy + (horasRestantes / weeklyRate) semanas
```

### Cálculo de margen
```
revenue = Σ(hours × soldRateAtEntry)
cost    = Σ(hours × costRateAtEntry)
margin  = (revenue - cost) / revenue × 100
```
Las tarifas son las del momento de la imputación (snapshot inmutable).

---

## 8. Sprint 2 — entidades proyectadas

> Pendiente de implementación. Schema sujeto a cambio hasta el inicio del sprint.

### Nuevas tablas

**`clients`**
```
clients {
  id, organizationId, name
  hasMarco: boolean
  marcoStartDate, marcoEndDate: date
  marcoUsePerRoleRates: boolean
  marcoGlobalRate: numeric (cents)
  marcoRateByCategory: jsonb { head, lead, senior, mid, junior, trainee: cents | null }
}
```

**`project_phases`**
```
project_phases {
  id, projectId
  name: text
  estimatedHours: numeric
  billingAmount: numeric (para by_phase)
  deliveryDate: date
  status: 'planned' | 'in_progress' | 'delivered' | 'invoiced'
}
```

### Columnas nuevas en tablas existentes

**`projects`**
```
+ billingModel: 'hour_bag' | 'monthly_fee' | 'by_phase'
+ clientId: FK → clients (nullable — proyectos internos sin cliente)
+ targetMarginPercent: numeric
+ hourBagAlertThreshold: numeric (default 80, porcentaje)
```

**`persons`**
```
+ internalLevel: 'level_1' | 'level_2' | 'level_3' | null
```
Solo informativo. UI: tooltip on hover muestra `"Nombre — Área · Categoría Level X"`.

### Rutas nuevas

```
/clients ──────────────────────── admin + manager
/clients/[id] ─────────────────── admin + manager
  └── tab: Proyectos (lista de proyectos de este cliente)
  └── tab: Acuerdo Marco (toggle + rates)
  └── tab: Rentabilidad (resumen de margen por proyecto)
```

### Calculadora de rentabilidad — tres escenarios

| Escenario | Qué está fijo | La palanca es |
|---|---|---|
| Sin marco | Nada | Precio por perfil |
| Con marco | Tarifas | Volumen de horas |
| Con marco + bolsa fija | Tarifas + presupuesto | Composición del equipo |

La calculadora es computación derivada en el cliente (no nueva tabla). Todas las variables ya están almacenadas.

### Alertas por `billingModel`

```
hour_bag:
  80% consumo → soft alert
  95% consumo → hard alert
  >100% → overflow flag (horas no facturables)

monthly_fee / marco:
  endDate - 60 días → alerta de renovación
  proyección ritmo actual → "se agota en X semanas"

by_phase:
  real vs. estimado por fase → varianza
  desviación > umbral → requiere ack del manager
```

---

## 9. Decisiones pendientes (bloquean Sprint 2)

- [ ] **Traspasos de bolsa**: ¿manager self-service (solo audit log) o requiere aprobación de admin (añade campo `status: pending/approved`)?

---

*Para cambios en este documento, actualizar también `Houra/Decisions-Log.md` en el vault de gut-brain.*
