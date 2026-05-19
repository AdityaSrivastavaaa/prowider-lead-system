// src/lib/allocation.ts
/**
 * LEAD ALLOCATION ENGINE
 * ----------------------
 * This module implements the core lead distribution logic.
 *
 * Rules:
 * - Each lead gets exactly 3 providers
 * - Mandatory providers are assigned first (per service rules)
 * - Remaining slots filled using persisted round-robin from fair pool
 * - Monthly quota (10) is respected; quota-full providers are skipped
 * - All state persisted in DB — survives server restarts
 * - Uses DB-level advisory locks / serializable transactions for concurrency safety
 */

import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

// ── Business Rules ──────────────────────────────────────────────────────────

/**
 * Mandatory provider IDs per service.
 * These are ALWAYS assigned first (if quota available).
 */
const MANDATORY_PROVIDERS: Record<number, number[]> = {
  1: [1],        // Service 1 → Provider 1
  2: [5],        // Service 2 → Provider 5
  3: [1, 4],     // Service 3 → Provider 1 AND Provider 4
}

/**
 * Fair pool provider IDs per service.
 * Round-robin selection happens within these pools.
 */
const FAIR_POOLS: Record<number, number[]> = {
  1: [2, 3, 4],        // Service 1 fair pool
  2: [6, 7, 8],        // Service 2 fair pool
  3: [2, 3, 5, 6, 7, 8], // Service 3 fair pool
}

const TOTAL_ASSIGNMENTS = 3

// ── Allocation Entry Point ──────────────────────────────────────────────────

/**
 * Assigns exactly 3 providers to a newly created lead.
 * Runs inside a SERIALIZABLE transaction to prevent double-allocation
 * under concurrent requests (i.e., two leads created simultaneously
 * won't both pick the same fair-pool provider).
 *
 * @param leadId - The ID of the newly created lead
 * @param serviceId - The service type of the lead
 * @returns Array of assigned provider IDs
 */
export async function assignProviders(leadId: number, serviceId: number): Promise<number[]> {
  return prisma.$transaction(
    async (tx) => {
      // 1. Lock the AllocationState row for this service to serialize
      //    concurrent fair-pool selections. PostgreSQL advisory lock via
      //    SELECT FOR UPDATE on the allocation state row.
      const allocationState = await tx.allocationState.findUniqueOrThrow({
        where: { serviceId },
      })

      // Re-fetch with FOR UPDATE to serialize concurrent transactions
      await tx.$executeRaw`
  SELECT id FROM allocation_states WHERE "serviceId" = ${serviceId} FOR UPDATE
      `

      // 2. Load all providers with their current counts (within transaction)
      const allProviders = await tx.provider.findMany({
        select: { id: true, currentCount: true, monthlyQuota: true },
      })

      const providerMap = new Map(
        allProviders.map((p) => ({
          id: p.id,
          remainingQuota: p.monthlyQuota - p.currentCount,
        })).map((p) => [p.id, p])
      )

      const hasQuota = (id: number) => (providerMap.get(id)?.remainingQuota ?? 0) > 0

      // 3. Assign mandatory providers first
      const mandatoryIds = MANDATORY_PROVIDERS[serviceId] ?? []
      const assigned: number[] = []
      const skippedMandatory: number[] = []

      for (const pid of mandatoryIds) {
        if (hasQuota(pid)) {
          assigned.push(pid)
        } else {
          // Mandatory provider is quota-full — log and skip
          // System will fill from fair pool instead
          skippedMandatory.push(pid)
          console.warn(`[Allocation] Mandatory provider ${pid} quota full for lead ${leadId}`)
        }
      }

      // 4. Fill remaining slots from fair pool using round-robin
      const slotsNeeded = TOTAL_ASSIGNMENTS - assigned.length
      const fairPool = FAIR_POOLS[serviceId] ?? []

      // Filter fair pool: must have quota AND not already assigned
      const eligiblePool = fairPool.filter(
        (pid) => hasQuota(pid) && !assigned.includes(pid)
      )

      let currentIndex = allocationState.poolIndex
      let newIndex = currentIndex
      const fairSelected: number[] = []

      if (eligiblePool.length < slotsNeeded) {
        console.warn(
          `[Allocation] Not enough eligible providers in fair pool for lead ${leadId}. ` +
          `Need ${slotsNeeded}, have ${eligiblePool.length}`
        )
      }

      // Round-robin: walk through eligiblePool starting from currentIndex
      // We iterate over the FULL fair pool (not just eligible) to maintain
      // consistent round-robin ordering, skipping ineligible ones.
      let attempts = 0
      const maxAttempts = fairPool.length * 2 // safety cap

      while (fairSelected.length < slotsNeeded && attempts < maxAttempts) {
        const candidateId = fairPool[currentIndex % fairPool.length]
        currentIndex++
        attempts++

        if (
          hasQuota(candidateId) &&
          !assigned.includes(candidateId) &&
          !fairSelected.includes(candidateId)
        ) {
          fairSelected.push(candidateId)
        }
      }

      // Save new pool index (persisted for next lead)
      newIndex = currentIndex % fairPool.length

      assigned.push(...fairSelected)

      if (assigned.length === 0) {
        throw new Error(`[Allocation] No providers available for lead ${leadId} service ${serviceId}`)
      }

      // 5. Persist assignments and increment provider counts
      const assignments = assigned.map((providerId) => ({
        leadId,
        providerId,
      }))

      await tx.leadAssignment.createMany({ data: assignments, skipDuplicates: true })

      // Increment currentCount for each assigned provider
      await tx.provider.updateMany({
        where: { id: { in: assigned } },
        data: { currentCount: { increment: 1 } },
      })

      // 6. Persist updated round-robin index
      await tx.allocationState.update({
        where: { serviceId },
        data: { poolIndex: newIndex },
      })

      return assigned
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }
  )
}
