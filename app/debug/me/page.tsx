import { getCurrentPerson, getOrganizationContext } from '@/lib/auth-helpers'

export default async function DebugMePage() {
  const [person, org] = await Promise.all([getCurrentPerson(), getOrganizationContext()])

  return (
    <div
      style={{
        fontFamily: 'monospace',
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
        Debug — Current Person Context
      </h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Organization</h2>
        {org ? (
          <pre
            style={{
              background: '#f4f4f4',
              padding: '1rem',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(org, null, 2)}
          </pre>
        ) : (
          <p style={{ color: 'red' }}>No organization found</p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Current Person</h2>
        {person ? (
          <>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Role:</strong>{' '}
              <span
                style={{
                  background: '#000',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                }}
              >
                {person.appRole}
              </span>{' '}
              &nbsp;
              <strong>Category:</strong> {person.professionalCategory} &nbsp;
              <strong>Area:</strong> {person.primaryArea}
            </p>
            <pre
              style={{
                background: '#f4f4f4',
                padding: '1rem',
                borderRadius: '4px',
                overflow: 'auto',
              }}
            >
              {JSON.stringify(person, null, 2)}
            </pre>
          </>
        ) : (
          <p style={{ color: 'orange' }}>
            Not authenticated. <a href="/login">Go to login →</a>
          </p>
        )}
      </section>
    </div>
  )
}
