import axios from 'axios'

export interface IntegrationEvent {
  eventType: string
  projectSlug: string
  data: Record<string, any>
  timestamp?: Date
}

export class KoshIntegration {
  constructor(private apiUrl: string, private apiKey: string) {}

  async sendEvent(event: IntegrationEvent): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/api/integrations/event`, event, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      })
    } catch (err: any) {
      console.error('[KoshIntegration] Event send failed:', err.message)
    }
  }

  async trackConversion(projectSlug: string, userId: string, amount: number): Promise<void> {
    return this.sendEvent({
      eventType: 'conversion',
      projectSlug,
      data: { userId, amount },
    })
  }

  async trackSignup(projectSlug: string, userId: string, email: string): Promise<void> {
    return this.sendEvent({
      eventType: 'signup',
      projectSlug,
      data: { userId, email },
    })
  }

  async trackCustom(projectSlug: string, eventType: string, data: Record<string, any>): Promise<void> {
    return this.sendEvent({
      eventType,
      projectSlug,
      data,
    })
  }
}
