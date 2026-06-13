# ADR-0010 — Aplicación del acuerdo marco a nivel de propuesta

**Date:** 2026-06-13
**Status:** Accepted — implemented (F2.12 + F3.2)
**Participants:** Guillermo Varela, Claude

---

## Context

El feedback de usabilidad (F2.12 y F3.2) detectó ambigüedad en la interacción del
acuerdo marco: los usuarios confundían "tener acuerdo marco", "aplicarlo a la
propuesta", "desactivarlo" y "eliminarlo". Hacía falta un modelo mental claro y
un único punto de control por propuesta.

Esto extiende [ADR-0009](0009-billing-model-and-project-typology.md) §2, que ya
estableció que el acuerdo marco pertenece al **cliente**, no al proyecto.

---

## Decision

Solo existen **dos conceptos**, sin estados intermedios:

1. **El cliente tiene (o no) un acuerdo marco activo** — `clients.hasMarco` + su
   configuración de tarifas (`marcoGlobalRateCents`, `marcoRateByCategory`,
   vigencia). Se gestiona en `Clientes → [cliente] → Acuerdo Marco`.

2. **La propuesta aplica (o no) ese acuerdo marco** — un único boolean
   `proposals.use_framework_agreement_rate` (default `true`). No hay ningún otro
   estado: nunca se "elimina" ni "desactiva" el acuerdo marco *desde la propuesta*,
   solo se elige usar la tarifa pactada o la estándar.

### Reglas de UI (pestaña Rentabilidad)

- Si el cliente tiene acuerdo marco activo, "Tarifa aplicada" muestra por defecto
  **Acuerdo marco** con indicador del descuento. Link discreto "Cambiar a tarifa
  estándar".
- Pasar a tarifa estándar (dirección "cara", sube precios) abre un **modal de
  seguridad** que avisa del % de incremento respecto a la tarifa pactada. Volver a
  acuerdo marco no pide confirmación (dirección segura, sin fricción).
- Si el cliente **no** tiene acuerdo marco, no hay toggle: se indica "Tarifa
  estándar" con enlace a configurar el acuerdo marco en `Clientes`.
- Cada cambio queda registrado en el audit log (`framework_rate_changed`).

---

## Consequences

- Modelo de datos: un único campo `proposals.use_framework_agreement_rate`
  (boolean, migración `0006`). Cero estados intermedios → cero ambigüedad.
- Migración de datos: no aplica (no existían estados intermedios previos).
- El cálculo de rentabilidad usa la tarifa del escenario aplicado; las sugerencias
  de margen (F2.11) se calculan sobre ese mismo escenario.
- QA: verificado que no quedan referencias a "eliminar/desactivar acuerdo marco"
  en el flujo de propuestas.
