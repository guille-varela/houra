export type VacationEvent = {
  uid: string
  summary: string
  start: string // YYYY-MM-DD inclusive
  end: string   // YYYY-MM-DD inclusive (we convert iCal's exclusive DTEND)
  status: string
}

// ─── iCal parser ─────────────────────────────────────────────────────────────

function unfold(raw: string): string {
  // RFC 5545 line folding: CRLF or LF followed by a space or tab
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

function toIsoDate(value: string): string | null {
  // Matches YYYYMMDD at the start — covers both date-only and datetime values
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

function prevDay(isoDate: string): string {
  const [y, mo, d] = isoDate.split('-').map(Number)
  const date = new Date(y!, mo! - 1, d!)
  date.setDate(date.getDate() - 1)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function parseIcal(raw: string): VacationEvent[] {
  const text = unfold(raw)
  const events: VacationEvent[] = []

  // Split into VEVENT blocks
  const veventRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g
  let match: RegExpExecArray | null

  while ((match = veventRe.exec(text)) !== null) {
    const block = match[1]!
    const lines = block.split(/\r?\n/).filter(Boolean)

    let uid = ''
    let summary = ''
    let start: string | null = null
    let end: string | null = null
    let status = 'CONFIRMED'

    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx < 0) continue
      // Property name is everything before the first colon, params stripped with ;
      const key = line.slice(0, colonIdx).split(';')[0]!.toUpperCase()
      const value = line.slice(colonIdx + 1)

      switch (key) {
        case 'UID':     uid = value; break
        case 'SUMMARY': summary = value.replace(/\\,/g, ',').replace(/\\n/g, ' ').trim(); break
        case 'DTSTART': start = toIsoDate(value); break
        case 'DTEND':   end = toIsoDate(value); break
        case 'STATUS':  status = value.trim().toUpperCase(); break
      }
    }

    if (!start) continue
    // iCal DTEND for all-day events is exclusive (day after last day)
    const inclusiveEnd = end ? prevDay(end) : start

    events.push({ uid, summary: summary || '(sin título)', start, end: inclusiveEnd, status })
  }

  return events
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchVacationEvents(): Promise<VacationEvent[]> {
  const url = process.env.VACATION_CALENDAR_ICAL_URL
  if (!url) return []

  try {
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('[vacation-calendar] fetch timeout')), 8_000),
    )
    const res = await Promise.race([
      fetch(url, { next: { revalidate: 3600 } }) as Promise<Response>,
      timeout,
    ])
    if (!res || !res.ok) return []
    const text = await res.text()
    const all = parseIcal(text)
    // Filtrar cancelados
    return all.filter((e) => e.status !== 'CANCELLED')
  } catch {
    return []
  }
}
