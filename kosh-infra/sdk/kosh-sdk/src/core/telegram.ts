import axios from 'axios'

export interface TelegramMessageOptions {
  text: string
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disableNotification?: boolean
}

export class KoshTelegram {
  constructor(private apiUrl: string, private apiKey: string) {}

  async send(options: TelegramMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/telegram/send`, options, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      })
      return { success: true, messageId: response.data.message_id }
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || err.message }
    }
  }

  async sendAlert(title: string, message: string, severity: 'info' | 'warning' | 'critical' = 'info'): Promise<void> {
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    }
    const text = `${emoji[severity]} <b>${title}</b>\n${message}`
    await this.send({ text, parseMode: 'HTML' })
  }
}
