/**
 * Lists the working days between two ISO dates (inclusive) as 'YYYY-MM-DD',
 * excluding weekends and the dates in `holidaySet`.
 * Uses local-time Date to avoid UTC timezone shifts on date boundaries.
 */
export function listWorkingDays(
  from: string,        // 'YYYY-MM-DD'
  to: string,          // 'YYYY-MM-DD'
  holidaySet: Set<string>,
): string[] {
  const [fy, fm, fd] = from.split('-').map(Number) as [number, number, number]
  const [ty, tm, td] = to.split('-').map(Number) as [number, number, number]

  const start = new Date(fy, fm - 1, fd)
  const end = new Date(ty, tm - 1, td)

  if (end < start) return []

  const days: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) {
      const iso = isoDate(cur)
      if (!holidaySet.has(iso)) days.push(iso)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

/**
 * Counts working days between two ISO dates (inclusive), excluding weekends and holidays.
 */
export function getWorkingDays(
  from: string,        // 'YYYY-MM-DD'
  to: string,          // 'YYYY-MM-DD'
  holidaySet: Set<string>,
): number {
  return listWorkingDays(from, to, holidaySet).length
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type FeasibilityResult = {
  deadline: string
  today: string
  workingDays: number
  hoursPerDay: number
  availableHours: number       // workingDays × hoursPerDay (1 FTE)
  totalEstimatedHours: number
  staffingLines: number        // number of parallel workers defined
  fteNeeded: number            // totalEstimatedHours / availableHours
  surplus: number              // availableHours - totalEstimatedHours (negative = deficit)
  ok: boolean                  // fteNeeded ≤ staffingLines
  daysShort: number            // if deficit: how many extra working days needed (for 1 FTE)
}

export function computeFeasibility(params: {
  deadline: string
  today: string
  totalEstimatedHours: number
  staffingLines: number
  hoursPerDay: number
  holidaySet: Set<string>
}): FeasibilityResult {
  const { deadline, today, totalEstimatedHours, staffingLines, hoursPerDay, holidaySet } = params

  const workingDays = getWorkingDays(today, deadline, holidaySet)
  const availableHours = workingDays * hoursPerDay
  const fteNeeded = availableHours > 0 ? totalEstimatedHours / availableHours : Infinity
  const surplus = availableHours - totalEstimatedHours
  const ok = fteNeeded <= Math.max(staffingLines, 1)

  // Days short = extra days needed for the deficit at 1 FTE
  const daysShort = surplus < 0 ? Math.ceil(Math.abs(surplus) / hoursPerDay) : 0

  return {
    deadline,
    today,
    workingDays,
    hoursPerDay,
    availableHours,
    totalEstimatedHours,
    staffingLines,
    fteNeeded,
    surplus,
    ok,
    daysShort,
  }
}
