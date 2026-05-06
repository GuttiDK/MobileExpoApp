import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { onZ2mStateUpdate } from '@/lib/mqtt'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Stream already closed; cleanup will handle it
        }
      }

      send('open', { ts: new Date().toISOString() })

      unsubscribe = onZ2mStateUpdate((evt) => send('state', evt))

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          // Stream closed
        }
      }, 30000)

      request.signal.addEventListener('abort', () => {
        unsubscribe?.()
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
    cancel() {
      unsubscribe?.()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
