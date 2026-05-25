// JS/TS references to --h-* CSS variables defined in app/globals.css.
// Use these in Mantine style props, inline styles, and computed color logic.
// Phase 09 migration: update globals.css :root block + MANTINE_PRIMARY below — zero component changes.

export const hColors = {
  // Brand (neutral gray in wireframe; swapped to brand palette in Phase 09)
  brand:         'var(--h-brand)',
  brandLight:    'var(--h-brand-light)',
  brandText:     'var(--h-brand-text)',

  // Surfaces
  surface:       'var(--h-surface)',
  surfaceRaised: 'var(--h-surface-raised)',
  surfaceSubtle: 'var(--h-surface-subtle)',

  // Borders
  border:        'var(--h-border)',
  borderStrong:  'var(--h-border-strong)',

  // Text
  text:          'var(--h-text)',
  textSubtle:    'var(--h-text-subtle)',
  textDisabled:  'var(--h-text-disabled)',
  textInverse:   'var(--h-text-inverse)',

  // Status — functional traffic-light (never swap in Phase 09)
  success:       'var(--h-success)',
  successBg:     'var(--h-success-bg)',
  warning:       'var(--h-warning)',
  warningBg:     'var(--h-warning-bg)',
  caution:       'var(--h-caution)',
  cautionBg:     'var(--h-caution-bg)',
  danger:        'var(--h-danger)',
  dangerBg:      'var(--h-danger-bg)',
} as const

export const hFonts = {
  sans: 'var(--h-font-sans)',
  mono: 'var(--h-font-mono)',
} as const

// Mantine primaryColor key — update this in Phase 09 alongside globals.css --h-brand vars
export const MANTINE_PRIMARY = 'gray' as const

// ─── Traffic-light helpers ───────────────────────────────────────────────────
// Returns a Mantine color name for use in c="..." or color="..." props.

// Consumption cells: pct = consumed/planned × 100; null = unplanned (no allocation set)
export function consumptionColor(pct: number | null): 'green' | 'orange' | 'red' {
  if (pct === null || pct >= 100) return 'red'
  if (pct >= 80) return 'orange'
  return 'green'
}

// Margin cells: pct = (sold - cost) / sold × 100
export function marginColor(pct: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (pct < 0) return 'red'
  if (pct < 5) return 'orange'
  if (pct < 20) return 'yellow'
  return 'green'
}
