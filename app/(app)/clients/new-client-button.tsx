'use client'

import { useState } from 'react'
import { Button, Modal, TextInput, Group } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { createClient } from '@/actions/clients'

export default function NewClientButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const result = await createClient({ name })
      if (result.ok) {
        notifications.show({ color: 'green', message: 'Cliente creado · ' + name })
        setOpen(false)
        setName('')
        router.push(`/clients/${result.id}`)
      }
    } catch {
      notifications.show({ color: 'red', message: 'No se pudo crear el cliente' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        leftSection={<IconPlus size={14} />}
        size="sm"
        onClick={() => setOpen(true)}
      >
        Nuevo cliente
      </Button>

      <Modal opened={open} onClose={() => setOpen(false)} title="Nuevo cliente" size="sm">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Nombre del cliente"
            placeholder="Ej: Iberdrola, Banco Santander…"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            autoFocus
            mb="md"
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading} disabled={!name.trim()}>
              Crear cliente
            </Button>
          </Group>
        </form>
      </Modal>
    </>
  )
}
