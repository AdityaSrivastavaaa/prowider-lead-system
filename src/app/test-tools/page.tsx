// src/app/test-tools/page.tsx
'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'

interface LogEntry { time: string; type: 'success' | 'error' | 'info'; message: string; detail?: string }

function useLog() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const add = (type: LogEntry['type'], message: string, detail?: string) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString('en-IN'), type, message, detail }, ...prev].slice(0, 30))
  }
  return { logs, add, clear: () => setLogs([]) }
}

const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_WEBHOOK_SECRET ?? 'prowider-webhook-secret-2024'

export default function TestToolsPage() {
  const { logs, add, clear } = useLog()
  const [loading, setLoading] = useState<string | null>(null)

  // ── Webhook: Reset All Quotas ──
  async function resetAllQuotas() {
    const key = `reset-all-${Date.now()}`
    setLoading('reset-all')
    try {
      const res = await fetch('/api/webhook/quota-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
        body: JSON.stringify({ idempotencyKey: key, eventType: 'quota_reset' }),
      })
      const data = await res.json()
      add(data.success ? 'success' : 'error', data.message ?? 'Reset all quotas', JSON.stringify(data.data))
    } catch (e) {
      add('error', 'Network error: ' + String(e))
    } finally {
      setLoading(null)
    }
  }

  // ── Webhook: Idempotency Test ──
  // Calls same key 3 times — only first should actually process
  async function testIdempotency() {
    const key = `idempotency-test-${Date.now()}`
    setLoading('idempotency')
    add('info', `Testing idempotency with key: ${key}`)
    try {
      const calls = Array.from({ length: 3 }, (_, i) =>
        fetch('/api/webhook/quota-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
          body: JSON.stringify({ idempotencyKey: key, eventType: 'quota_reset' }),
        }).then((r) => r.json().then((d) => ({ call: i + 1, ...d })))
      )
      const results = await Promise.all(calls)
      results.forEach((r) => {
        add(
          r.success ? (r.idempotent ? 'info' : 'success') : 'error',
          `Call #${r.call}: ${r.message}`,
          `idempotent=${r.idempotent}`
        )
      })
    } catch (e) {
      add('error', 'Network error: ' + String(e))
    } finally {
      setLoading(null)
    }
  }

  // ── Bulk Lead Generation (10 concurrent) ──
  async function generateBulkLeads(serviceId?: number) {
    setLoading('bulk')
    add('info', `Generating 10 concurrent leads${serviceId ? ` for Service ${serviceId}` : ' (mixed services)'}...`)
    try {
      const res = await fetch('/api/test-tools/bulk-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10, serviceId }),
      })
      const data = await res.json()
      if (data.success) {
        add('success', `${data.data.succeeded}/${data.data.requested} leads created successfully`, `Failed: ${data.data.failed}`)
        if (data.data.failureReasons.length > 0) {
          add('error', 'Failure reasons: ' + data.data.failureReasons.slice(0, 3).join('; '))
        }
      } else {
        add('error', data.error ?? 'Bulk generation failed')
      }
    } catch (e) {
      add('error', 'Network error: ' + String(e))
    } finally {
      setLoading(null)
    }
  }

  // ── Reset Single Provider Quota ──
  async function resetProviderQuota(providerId: number) {
    const key = `reset-p${providerId}-${Date.now()}`
    setLoading(`reset-${providerId}`)
    try {
      const res = await fetch('/api/webhook/quota-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': WEBHOOK_SECRET },
        body: JSON.stringify({ providerId, idempotencyKey: key, eventType: 'quota_reset' }),
      })
      const data = await res.json()
      add(data.success ? 'success' : 'error', data.message ?? `Reset P${providerId} quota`)
    } catch (e) {
      add('error', 'Network error: ' + String(e))
    } finally {
      setLoading(null)
    }
  }

  const isLoading = (key: string) => loading === key

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Test Tools</h1>
          <p className="page-subtitle">// Webhook simulation & concurrency testing panel</p>
        </div>

        <div
          className="alert alert-warning"
          style={{ marginBottom: '24px' }}
        >
          <span>⚠</span>
          <div>
            This panel is for <strong>engineering testing only</strong>. Webhook actions here simulate payment confirmations and are NOT part of the normal user flow. Quota can ONLY be reset via webhook.
          </div>
        </div>

        <div className="grid-2" style={{ gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Quota Reset */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Webhook: Quota Reset</span>
                <span className="badge badge-blue">Idempotent</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Simulates a payment gateway confirming monthly subscription. Resets provider quota back to 10.
                  Uses a unique idempotency key per call.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={resetAllQuotas}
                  disabled={loading !== null}
                >
                  {isLoading('reset-all') ? <><span className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.2)' }} /> Resetting...</> : '↺  Reset ALL Provider Quotas'}
                </button>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <div className="form-label" style={{ marginBottom: '8px' }}>Reset Individual Provider</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((id) => (
                      <button
                        key={id}
                        className="btn btn-secondary btn-sm"
                        onClick={() => resetProviderQuota(id)}
                        disabled={loading !== null}
                      >
                        {isLoading(`reset-${id}`) ? <span className="spinner" /> : `P${id}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Idempotency Test */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Idempotency Test</span>
                <span className="badge badge-accent">Safety Check</span>
              </div>
              <div className="card-body">
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Fires the same webhook 3× simultaneously with the same idempotency key. Only the first call should process; the rest should return a cached response without re-executing.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={testIdempotency}
                  disabled={loading !== null}
                  style={{ width: '100%' }}
                >
                  {isLoading('idempotency') ? <><span className="spinner" /> Testing...</> : 'Fire Webhook ×3 (Same Key)'}
                </button>
              </div>
            </div>

            {/* Concurrency Test */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Concurrency Test</span>
                <span className="badge badge-yellow">Load Test</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Generates 10 leads simultaneously. Tests that allocation logic is correct under concurrency — no duplicate provider assignments, quota respected.
                </p>
                <button className="btn btn-warning" onClick={() => generateBulkLeads()} disabled={loading !== null} style={{ width: '100%' }}>
                  {isLoading('bulk') ? <><span className="spinner" /> Generating...</> : '⚡ Generate 10 Concurrent Leads (Mixed)'}
                </button>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                  {[1, 2, 3].map((sid) => (
                    <button
                      key={sid}
                      className="btn btn-secondary btn-sm"
                      onClick={() => generateBulkLeads(sid)}
                      disabled={loading !== null}
                    >
                      {isLoading('bulk') ? <span className="spinner" /> : `10x Service ${sid}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Event Log */}
          <div className="card" style={{ position: 'sticky', top: '68px' }}>
            <div className="card-header">
              <span className="card-title">Operation Log</span>
              <button className="btn btn-secondary btn-sm" onClick={clear}>Clear</button>
            </div>
            <div style={{ height: '520px', overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {logs.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                  // Run an operation to see results
                </div>
              )}
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="fade-in"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{log.time}</span>
                    <span style={{
                      color: log.type === 'success' ? 'var(--success)' : log.type === 'error' ? 'var(--error)' : 'var(--blue)',
                      flexShrink: 0,
                    }}>
                      {log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : 'ℹ'}
                    </span>
                    <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{log.message}</span>
                  </div>
                  {log.detail && (
                    <div style={{ marginTop: '3px', marginLeft: '52px', color: 'var(--text-dim)', fontSize: '11px' }}>
                      {log.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reference Info */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <span className="card-title">System Reference</span>
          </div>
          <div className="card-body">
            <div className="grid-3" style={{ gap: '20px' }}>
              <div>
                <div className="form-label" style={{ marginBottom: '8px' }}>Mandatory Assignment Rules</div>
                {[
                  { service: 'Service 1', providers: 'Provider 1 (mandatory)' },
                  { service: 'Service 2', providers: 'Provider 5 (mandatory)' },
                  { service: 'Service 3', providers: 'Provider 1 + 4 (mandatory)' },
                ].map((r) => (
                  <div key={r.service} style={{ marginBottom: '6px', fontSize: '12px' }}>
                    <span className="badge badge-accent" style={{ marginRight: '8px' }}>{r.service}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{r.providers}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: '8px' }}>Fair Pool Assignment</div>
                {[
                  { service: 'Service 1', pool: 'P2, P3, P4' },
                  { service: 'Service 2', pool: 'P6, P7, P8' },
                  { service: 'Service 3', pool: 'P2, P3, P5, P6, P7, P8' },
                ].map((r) => (
                  <div key={r.service} style={{ marginBottom: '6px', fontSize: '12px' }}>
                    <span className="badge badge-blue" style={{ marginRight: '8px' }}>{r.service}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{r.pool}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: '8px' }}>Webhook Config</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', lineHeight: '2' }}>
                  <div>Endpoint: <span style={{ color: 'var(--text)' }}>POST /api/webhook/quota-reset</span></div>
                  <div>Header: <span style={{ color: 'var(--text)' }}>x-webhook-secret</span></div>
                  <div>Body key: <span style={{ color: 'var(--text)' }}>idempotencyKey (required)</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
