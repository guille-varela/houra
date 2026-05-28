import { createSign } from 'crypto'

// ─── Display config ───────────────────────────────────────────────────────────

const NAME_MAP: Record<string, string> = {
  'Daniel Peña':      'Dani Peña',
  'Daniel Sánchez':   'Dani S.',
  'Jessica López':    'Jess',
  'Álvaro Medrano':   'A. Medrano',
  'Álvaro del Valle': 'A. Del Valle',
  'Lucía Álvarez':    'Lucía Á.',
  'Jordi Niubó':      'Jordi',
  'Fernando Llorente':'Fernando',
  'Alberto Prieto':   'Alberto',
  'Andrea Blanco':    'Andrea',
  'Agostina Giannelli':'Agostina',
  'Emilio Cuchillo':  'Emilio',
  'Carlos Ochoa':     'Carlos',
  'Carla López':      'Carla',
  'Antonio Díaz':     'Antonio',
  'Ion Gómez':        'Ion',
  'Naiara Pascual':   'Naiara',
  'Dani Zilch':       'Zilch',
}

const BAJA_NAMES = new Set(['Jessica López'])

function displayName(raw: string): string {
  return NAME_MAP[raw] ?? raw
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type DayStatus = 'aprobado' | 'pendiente' | 'bloqueado'

export type VacationRange = {
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
  days: number
  status: DayStatus
}

export type PersonBalance = {
  name: string
  nameRaw: string
  diasDisponibles: number
  diasTotal: number
  diasUsados: number
  beKind: boolean
  diasN: number
  diasN1: number
  isBaja: boolean
  vacations: VacationRange[]
}

// ─── Color classification ─────────────────────────────────────────────────────

type RGB = { red?: number; green?: number; blue?: number }

function classifyBg(bg: RGB | null | undefined): DayStatus | null {
  if (!bg) return null
  const r = bg.red ?? 1
  const g = bg.green ?? 1
  const b = bg.blue ?? 1

  // White / transparent (default) → no status
  if (r > 0.92 && g > 0.92 && b > 0.92) return null

  // Black / very dark → bloqueado (festivo, fin de semana)
  if (r < 0.15 && g < 0.15 && b < 0.15) return 'bloqueado'

  // Dark grey / charcoal → also bloqueado
  if (r < 0.35 && g < 0.35 && b < 0.35) return 'bloqueado'

  // Green: green channel clearly dominant → aprobado
  if (g > 0.5 && g > r * 1.4 && g > b + 0.15) return 'aprobado'

  // Teal/cyan greens also → aprobado
  if (g > 0.5 && b > 0.4 && r < 0.5) return 'aprobado'

  // Yellow / amber: high red + high green, low blue → pendiente
  if (r > 0.75 && g > 0.65 && b < 0.4) return 'pendiente'

  // Orange-yellow edge case
  if (r > 0.9 && g > 0.5 && b < 0.3) return 'pendiente'

  return null
}

// ─── Fetch helper ────────────────────────────────────────────────────────────

function fetchWithTimeout(
  url: string,
  options: RequestInit & { next?: { revalidate?: number } },
  ms = 8_000,
): Promise<Response> {
  return Promise.race([
    fetch(url, options) as Promise<Response>,
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error(`[sheets-vacaciones] fetch timeout ${ms}ms: ${url}`)), ms),
    ),
  ])
}

// ─── Google Auth ──────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL ?? ''
  const privateKey  = (process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const hdr = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const pay = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${hdr}.${pay}`)
  const jwt = `${hdr}.${pay}.${sign.sign(privateKey, 'base64url')}`

  const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('No access token')
  return data.access_token
}

// ─── API calls (two separate, parallel) ──────────────────────────────────────

async function fetchValues(
  token: string,
  spreadsheetId: string,
  year: number,
): Promise<(string | number)[][]> {
  const range = encodeURIComponent(String(year))
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `/values/${range}?valueRenderOption=UNFORMATTED_VALUE`

  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`[sheets-vacaciones] Values API ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { values?: (string | number)[][] }
  return data.values ?? []
}

