'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { persons } from '@/db/schema'
import { getCurrentPerson, getOrganizationContext } from '@/lib/auth-helpers'
import { logAuditEvent } from '@/lib/audit'
import { BORING_VARIANTS } from '@/lib/avatar'

type ActionResult = { ok: true } | { ok: false; error: string }

const AVATAR_TYPES = ['initials', 'generated', 'upload', 'google'] as const
type AvatarType = (typeof AVATAR_TYPES)[number]

/**
 * Configura el avatar de una persona. Cada uno puede editar el suyo; admin/manager
 * pueden editar el de cualquiera de su organización. Upload/google quedan para fases
 * posteriores (R2 / OAuth) — aquí solo se aceptan 'initials' y 'generated'.
 */
export async function setPersonAvatar(input: {
  personId: string
  avatarType: AvatarType
  avatarSeed?: string | null
  avatarVariant?: string | null
  avatarColor?: string | null
}): Promise<ActionResult> {
  const [me, org] = await Promise.all([getCurrentPerson(), getOrganizationContext()])
  if (!me) return { ok: false, error: 'Sesión expirada.' }
  if (!org) return { ok: false, error: 'Organización no encontrada.' }

  const isSelf = me.id === input.personId
  const isManager = me.appRole === 'admin' || me.appRole === 'manager'
  if (!isSelf && !isManager) return { ok: false, error: 'No puedes editar este avatar.' }

  if (!AVATAR_TYPES.includes(input.avatarType)) return { ok: false, error: 'Tipo de avatar inválido.' }
  // Upload/Google aún no soportados desde esta acción (fases F2/F3).
  if (input.avatarType === 'upload' || input.avatarType === 'google') {
    return { ok: false, error: 'La subida de imagen y Google aún no están disponibles.' }
  }
  if (input.avatarType === 'generated' && input.avatarVariant && !(BORING_VARIANTS as readonly string[]).includes(input.avatarVariant)) {
    return { ok: false, error: 'Estilo de avatar no válido.' }
  }

  // La persona debe pertenecer a la org del actor.
  const [target] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, input.personId), eq(persons.organizationId, org.id)))
    .limit(1)
  if (!target) return { ok: false, error: 'Persona no encontrada.' }

  await db
    .update(persons)
    .set({
      avatarType: input.avatarType,
      avatarSeed: input.avatarSeed ?? null,
      avatarVariant: input.avatarType === 'generated' ? (input.avatarVariant ?? null) : null,
      avatarColor: input.avatarType === 'initials' ? (input.avatarColor ?? null) : null,
      updatedAt: new Date(),
    })
    .where(eq(persons.id, input.personId))

  await logAuditEvent({
    organizationId: org.id,
    actorId: me.id,
    action: 'person.set_avatar',
    entityType: 'person',
    entityId: input.personId,
    diff: { before: null, after: input },
  })

  revalidatePath('/people')
  revalidatePath(`/people/${input.personId}`)
  return { ok: true }
}
