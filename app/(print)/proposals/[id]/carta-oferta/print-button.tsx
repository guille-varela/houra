'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        background: '#111',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '8px 18px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Imprimir / Guardar PDF
    </button>
  )
}
