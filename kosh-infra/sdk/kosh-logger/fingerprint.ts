import type { LogPayload } from './types'

export function generateFingerprint(payload: LogPayload): string {
  const parts = [
    payload.service,
    payload.event,
    payload.message.replace(/\d+/g, '{n}'), // Agrupa mensagens similares
    payload.source_location?.file || '',
    payload.source_location?.line?.toString() || ''
  ]
.filter(Boolean)
  
  if (parts.length === 0) return 'unknown'
  
  const raw = parts.join('|')
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit int
  }
  return hash.toString(16)
}
