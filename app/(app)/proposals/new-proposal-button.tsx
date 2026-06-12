'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Modal, TextInput, Stack, Alert } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { createProposal } from '@/actions/proposals'

export default function NewProposalButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!name.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await createProposal({ name: name.trim() })
      if (result.ok) {
        notifications.show({ color: 'green', message: 'Propuesta creada · ' + name.trim() })
        setOpen(false)
        setName('')
        router.push(`/proposals/${result.id}`)
      } else {
        setError('Error al crear la propuesta.')
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        leftSection={<IconPlus size={14} />}
        onClick={() => setOpen(true)}
      >
        Nueva propuesta
      </Button>

      <Modal
        opened={open}
        onClose={() => { setOpen(false); setName('') }}
        title="Nueva propuesta"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Nombre"
            placeholder="Propuesta rediseño web…"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          {error && (
            <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Button loading={isPending} disabled={!name.trim()} onClick={handleSubmit}>
            Crear propuesta
          </Button>
        </Stack>
      </Modal>
    </>
  )
}
