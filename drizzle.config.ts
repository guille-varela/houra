import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs outside Next.js, so .env.local is not auto-loaded
try {
  process.loadEnvFile('.env.local')
} catch {
  // file not present (CI, production) — env vars come from the environment
}

export default defineConfig({
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
