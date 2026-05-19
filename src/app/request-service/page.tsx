// src/app/request-service/page.tsx
'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'

interface Service { id: number; name: string; description: string | null }
interface FormState { name: string; phone: string; city: string; serviceId: string; description: string }
interface FieldErrors { name?: string[]; phone?: string[]; city?: string[]; serviceId?: string[]; description?: string[] }

const INITIAL_FORM: FormState = { name: '', phone: '', city: '', serviceId: '', description: '' }

export default function RequestServicePage() {
  const [services, setServices] = useState<Service[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'duplicate'; message: string } | null>(null)
  const [leadId, setLeadId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((d) => d.success && setServices(d.data))
      .catch(console.error)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    setLeadId(null)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, serviceId: Number(form.serviceId) }),
      })
      const data = await res.json()

      if (res.status === 400 && data.details) {
        setErrors(data.details)
        setResult({ type: 'error', message: 'Please fix the errors below.' })
      } else if (res.status === 409) {
        setResult({ type: 'duplicate', message: data.message ?? 'A lead with this phone number for this service already exists.' })
      } else if (res.ok && data.success) {
        setResult({ type: 'success', message: `Service request submitted successfully! Assigned to ${data.data.assignedProviders.length} provider(s).` })
        setLeadId(data.data.leadId)
        setForm(INITIAL_FORM)
      } else {
        setResult({ type: 'error', message: data.error ?? 'Something went wrong. Please try again.' })
      }
    } catch {
      setResult({ type: 'error', message: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="page" style={{ maxWidth: '560px' }}>
        <div className="page-header">
          <h1 className="page-title">Request a Service</h1>
          <p className="page-subtitle">// Fill in your details to get matched with providers</p>
        </div>

        {result && (
          <div
            className={`alert ${result.type === 'success' ? 'alert-success' : result.type === 'duplicate' ? 'alert-warning' : 'alert-error'} mb-4 fade-in`}
            style={{ marginBottom: '20px' }}
          >
            <span>{result.type === 'success' ? '✓' : result.type === 'duplicate' ? '⚠' : '✗'}</span>
            <div>
              <div>{result.message}</div>
              {leadId && <div className="mono" style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>Lead ID: #{leadId}</div>}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title">Service Enquiry Form</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  type="text"
                  name="name"
                  placeholder="Rahul Sharma"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
                {errors.name && <div className="form-error">{errors.name[0]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  type="tel"
                  name="phone"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={handleChange}
                  maxLength={10}
                  required
                />
                {errors.phone && <div className="form-error">{errors.phone[0]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  className="form-input"
                  type="text"
                  name="city"
                  placeholder="Mumbai"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
                {errors.city && <div className="form-error">{errors.city[0]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Service Type</label>
                <select
                  className="form-select"
                  name="serviceId"
                  value={form.serviceId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a service...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.description ? ` — ${s.description}` : ''}
                    </option>
                  ))}
                </select>
                {errors.serviceId && <div className="form-error">{errors.serviceId[0]}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  name="description"
                  placeholder="Please describe your service requirement in detail..."
                  value={form.description}
                  onChange={handleChange}
                  required
                />
                {errors.description && <div className="form-error">{errors.description[0]}</div>}
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                {submitting ? (
                  <><span className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.2)' }} /> Processing...</>
                ) : (
                  'Submit Service Request →'
                )}
              </button>
            </form>
          </div>
        </div>

        <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span className="mono" style={{ color: 'var(--accent)' }}>Note: </span>
          The same phone number cannot submit duplicate requests for the same service type.
        </div>
      </div>
    </>
  )
}
