# ADR-0008 — Patrón de error handling

**Estado:** Aceptado · 2026-05-28

## Contexto

Antes de Phase 08, el manejo de errores era inconsistente: algunos componentes usaban `useState<string | null>` + `<Alert>` para todos los errores, incluyendo los que venían de server actions.

## Decisión

Dos patrones según el origen del error:

### 1. Server action errors → toast

```tsx
const result = await someServerAction(payload)
if (!result.ok) {
  notifications.show({ color: 'red', title: 'Error', message: result.error })
  return
}
```

### 2. Validación client-side → Alert inline

```tsx
function handleSubmit() {
  if (!field || !otherField) {
    setError('Completa todos los campos')
    return
  }
  // ...
}

{error && (
  <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
    {error}
  </Alert>
)}
```

### 3. Operación exitosa → toast verde

```tsx
notifications.show({ color: 'green', message: 'Guardado correctamente' })
```

## Regla de microcopy

Todos los mensajes de error que llegan al usuario deben estar en español amigable. Nunca exponer:
- Mensajes técnicos en inglés (`'Person not found'`)
- Valores raw de enum (`'draft'`, `'fixed_bag'`)
- Stack traces o nombres de función

Los mensajes de `lib/guards.ts` y `lib/rates.ts` son el punto de entrada — están en español desde Phase 08.
