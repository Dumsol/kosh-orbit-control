import axios from 'axios'

export interface EmailOptions {
  to: string
  subject: string
  body: string
  from?: string
  html?: boolean
}

export class KoshEmail {
  constructor(private apiUrl: string, private apiKey: string) {}

  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/email/send`, options, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      })
      return { success: true, messageId: response.data.id }
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || err.message }
    }
  }

  async sendTemplate(
    to: string,
    template: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.send({
      to,
      subject: data.subject || 'Notification from Kosh',
      body: template,
      html: true,
    })
  }
}
