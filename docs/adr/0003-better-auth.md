# ADR-0003 — Better Auth + tabla `persons` propia

**Estado:** Aceptado · 2026-05-25

## Contexto

Se necesita autenticación multi-tenant con datos de negocio por persona (área, rol, organización, estado activo). Better Auth gestiona la identidad; la app necesita su propio modelo de persona.

## Decisión

Better Auth para autenticación (tabla `users`). Tabla `persons` propia vinculada via FK `user_id`.

Toda la lógica de negocio usa `persons.id`, nunca `users.id`.

## Helpers en `lib/auth-helpers.ts`

```ts
getCurrentPerson()        // Devuelve la persona autenticada o null
requireRole('admin')      // Lanza redirect si el rol no coincide
getOrganizationContext()  // Devuelve org + person
```

Estos helpers **no llevan `'use server'`** — son utilidades puras, no Server Actions ni endpoints.

## Consecuencias

- La desactivación y anonimización GDPR opera sobre `persons`, no sobre `users`
- El magic link está implementado pero requiere `RESEND_API_KEY` configurado en Cloudflare Workers secrets para funcionar en producción
