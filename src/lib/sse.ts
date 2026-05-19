// src/lib/sse.ts
/**
 * Server-Sent Events (SSE) Manager
 * ----------------------------------
 * Manages active SSE connections and broadcasts events to all connected clients.
 * Used to push real-time lead assignment updates to the dashboard.
 *
 * In a multi-instance deployment (e.g. multiple Next.js pods), use a pub/sub
 * system like Redis Pub/Sub or Postgres LISTEN/NOTIFY instead of this in-memory map.
 * For single-instance / Vercel Edge this approach is correct.
 */

type SSEClient = {
  id: string
  controller: ReadableStreamDefaultController
}

// Global registry of active SSE connections
const clients = new Map<string, SSEClient>()

/**
 * Register a new SSE client connection.
 */
export function addClient(id: string, controller: ReadableStreamDefaultController) {
  clients.set(id, { id, controller })
}

/**
 * Remove a disconnected client.
 */
export function removeClient(id: string) {
  clients.delete(id)
}

/**
 * Broadcast an event to ALL connected dashboard clients.
 * Called after a lead is successfully assigned.
 */
export function broadcastLeadUpdate(payload: object) {
  const data = `data: ${JSON.stringify(payload)}\n\n`
  const encoder = new TextEncoder()
  const encoded = encoder.encode(data)

  const deadClients: string[] = []

  for (const [id, client] of clients) {
    try {
      client.controller.enqueue(encoded)
    } catch {
      // Client disconnected — mark for cleanup
      deadClients.push(id)
    }
  }

  for (const id of deadClients) {
    clients.delete(id)
  }
}

/**
 * Returns the count of currently active SSE connections (for monitoring).
 */
export function getActiveClientCount() {
  return clients.size
}
