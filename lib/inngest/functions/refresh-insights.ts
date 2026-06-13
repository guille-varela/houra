import { sql } from 'drizzle-orm'
import { inngest } from '@/lib/inngest'
import { db } from '@/lib/db'

/**
 * F3.5 — Reconstrucción nocturna del rollup de Insights (ver ADR-0011).
 *
 * Rebuild completo de `insights_monthly` a grano (org, mes, proyecto, persona,
 * área) desde `time_entries`. Las tarifas ya vienen denormalizadas en cada fichaje
 * (`sold_rate_at_entry_cents` / `cost_rate_at_entry_cents`), así que revenue y coste
 * son sumas directas, sin joins a tablas de tarifas.
 *
 * El read layer (`lib/insights-data.ts`) ignora el mes en curso de este rollup y lo
 * calcula en vivo, así que el rebuild puede incluir el mes actual sin problema.
 */
export const refreshInsights = inngest.createFunction(
  {
    id: 'refresh-insights',
    triggers: [{ cron: 'TZ=Europe/Madrid 0 1 * * *' }],
  },
  async ({ step }) => {
    // neon-http no soporta transacciones interactivas: hacemos DELETE + INSERT como
    // pasos durables de Inngest. La ventana vacía (madrugada) es aceptable.
    await step.run('clear', () => db.execute(sql`DELETE FROM insights_monthly`))

    const result = await step.run('rebuild', () =>
      db.execute(sql`
        INSERT INTO insights_monthly
          (organization_id, month, project_id, person_id, area,
           hours, revenue_cents, cost_cents, entry_count, refreshed_at)
        SELECT
          te.organization_id,
          date_trunc('month', te.date::date)::date AS month,
          te.project_id,
          te.person_id,
          te.area,
          SUM(te.hours)                                                   AS hours,
          ROUND(SUM(te.hours * te.sold_rate_at_entry_cents))::bigint      AS revenue_cents,
          ROUND(SUM(te.hours * te.cost_rate_at_entry_cents))::bigint      AS cost_cents,
          COUNT(*)::int                                                   AS entry_count,
          now()
        FROM time_entries te
        GROUP BY te.organization_id, date_trunc('month', te.date::date)::date,
                 te.project_id, te.person_id, te.area
      `),
    )

    return { ok: true, rowCount: (result as { rowCount?: number }).rowCount ?? null }
  },
)
