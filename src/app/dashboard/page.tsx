// src/app/dashboard/page.tsx
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Navbar from '@/components/Navbar'
import type { ProviderDashboardData } from '@/types'

function QuotaBar({ current, quota }: { current: number; quota: number }) {
  const pct = Math.min((current / quota) * 100, 100)
  const color = pct >= 100 ? 'var(--error)' : pct >= 70 ? 'var(--warning)' : 'var(--accent)'
  return (
    <div>
      <div className="quota-bar" style={{ width: '100%' }}>
        <div className="quota-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function ProviderCard({
  provider,
  highlight,
}: {
  provider: ProviderDashboardData
  highlight: boolean
}) {
  const remaining = provider.monthlyQuota - provider.currentCount
  const statusClass = remaining <= 0 ? 'red' : remaining <= 3 ? 'yellow' : 'green'

  return (
    <div
      className="card fade-in"
      style={{
        outline: highlight ? `1px solid var(--accent)` : 'none',
        transition: 'outline 0.5s',
      }}
    >
      <div className="card-header">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${statusClass}`} />
          <span className="card-title">{provider.name}</span>
        </div>
        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          #{provider.id}
        </span>
      </div>
      <div className="card-body" style={{ padding: '14px 20px' }}>
        <div className="grid-3" style={{ marginBottom: '12px', gap: '8px' }}>
          <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div className="mono" style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)' }}>{provider.currentCount}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Received</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div className="mono" style={{ fontSize: '22px', fontWeight: '700', color: remaining <= 0 ? 'var(--error)' : remaining <= 3 ? 'var(--warning)' : 'var(--success)' }}>{remaining}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div className="mono" style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-muted)' }}>{provider.monthlyQuota}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quota</div>
          </div>
        </div>

        <QuotaBar current={provider.currentCount} quota={provider.monthlyQuota} />

        {provider.leads.length > 0 ? (
          <div style={{ marginTop: '14px' }}>
            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Recent Leads
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {provider.leads.slice(0, 8).map((lead) => (
                <div
                  key={lead.id}
                  style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '12px' }}
                >
                  <div className="flex justify-between items-center" style={{ marginBottom: '2px' }}>
                    <span style={{ fontWeight: '600', color: 'var(--text)' }}>{lead.customerName}</span>
                    <span className="badge badge-accent" style={{ fontSize: '10px' }}>{lead.serviceName}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>{lead.city} · {lead.phone}</div>
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {new Date(lead.assignedAt).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '14px', textAlign: 'center', padding: '12px', color: 'var(--text-dim)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
            No leads assigned yet
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<ProviderDashboardData[]>([])
  const [loading, setLoading] = useState(true)
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [highlightedProviders, setHighlightedProviders] = useState<Set<number>>(new Set())
  const [recentEvents, setRecentEvents] = useState<string[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers')
      const data = await res.json()
      if (data.success) {
        setProviders(data.data)
        setLastUpdate(new Date().toLocaleTimeString('en-IN'))
      }
    } catch (err) {
      console.error('Failed to fetch providers', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()

    // Connect SSE
    const es = new EventSource('/api/sse')
    eventSourceRef.current = es

    es.onopen = () => setSseStatus('connected')
    es.onerror = () => setSseStatus('disconnected')

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (event.type === 'CONNECTED') return

        if (event.type === 'LEAD_CREATED') {
          // Highlight newly assigned providers
          const ids: number[] = event.assignedProviderIds ?? []
          setHighlightedProviders(new Set(ids))
          setTimeout(() => setHighlightedProviders(new Set()), 4000)

          setRecentEvents((prev) =>
            [`Lead #${event.leadId} → ${event.serviceName} for ${event.customerName} (${event.city}) → providers [${ids.join(', ')}]`, ...prev].slice(0, 10)
          )
          fetchProviders()
        } else if (event.type === 'QUOTA_RESET') {
          setRecentEvents((prev) =>
            [`[WEBHOOK] ${event.message}`, ...prev].slice(0, 10)
          )
          fetchProviders()
        }
      } catch {}
    }

    return () => {
      es.close()
    }
  }, [fetchProviders])

  const totalLeads = providers.reduce((s, p) => s + p.currentCount, 0)
  const quotaFull = providers.filter((p) => p.remainingQuota <= 0).length

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 className="page-title">Provider Dashboard</h1>
              <p className="page-subtitle">// Live lead distribution overview</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2" style={{ fontSize: '12px', color: sseStatus === 'connected' ? 'var(--success)' : 'var(--error)' }}>
                {sseStatus === 'connected' ? <span className="live-dot" /> : <span style={{ width: '8px', height: '8px', background: 'var(--error)', borderRadius: '50%', display: 'inline-block' }} />}
                <span className="mono">{sseStatus === 'connected' ? 'LIVE' : sseStatus.toUpperCase()}</span>
              </div>
              {lastUpdate && (
                <span className="mono" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  updated {lastUpdate}
                </span>
              )}
              <button className="btn btn-secondary btn-sm" onClick={fetchProviders}>↻ Refresh</button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Total Providers', value: providers.length, color: 'var(--text)' },
            { label: 'Total Leads Distributed', value: totalLeads, color: 'var(--accent)' },
            { label: 'Quota Full', value: quotaFull, color: 'var(--error)' },
            { label: 'Active Providers', value: providers.length - quotaFull, color: 'var(--success)' },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
              <div className="mono" style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{loading ? '—' : s.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px', color: 'var(--text-muted)' }}>
            <span className="spinner" /> Loading provider data...
          </div>
        ) : (
          <div className="grid-4">
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                highlight={highlightedProviders.has(p.id)}
              />
            ))}
          </div>
        )}

        {/* Event Log */}
        {recentEvents.length > 0 && (
          <div className="card" style={{ marginTop: '24px' }}>
            <div className="card-header">
              <span className="card-title">Live Event Log</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setRecentEvents([])}>Clear</button>
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentEvents.map((ev, i) => (
                <div key={i} className="fade-in" style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-dim)', marginRight: '8px' }}>{String(i + 1).padStart(2, '0')}</span>
                  {ev}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
