/**
 * Avatares — helpers puros (sin DB ni DOM).
 *
 * Provisional: iniciales con color determinista (suelo siempre presente) + avatares
 * generados con `boring-avatars`. Futuro: upload (R2) y foto de Google (Better Auth).
 * Cascada de resolución del avatar a mostrar: upload > google > generated > initials.
 */

export const BORING_VARIANTS = ['marble', 'beam', 'bauhaus', 'pixel', 'sunset', 'ring'] as const
export type BoringVariant = (typeof BORING_VARIANTS)[number]

// Paleta contenida (estilo Notion/Google) para los avatares generados.
export const AVATAR_PALETTE = ['#6B7180', '#1B66C9', '#37b24d', '#f59f00', '#7048e8', '#1098ad']

/** Iniciales: primera + última palabra del nombre (máx. 2 letras). */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Color de fondo determinista para las iniciales (HSL con S/L suaves fijos →
 * paleta contenida, legible con texto claro encima). Mismo seed → mismo color.
 */
export function avatarColorFor(seed: string): string {
  const hue = hashString(seed) % 360
  return `hsl(${hue}, 42%, 58%)`
}

export function isBoringVariant(v: string | null | undefined): v is BoringVariant {
  return !!v && (BORING_VARIANTS as readonly string[]).includes(v)
}

/** Datos mínimos de persona para resolver su avatar. */
export type AvatarPerson = {
  id: string
  name: string
  avatarType: 'initials' | 'generated' | 'upload' | 'google'
  avatarUrl?: string | null
  avatarSeed?: string | null
  avatarVariant?: string | null
  avatarColor?: string | null
}

export type ResolvedAvatar =
  | { kind: 'image'; src: string; initials: string }
  | { kind: 'generated'; seed: string; variant: BoringVariant; initials: string }
  | { kind: 'initials'; initials: string; color: string }

/** Resuelve qué renderizar siguiendo la cascada upload/google > generated > initials. */
export function resolveAvatar(p: AvatarPerson): ResolvedAvatar {
  const initials = getInitials(p.name)
  if ((p.avatarType === 'upload' || p.avatarType === 'google') && p.avatarUrl) {
    return { kind: 'image', src: p.avatarUrl, initials }
  }
  if (p.avatarType === 'generated') {
    return {
      kind: 'generated',
      seed: p.avatarSeed || p.id,
      variant: isBoringVariant(p.avatarVariant) ? p.avatarVariant : 'beam',
      initials,
    }
  }
  return { kind: 'initials', initials, color: p.avatarColor || avatarColorFor(p.avatarSeed || p.id) }
}
