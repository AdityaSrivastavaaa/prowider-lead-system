// src/types/index.ts

export interface LeadFormData {
  name: string
  phone: string
  city: string
  serviceId: number
  description: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ProviderDashboardData {
  id: number
  name: string
  email: string
  monthlyQuota: number
  currentCount: number
  remainingQuota: number
  leads: AssignedLead[]
}

export interface AssignedLead {
  id: number
  customerName: string
  phone: string
  city: string
  description: string
  serviceName: string
  assignedAt: string
}

export interface LeadCreatedEvent {
  type: 'LEAD_CREATED'
  leadId: number
  serviceName: string
  customerName: string
  city: string
  assignedProviderIds: number[]
  createdAt: string
}

export interface ServiceOption {
  id: number
  name: string
  description: string | null
}