type ColorRow = { values?: Array<{ effectiveFormat?: { backgroundColor?: RGB } }> }

async function fetchColors(
  token: string,
  spreadsheetId: string,
  year: number,
): Promise<ColorRow[]> {
  const range  = encodeURIComponent(String(year))
  const fields = encodeURIComponent('sheets.data.rowData.values.effectiveFormat.backgroundColor')
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?includeGridData=true&ranges=${range}&fields=${fields}`

  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`[sheets-vacaciones] Colors API ${res.status}: ${body}`)
  }
  const data = (await res.json()) as {
    sheets?: Array<{ data?: Array<{ rowData?: ColorRow[] }> }>
  }
  return data.sheets?.[0]?.data?.[0]?.rowData ?? []
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function isoDate(year: number, dayOfYear: number): string {
  const d = new Date(year, 0, dayOfYear)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

type DayEntry = { doy: number; status: DayStatus }

function groupRanges(days: DayEntry[], year: number): VacationRange[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => a.doy - b.doy)
  const ranges: VacationRange[] = []

  let start = sorted[0]!
  let prev   = sorted[0]!

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    if (cur.doy === prev.doy + 1 && cur.status === prev.status) {
      prev = cur
    } else {
      ranges.push({
        start: isoDate(year, start.doy),
        end:   isoDate(year, prev.doy),
        days:  prev.doy - start.doy + 1,
        status: start.status,
      })
      start = cur
      prev  = cur
    }
  }
  ranges.push({
    start: isoDate(year, start.doy),
    end:   isoDate(year, prev.doy),
    days:  prev.doy - start.doy + 1,
    status: start.status,
  })
  return ranges
}

function parseData(
  values: (string | number)[][],
  colorRows: ColorRow[],
  year: number,
): PersonBalance[] {
  if (values.length < 3) return []

  // Locate calendar start from row 0 (where 'Enero' appears)
  const row0 = values[0] ?? []
  const calOffset = row0.findIndex(
    (v) => String(v).trim().toLowerCase() === 'enero',
  )
  if (calOffset < 0) return []

  const people: PersonBalance[] = []

  for (let r = 2; r < values.length; r++) {
    const row = values[r] ?? []
    const nameRaw = String(row[0] ?? '').trim()
    if (!nameRaw) continue

    const diasDisp = Number(row[1])
    if (isNaN(diasDisp)) continue

    const beKind  = Number(row[2]) === 1
    const diasN   = Number(row[3]) || 0
    const diasN1  = Number(row[4]) || 0
    const diasTotal  = diasN + diasN1
    const diasUsados = Math.max(0, diasTotal - diasDisp)

    const colorsRow = colorRows[r]
    const vacDays: DayEntry[] = []

    for (let c = calOffset; c < row.length; c++) {
      const val    = row[c]
      const bg     = colorsRow?.values?.[c]?.effectiveFormat?.backgroundColor ?? null
      const status = classifyBg(bg)

      if ((val === 1 || val === '1') && status !== 'bloqueado') {
        vacDays.push({ doy: c - calOffset + 1, status: status ?? 'pendiente' })
      }
    }

    people.push({
      name:            displayName(nameRaw),
      nameRaw,
      diasDisponibles: diasDisp,
      diasTotal,
      diasUsados,
      beKind,
      diasN,
      diasN1,
      isBaja:          BAJA_NAMES.has(nameRaw),
      vacations:       groupRanges(vacDays, year),
    })
  }

  return people
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchSheetVacaciones(
  year = new Date().getFullYear(),
): Promise<PersonBalance[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  if (!spreadsheetId || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) return []

  try {
    const token = await getAccessToken()
    const [values, colorRows] = await Promise.all([
      fetchValues(token, spreadsheetId, year),
      fetchColors(token, spreadsheetId, year),
    ])
    return parseData(values, colorRows, year)
  } catch (err) {
    console.error('[sheets-vacaciones]', err)
    return []
  }
}
