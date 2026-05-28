'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Modal, TextInput, Text, UnstyledButton } from '@mantine/core'
import { useHotkeys } from '@mantine/hooks'
import { useRouter } from 'next/navigation'
import { IconSearch, IconFolders, IconUsers, IconArrowRight } from '@tabler/icons-react'

type SearchResult = {
  projects: Array<{ id: string; name: string; status: string }>
  people: Array<{ id: string; name: string; email: string }>
}

type FlatResult =
  | { kind: 'project'; id: string; name: string; subtitle: string; href: string }
  | { kind: 'person'; id: string; name: string; subtitle: string; href: string }

function flatten(data: SearchResult): FlatResult[] {
  const results: FlatResult[] = []
  for (const p of data.projects) {
    results.push({ kind: 'project', id: p.id, name: p.name, subtitle: p.status, href: `/projects/${p.id}` })
  }
  for (const p of data.people) {
    results.push({ kind: 'person', id: p.id, name: p.name, subtitle: p.email, href: `/people` })
  }
  return results
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FlatResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useHotkeys([['mod+k', () => setOpen(true)]])

  useEffect(() => {
    function onCustomEvent() { setOpen(true) }
    window.addEventListener('houra:search', onCustomEvent)
    return () => window.removeEventListener('houra:search', onCustomEvent)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setActiveIdx(0)
    } else {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: SearchResult = await res.json()
        setResults(flatten(data))
        setActiveIdx(0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 200)
  }

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIdx]) {
      navigate(results[activeIdx]!.href)
    }
  }

  return (
    <Modal
      opened={open}
      onClose={() => setOpen(false)}
      withCloseButton={false}
      padding={0}
      radius="lg"
      size={480}
      styles={{
        content: {
          background: 'var(--h-surface-raised)',
          border: '1px solid var(--h-border)',
          overflow: 'hidden',
        },
        overlay: { backdropFilter: 'blur(4px)' },
      }}
    >
      <div onKeyDown={handleKeyDown}>
        <TextInput
          ref={inputRef}
          value={query}
          onChange={(e) => handleQueryChange(e.currentTarget.value)}
          placeholder="Buscar proyectos, personas…"
          leftSection={<IconSearch size={15} style={{ color: 'var(--h-text-disabled)' }} />}
          styles={{
            input: {
              border: 'none',
              borderBottom: '1px solid var(--h-border)',
              borderRadius: '12px 12px 0 0',
              height: 48,
              fontSize: 14,
              background: 'var(--h-surface-raised)',
              color: 'var(--h-text)',
              padding: '0 16px 0 40px',
            },
            section: { paddingLeft: 14 },
          }}
        />

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {!query.trim() && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Escribe para buscar proyectos y personas</Text>
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center' }}>
              <Text size="xs" c="dimmed">Sin resultados para «{query}»</Text>
            </div>
          )}

          {results.length > 0 && (
            <div style={{ padding: '6px 6px' }}>
              {results.map((item, idx) => (
                <UnstyledButton
                  key={`${item.kind}-${item.id}`}
                  onClick={() => navigate(item.href)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: idx === activeIdx ? 'var(--h-surface-subtle)' : 'transparent',
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: 'var(--h-surface-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {item.kind === 'project'
                      ? <IconFolders size={14} strokeWidth={1.5} style={{ color: 'var(--h-text-subtle)' }} />
                      : <IconUsers size={14} strokeWidth={1.5} style={{ color: 'var(--h-text-subtle)' }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} style={{ color: 'var(--h-text)', lineHeight: 1.3 }} truncate>
                      {item.name}
                    </Text>
                    <Text size="xs" style={{ color: 'var(--h-text-disabled)', lineHeight: 1.3 }} truncate>
                      {item.kind === 'project' ? (STATUS_LABELS[item.subtitle] ?? item.subtitle) : item.subtitle}
                    </Text>
                  </div>
                  <IconArrowRight size={13} strokeWidth={1.5} style={{ color: 'var(--h-text-disabled)', flexShrink: 0 }} />
                </UnstyledButton>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          borderTop: '1px solid var(--h-border)',
          padding: '6px 14px',
          display: 'flex',
          gap: 12,
        }}>
          {[['↑↓', 'navegar'], ['↵', 'abrir'], ['Esc', 'cerrar']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontSize: 10,
                color: 'var(--h-text-disabled)',
                background: 'var(--h-surface-subtle)',
                border: '1px solid var(--h-border)',
                borderRadius: 4,
                padding: '1px 5px',
              }}>{key}</span>
              <Text size="xs" c="dimmed">{label}</Text>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
