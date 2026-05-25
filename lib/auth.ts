import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins'
import { db } from './db'
import * as schema from '@/db/schema'
import { Resend } from 'resend'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Instanciamos en runtime para evitar error de build con RESEND_API_KEY ausente
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: email,
          subject: 'Accede a Houra',
          html: `<p><a href="${url}">Haz clic aquí para entrar</a></p><p>El enlace expira en 15 minutos.</p>`,
        })
      },
    }),
  ],
})
