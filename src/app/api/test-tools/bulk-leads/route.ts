// src/app/api/test-tools/bulk-leads/route.ts
/**
 * TEST TOOL: Bulk Lead Generation
 * --------------------------------
 * Generates N leads simultaneously to test:
 * - Concurrent allocation correctness
 * - No duplicate provider assignments
 * - Quota enforcement under load
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assignProviders } from '@/lib/allocation'
import { broadcastLeadUpdate } from '@/lib/sse'

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad']
const SERVICES = [1, 2, 3]

function randomPhone(): string {
  const prefix = ['6', '7', '8', '9'][Math.floor(Math.random() * 4)]
  const rest = Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, '0')
  return prefix + rest
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const count = Math.min(Number(body.count) || 10, 20) // cap at 20
    const serviceId: number | undefined = body.serviceId ? Number(body.serviceId) : undefined

    // Build leads data
    const leadsToCreate = Array.from({ length: count }, (_, i) => ({
      name: `Test Customer ${Date.now()}-${i}`,
      phone: randomPhone(),
      city: CITIES[i % CITIES.length],
      serviceId: serviceId ?? SERVICES[i % SERVICES.length],
      description: `Bulk test lead #${i + 1} generated at ${new Date().toISOString()}`,
    }))

    // Fire all lead creations concurrently — this tests our locking mechanism
    const results = await Promise.allSettled(
      leadsToCreate.map(async (leadData) => {
        // Each lead creation + allocation runs concurrently
        const lead = await prisma.lead.create({
          data: leadData,
          include: { service: true },
        })

        const assignedProviderIds = await assignProviders(lead.id, lead.serviceId)

        broadcastLeadUpdate({
          type: 'LEAD_CREATED',
          leadId: lead.id,
          serviceName: lead.service.name,
          customerName: lead.name,
          city: lead.city,
          assignedProviderIds,
          createdAt: lead.createdAt.toISOString(),
        })

        return { leadId: lead.id, assignedProviders: assignedProviderIds }
      })
    )

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<{ leadId: number; assignedProviders: number[] }> => r.status === 'fulfilled')
      .map((r) => r.value)

    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'Unknown error')

    return NextResponse.json({
      success: true,
      data: {
        requested: count,
        succeeded: succeeded.length,
        failed: failed.length,
        failureReasons: failed,
        leads: succeeded,
      },
    })
  } catch (err) {
    console.error('[POST /api/test-tools/bulk-leads]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
