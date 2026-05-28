# ADR-0009 — Billing model, project typology, and acuerdo marco

**Date:** 2026-05-28  
**Status:** Accepted — pending Sprint 2 implementation  
**Participants:** Guillermo Varela, Claude

---

## Context

After Sprint 1 (dark mode + sidebar + ⌘K), the next product expansion introduces client entities, a pre-sales proposal pipeline, and a full margin/profitability calculator. This ADR captures the financial and data-model decisions made before coding Sprint 2.

---

## Decisions

### 1. Three billing models (orthogonal to project type)

A project has a `billingModel` that determines which financial lever is available:

| billingModel | What's fixed | Primary lever |
|---|---|---|
| `hour_bag` | Price × total hours | Team composition |
| `monthly_fee` | Monthly fee amount | Hours consumed |
| `by_phase` | Price per deliverable | Execution efficiency |

These are independent of whether an acuerdo marco exists.

### 2. Acuerdo Marco belongs to the Client, not the Project

The framework agreement (acuerdo marco) is an attribute of the **client account**. One client can have one active agreement that affects all their projects simultaneously.

```
clients
  ├── hasMarco: boolean
  └── marco_agreement (if hasMarco)
        ├── startDate / endDate
        ├── usePerRoleRates: boolean   ← toggle in UI
        ├── globalRate: numeric        ← used when toggle is OFF
        └── rateByCategory: {         ← used when toggle is ON
              head, lead, senior, mid, junior, trainee: numeric | null
            }
            // null = fall back to globalRate for that category
```

**UI pattern:** Toggle "Acuerdo Marco" on the client detail page. Disabled → shows one global rate field. Enabled → expands a rate table per billing category. Individual category fields can be left empty to inherit the global rate.

### 3. Profitability calculator — three scenarios

The calculator always shows all three levers, disabling the ones that are contractually fixed:

**No marco (can move price):**
- Input: hours × profile, target margin %
- Output: minimum billing rate per category to hit margin

**With marco (price fixed, move volume):**
- Input: hours × profile, fixed marco rates, target margin %
- Output: minimum hours to sell to cover cost + margin
- Also shows: "replace X hours of Lead with Junior → +4 margin points"

**With marco + fixed bag (price AND volume fixed, move team):**
- Input: bag in €, marco rates, target margin %
- Output: optimal team composition
- Shows impact of adding/removing each profile

### 4. Professional categories and internal levels

**Billing categories** (drive pricing): `head`, `lead`, `senior`, `mid`, `junior`, `trainee`

**Internal levels** (informational only, do not affect pricing): `level_1`, `level_2`, `level_3`

Stored as `internalLevel: 'level_1' | 'level_2' | 'level_3' | null` on the `persons` table.

**UI pattern:** Compact display shows billing category only. On hover (tooltip): full name + role + "Senior · Level 3". Keeps tables clean while exposing context when needed.

**Trainee rule:** Hours are tracked and appear in project reports, but are flagged as `billable: false` in revenue calculations. Derived from `professionalCategory === 'trainee'` — not stored.

### 5. Project phases (lightweight, not sub-projects)

Phases are a **level within the project**, not independent sub-projects. This keeps the schema simpler.

```
project_phases {
  id, projectId
  name
  estimatedHours: numeric (total, not per role)
  billingAmount: numeric (for by_phase projects)
  deliveryDate: date
  status: 'planned' | 'in_progress' | 'delivered' | 'invoiced'
}
```

Escalation path: if P&L per phase is needed in a future sprint, phases can be promoted to sub-projects with their own allocation matrix. The data model supports this migration.

### 6. Hour transfers between projects

Two distinct operations:

- **Bag transfer:** Move unspent hours from project A → B (always between accounts, always audit-logged). Approval flow: **pending decision** — manager self-service vs. admin approval.
- **Person reassignment:** Remove from A, assign to B, with real-time impact on both projects' profitability shown before confirming.

### 7. Project alerts by temporality

```
hour_bag:
  soft alert at 80% consumption
  hard alert at 95%
  overflow flag when > 100% (non-billable hours)

monthly_fee / marco:
  alert 60 days before endDate
  pace alert: current hours/week extrapolated → projected exhaustion date

by_phase:
  per-phase variance: actual vs. estimated hours
  deviation > threshold → requires manager acknowledgment
```

### 8. Admin-configurable onboarding tooltips (future sprint)

Tooltips on key UI elements (not just person levels) will be editable from the admin panel. This turns the tooltip layer into a lightweight onboarding/help system. Scoped to a future sprint — the technical pattern (tooltip on hover showing `internalLevel`) established here serves as the foundation.

---

## Pending decisions

- [ ] Hour bag transfer approval flow: manager self-service (Option B, simpler) vs. admin approval required (Option A, adds `status: pending/approved` to transfers)

---

## Consequences

- `clients` table needed (Sprint 2) with `hasMarco` + nested agreement
- `projects` table needs `billingModel`, `clientId`, `targetMarginPercent`, `hourBagAlertThreshold`
- `project_phases` table (new, Sprint 2)
- `persons` table needs `internalLevel` column (migration)
- Profitability calculator is a client-side derived computation — no new DB table needed, all inputs already stored
