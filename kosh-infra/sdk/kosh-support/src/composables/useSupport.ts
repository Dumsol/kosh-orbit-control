import { ref } from 'vue'

export interface SupportTicket {
  email: string
  subject: string
  message: string
  category?: string
}

export function useSupport() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const submitTicket = async (ticket: SupportTicket): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return true
    } catch (err: any) {
      error.value = err.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    submitTicket,
  }
}
