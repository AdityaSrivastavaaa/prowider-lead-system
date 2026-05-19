// src/app/api/sse/route.ts
import { NextRequest } from 'next/server'
import { addClient, removeClient } from '@/lib/sse'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const clientId = randomUUID()

  const stream = new ReadableStream({
    start(controller) {
      addClient(clientId, controller)

      // Send initial connection confirmation
      const encoder = new TextEncoder()
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`)
      )

      // Keep-alive ping every 25 seconds to prevent proxy timeouts
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(keepAlive)
        }
      }, 25000)

      // Cleanup on disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive)
        removeClient(clientId)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Access-Control-Allow-Origin': '*',
    },
  })
}
