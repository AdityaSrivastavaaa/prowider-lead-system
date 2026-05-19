// src/app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { assignProviders } from '@/lib/allocation'
import { broadcastLeadUpdate } from '@/lib/sse'
import { Prisma } from '@prisma/client'

const LeadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  city: z.string().min(2, 'City is required').max(100),
  serviceId: z.coerce.number().int().min(1).max(3),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = LeadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, phone, city, serviceId, description } = parsed.data

    // Create lead — DB unique constraint on (phone, serviceId) catches duplicates
    let lead
    try {
      lead = await prisma.lead.create({
        data: { name, phone, city, serviceId, description },
        include: { service: true },
      })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Duplicate lead',
            message: `A lead for this phone number and service already exists.`,
          },
          { status: 409 }
        )
      }
      throw err
    }

    // Trigger allocation (serializable transaction — safe under concurrency)
    const assignedProviderIds = await assignProviders(lead.id, serviceId)

    // Broadcast to all dashboard clients via SSE
    broadcastLeadUpdate({
      type: 'LEAD_CREATED',
      leadId: lead.id,
      serviceName: lead.service.name,
      customerName: lead.name,
      city: lead.city,
      assignedProviderIds,
      createdAt: lead.createdAt.toISOString(),
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          leadId: lead.id,
          message: `Lead created and assigned to ${assignedProviderIds.length} provider(s).`,
          assignedProviders: assignedProviderIds,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/leads]', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        service: true,
        assignments: {
          include: { provider: true },
          orderBy: { assignedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ success: true, data: leads })
  } catch (err) {
    console.error('[GET /api/leads]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
