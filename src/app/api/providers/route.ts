// src/app/api/providers/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        leadAssignments: {
          include: {
            lead: {
              include: { service: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
      orderBy: { id: 'asc' },
    })

    const data = providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      email: provider.email,
      monthlyQuota: provider.monthlyQuota,
      currentCount: provider.currentCount,
      remainingQuota: Math.max(0, provider.monthlyQuota - provider.currentCount),
      leads: provider.leadAssignments.map((assignment) => ({
        id: assignment.lead.id,
        customerName: assignment.lead.name,
        phone: assignment.lead.phone,
        city: assignment.lead.city,
        description: assignment.lead.description,
        serviceName: assignment.lead.service.name,
        assignedAt: assignment.assignedAt.toISOString(),
      })),
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/providers]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
