'use client'

import { Avatar } from '@mantine/core'
import BoringAvatar from 'boring-avatars'
import { resolveAvatar, AVATAR_PALETTE, type AvatarPerson } from '@/lib/avatar'

/**
 * Avatar circular canónico de persona. Resuelve la cascada upload/google >
 * generated (boring-avatars) > initials (color determinista). Reemplaza el
 * `Monogram` cuadrado inline de la sidebar.
 */
export function PersonAvatar({ person, size = 32 }: { person: AvatarPerson; size?: number }) {
  const a = resolveAvatar(person)

  if (a.kind === 'image') {
    return <Avatar src={a.src} alt={person.name} size={size} radius="xl" />
  }

  if (a.kind === 'generated') {
    return (
      <span
        style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}
        title={person.name}
      >
        <BoringAvatar size={size} name={a.seed} variant={a.variant} colors={[...AVATAR_PALETTE]} />
      </span>
    )
  }

  // Iniciales sobre color determinista.
  return (
    <div
      title={person.name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: a.color,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: Math.round(size * 0.4),
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {a.initials}
    </div>
  )
}
