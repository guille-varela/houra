# ADR-0006 — DM Sans + paleta azul-gris

**Estado:** Aceptado · 2026-05-27

## Contexto

En wireframe mode la app usaba Inter + escala de grises pura. Phase 09 introduce identidad visual sin llegar a un branding de producto completo.

## Decisión

**Tipografía:** DM Sans (pesos 300–700) como única fuente. Variable CSS: `--font-dm-sans`. Inter, Roboto y Encode Sans eliminados del bundle.

**Paleta** (tokens en `app/globals.css`):

| Variable CSS | Valor | Uso |
|---|---|---|
| `--h-surface` | `#F2F5FA` | Fondo exterior de página |
| `--h-surface-raised` | `#FFFFFF` | Shell de contenido, cards |
| `--h-surface-subtle` | `#EEF2FA` | Elementos inset, aside, chips |
| `--h-brand` | `#3C3C3C` | Near-black para acciones primarias |
| `--h-text` | `#111111` | Texto principal |
| `--h-text-subtle` | `#555555` | Texto secundario |
| `--h-text-disabled` | `#9A9A9A` | Placeholders |
| `--h-border` | `#DDE1EC` | Bordes (azul-tintado) |

Los tokens de estado (`--h-success`, `--h-warning`, `--h-caution`, `--h-danger`) son funcionales y no forman parte de la paleta de marca — no cambiar.

## Cómo usar los tokens

```tsx
// En inline styles:
style={{ background: 'var(--h-surface-subtle)', border: '1px solid var(--h-border)' }}

// En Tailwind (mapeados en @theme):
className="bg-h-surface text-h-text border-h-border"
```
