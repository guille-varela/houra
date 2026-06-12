import { neon } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'

let _db: NeonHttpDatabase | null = null

function getDb(): NeonHttpDatabase {
  if (!_db) {
    _db = drizzle(neon(process.env.DATABASE_URL!))
  }
  return _db
}

// Proxy para diferir la creación del cliente Neon hasta el primer uso en
// runtime. Así `next build` (collect page data) puede importar este módulo
// sin DATABASE_URL en el entorno — el secret solo existe en runtime en el
// Worker, no en build-time del CI.
export const db = new Proxy({} as NeonHttpDatabase, {
  get(_target, prop, receiver) {
    const real = getDb()
    const value = Reflect.get(real, prop, receiver)
    return typeof value === 'function' ? value.bind(real) : value
  },
})
