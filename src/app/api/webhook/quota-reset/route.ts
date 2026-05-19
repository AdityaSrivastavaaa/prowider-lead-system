// src/app/api/webhook/quota-reset/route.ts
/**
 * WEBHOOK: Quota Reset
 * ---------------------
 * Simulates a payment gateway confirming a provider's monthly subscription.
 * Resets provider quota back to 10.
 *
 * Idempotency:
 * - Caller must supply X-Idempotency-Key header (or idempotencyKey in body)
 * - If the same key is used twice, the second call returns 200 with cached result
 *   WITHOUT re-processing the quota reset.
 * - WebhookEvent table stores processed keys with a UNIQUE constraint.
 *
 * Security:
 * - Validates X-Webhook-Secret header (set via WEBHOOK_SECRET env var)
 * - NOT triggered from normal user UI
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { broadcastLeadUpdate } from '@/lib/sse'
import { Prisma } from '@prisma/client'

const WebhookBodySchema = z.object({
  providerId: z.coerce.number().int().optional(), // If omitted, resets ALL providers
  idempotencyKey: z.string().min(1).max(200),
  eventType: z.string().default('quota_reset'),
})

export async function POST(req: NextRequest) {
  // 1. Validate webhook secret
  const secret = req.headers.get('x-webhook-secret')
  const expectedSecret = process.env.WEBHOOK_SECRET ?? 'prowider-webhook-secret-2024'

  if (secret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid webhook secret' },
      { status: 401 }
    )
  }

  // 2. Parse body
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = WebhookBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { providerId, idempotencyKey, eventType } = parsed.data

  // 3. Check idempotency — if key already processed, return early
  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey },
  })

  if (existing) {
    return NextResponse.json({
      success: true,
      idempotent: true,
      message: `Event already processed at ${existing.processedAt.toISOString()}`,
      data: { idempotencyKey, processedAt: existing.processedAt },
    })
  }

  // 4. Process quota reset inside a transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Reset quota
      if (providerId) {
        // Reset single provider
        const provider = await tx.provider.update({
          where: { id: providerId },
          data: { currentCount: 0 },
        })

        // Store idempotency record
        await tx.webhookEvent.create({
          data: {
            idempotencyKey,
            eventType,
            providerId: provider.id,
          },
        })

        return { resetCount: 1, providers: [provider] }
      } else {
        // Reset ALL providers
        await tx.provider.updateMany({
          data: { currentCount: 0 },
        })

        // Also reset allocation states (fair pool indices restart)
        await tx.allocationState.updateMany({
          data: { poolIndex: 0 },
        })

        // Store idempotency record (no specific provider)
        await tx.webhookEvent.create({
          data: {
            idempotencyKey,
            eventType,
          },
        })

        const providers = await tx.provider.findMany({ orderBy: { id: 'asc' } })
        return { resetCount: providers.length, providers }
      }
    })

    // Broadcast quota reset event to dashboard
    broadcastLeadUpdate({
      type: 'QUOTA_RESET',
      message: providerId
        ? `Provider ${providerId} quota reset to 10`
        : 'All provider quotas reset to 10',
      resetAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      idempotent: false,
      message: providerId
        ? `Provider ${providerId} quota reset successfully`
        : `All ${result.resetCount} providers quota reset successfully`,
      data: { resetCount: result.resetCount, idempotencyKey },
    })
  } catch (err) {
    // Race condition: two identical keys processed simultaneously
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey } })
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: `Event already processed (race condition handled)`,
        data: { idempotencyKey, processedAt: existing?.processedAt },
      })
    }

    console.error('[POST /api/webhook/quota-reset]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
