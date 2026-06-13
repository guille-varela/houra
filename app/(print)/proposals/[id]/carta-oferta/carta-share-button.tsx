'use client'

import { useState, useTransition } from 'react'
import { Modal, Stack, Text, TextInput, Button, Group, CopyButton, Code } from '@mantine/core'
import { IconShare, IconCheck, IconCopy } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { createReport } from '@/actions/reports'

/** Botón "Compartir" de la carta oferta (F2.13). Genera un enlace público
 *  reutilizando la infraestructura de reportes (slug + contraseña opcional). */
export default function CartaShareButton({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await createReport({
        scope: 'proposal',
        scopeId: proposalId,
        ...(password.trim().length >= 4 ? { password: password.trim() } : {}),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const shareUrl = `${window.location.origin}/r/${result.slug}`
      setUrl(shareUrl)
      try {
        await navigator.clipboard.writeText(shareUrl)
        notifications.show({ color: 'green', message: 'Enlace copiado al portapapeles' })
      } catch {
        notifications.show({ color: 'blue', message: 'Enlace generado' })
      }
    })
  }

  function reset() {
    setOpen(false)
    setPassword('')
    setUrl(null)
    setError(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
          color: '#555', background: 'none', padding: '4px 10px', borderRadius: 6,
          border: '1px solid #dde1ec', cursor: 'pointer',
        }}
      >
        <IconShare size={14} /> Compartir
      </button>

      <Modal opened={open} onClose={reset} title="Compartir carta oferta" size="md" centered>
        <Stack gap="md">
          {!url ? (
            <>
              <Text size="sm" c="dimmed">
                Se genera un enlace con una dirección no adivinable. Puedes añadir una contraseña
                opcional (mín. 4 caracteres) para una capa extra de protección.
              </Text>
              <TextInput
                label="Contraseña (opcional)"
                placeholder="Déjalo vacío para enlace sin contraseña"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
              />
              {error && <Text size="sm" c="red">{error}</Text>}
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={reset} disabled={isPending}>Cancelar</Button>
                <Button leftSection={<IconShare size={14} />} loading={isPending} onClick={generate}>
                  Generar enlace
                </Button>
              </Group>
            </>
          ) : (
            <>
              <Text size="sm">Enlace listo y copiado al portapapeles:</Text>
              <Group gap="xs" wrap="nowrap">
                <Code style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '8px 10px' }}>
                  {url}
                </Code>
                <CopyButton value={url}>
                  {({ copied, copy }) => (
                    <Button
                      size="sm"
                      variant="light"
                      color={copied ? 'green' : 'blue'}
                      leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      onClick={copy}
                    >
                      {copied ? 'Copiado' : 'Copiar'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              {password.trim().length >= 4 && (
                <Text size="xs" c="dimmed">Protegido con contraseña. Compártela por separado con el destinatario.</Text>
              )}
              <Group justify="flex-end">
                <Button onClick={reset}>Hecho</Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  )
}
