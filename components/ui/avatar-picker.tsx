'use client'

import { useState, useTransition } from 'react'
import { Popover, Tabs, Group, Stack, Button, Text, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import BoringAvatar from 'boring-avatars'
import { PersonAvatar } from './person-avatar'
import { BORING_VARIANTS, AVATAR_PALETTE, type AvatarPerson } from '@/lib/avatar'
import { setPersonAvatar } from '@/actions/avatar'

type Draft = Pick<AvatarPerson, 'avatarType' | 'avatarSeed' | 'avatarVariant' | 'avatarColor'>

// Colores deterministas para las iniciales (hues repartidos, S/L del sistema).
const INITIAL_COLORS = [0, 30, 130, 200, 260, 330].map((h) => `hsl(${h}, 42%, 58%)`)

export function AvatarPicker({
  person,
  canEdit,
  size = 56,
}: {
  person: AvatarPerson
  canEdit: boolean
  size?: number
}) {
  const [opened, setOpened] = useState(false)
  const [draft, setDraft] = useState<Draft>({
    avatarType: person.avatarType,
    avatarSeed: person.avatarSeed ?? person.id,
    avatarVariant: person.avatarVariant ?? 'beam',
    avatarColor: person.avatarColor ?? null,
  })
  const [isSaving, startSave] = useTransition()

  const preview: AvatarPerson = { ...person, ...draft }

  function save() {
    startSave(async () => {
      const res = await setPersonAvatar({
        personId: person.id,
        avatarType: draft.avatarType,
        avatarSeed: draft.avatarSeed ?? null,
        avatarVariant: draft.avatarVariant ?? null,
        avatarColor: draft.avatarColor ?? null,
      })
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error })
        return
      }
      notifications.show({ color: 'teal', message: 'Avatar actualizado.' })
      setOpened(false)
    })
  }

  if (!canEdit) return <PersonAvatar person={person} size={size} />

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow shadow="md" width={300}>
      <Popover.Target>
        <UnstyledButton onClick={() => setOpened((o) => !o)} title="Cambiar avatar">
          <PersonAvatar person={person} size={size} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="center">
            <PersonAvatar person={preview} size={64} />
          </Group>

          <Tabs
            value={draft.avatarType === 'generated' ? 'gallery' : 'initials'}
            onChange={(v) =>
              setDraft((d) => ({ ...d, avatarType: v === 'gallery' ? 'generated' : 'initials' }))
            }
          >
            <Tabs.List grow>
              <Tabs.Tab value="initials">Iniciales</Tabs.Tab>
              <Tabs.Tab value="gallery">Galería</Tabs.Tab>
              <Tabs.Tab value="upload" disabled>
                Subir
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="initials" pt="sm">
              <Group gap="xs" justify="center">
                {INITIAL_COLORS.map((c) => (
                  <UnstyledButton
                    key={c}
                    onClick={() => setDraft((d) => ({ ...d, avatarType: 'initials', avatarColor: c }))}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: c,
                      outline: draft.avatarColor === c ? '2px solid var(--h-accent)' : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="gallery" pt="sm">
              <Group gap="xs" justify="center">
                {BORING_VARIANTS.map((variant) => (
                  <UnstyledButton
                    key={variant}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        avatarType: 'generated',
                        avatarVariant: variant,
                        avatarSeed: d.avatarSeed ?? person.id,
                      }))
                    }
                    style={{
                      borderRadius: '50%',
                      outline: draft.avatarVariant === variant ? '2px solid var(--h-accent)' : 'none',
                      outlineOffset: 2,
                      lineHeight: 0,
                    }}
                  >
                    <BoringAvatar
                      size={34}
                      name={draft.avatarSeed ?? person.id}
                      variant={variant}
                      colors={[...AVATAR_PALETTE]}
                    />
                  </UnstyledButton>
                ))}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="upload" pt="sm">
              <Text size="xs" c="dimmed" ta="center">
                Subida de imagen y foto de Google: próximamente.
              </Text>
            </Tabs.Panel>
          </Tabs>

          <Button size="xs" onClick={save} loading={isSaving} fullWidth>
            Guardar
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
