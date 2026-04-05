// Gera e propaga trace_id por request
// Garante que todos os logs de uma mesma operação compartilham o mesmo ID

let _currentTraceId: string | null = null

export function generateTraceId(): string {
  // Usa crypto.randomUUID se disponível (Node 18+, browsers modernos)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback manual
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export function setTraceId(id: string): void {
  _currentTraceId = id
}

export function getTraceId(): string {
  if (!_currentTraceId) _currentTraceId = generateTraceId()
  return _currentTraceId
}

export function clearTraceId(): void {
  _currentTraceId = null
}

// Extrai trace_id de headers de request (para propagar entre serviços)
export function extractTraceFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string {
  const fromHeader = headers['x-trace-id'] || headers['x-request-id']
  if (fromHeader) {
    const id = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader
    setTraceId(id)
    return id
  }
  return getTraceId()
}
