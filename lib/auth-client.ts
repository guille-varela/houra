import { createAuthClient } from 'better-auth/client'

// Sin baseURL: el auth se sirve desde el mismo Worker (/api/auth/*), así que
// Better Auth usa el origin actual del navegador. Evita hornear una URL en
// build-time (antes quedaba localhost en el bundle de producción) y funciona
// en cualquier dominio sin depender de NEXT_PUBLIC_BETTER_AUTH_URL.
export const authClient = createAuthClient()
