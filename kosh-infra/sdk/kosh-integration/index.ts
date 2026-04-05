// sdk/kosh-integration/index.ts
// Uso: import { track } from '@kosh/integration'
// track({ event_type: 'payment.received', amount: 97, customer_email: '...' })

export interface IntegrationEvent {
  event_type:     string
  entity_type?:   string
  entity_id?:     string
  amount?:        number
  currency?:      string
  customer_email?: string
  customer_name?:  string
  customer_doc?:   string
  metadata?:       Record<string, unknown>
}

let _config: { url: string; key: string; project: string } | null = null

export function initIntegration(config: { url: string; key: string; project: string }) {
  _config = config
}

export function track(event: IntegrationEvent): void {
  if (!_config) return
  fetch(`${_config.url}/integrations/event/custom?project=${_config.project}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kosh-key':   _config.key,
    },
    body: JSON.stringify(event),
  }).catch(() => {}) // fire-and-forget, nunca bloqueia
}
