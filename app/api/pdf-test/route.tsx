import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.PDF_TEST_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const { renderToBuffer, Document, Page, Text, StyleSheet } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 40 },
    title: { fontSize: 24, marginBottom: 8 },
    sub: { fontSize: 12, color: '#666' },
  })

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Houra</Text>
        <Text style={styles.sub}>React-PDF operativo — Phase 00 ✓</Text>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="houra-test.pdf"',
    },
  })
}
