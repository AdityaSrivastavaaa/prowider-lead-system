// src/app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      <nav className="nav">
        <span className="nav-brand">PROWIDER</span>
        <div className="nav-links">
          <Link href="/request-service" className="nav-link">Request Service</Link>
          <Link href="/dashboard" className="nav-link">Dashboard</Link>
          <Link href="/test-tools" className="nav-link">Test Tools</Link>
        </div>
      </nav>
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 52px)', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px' }}>
          <p className="mono" style={{ fontSize: '11px', color: 'var(--accent)', letterSpacing: '0.15em', marginBottom: '16px' }}>PROWIDER PLATFORM</p>
          <h1 style={{ fontSize: '36px', fontWeight: '700', lineHeight: '1.15', marginBottom: '16px' }}>
            Lead Distribution<br />
            <span style={{ color: 'var(--text-muted)' }}>Management System</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: '1.7' }}>
            Automated, fair, and real-time lead allocation engine for service providers.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/request-service" className="btn btn-primary">Submit Service Request</Link>
            <Link href="/dashboard" className="btn btn-secondary">Provider Dashboard</Link>
            <Link href="/test-tools" className="btn btn-secondary">Test Tools</Link>
          </div>
          <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px', textAlign: 'left' }}>
            {[
              { label: 'Fair Allocation', desc: 'Round-robin distribution across provider pools' },
              { label: 'Real-Time', desc: 'SSE-powered instant dashboard updates' },
              { label: 'Idempotent', desc: 'Safe webhook processing with deduplication' },
            ].map((f) => (
              <div key={f.label} className="card" style={{ padding: '16px' }}>
                <div className="mono" style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '6px' }}>{f.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
