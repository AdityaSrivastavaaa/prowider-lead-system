// src/app/api/services/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const services = await prisma.service.findMany({ orderBy: { id: 'asc' } })
    return NextResponse.json({ success: true, data: services })
  } catch (err) {
    console.error('[GET /api/services]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
