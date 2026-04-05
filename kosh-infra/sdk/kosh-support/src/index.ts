export { useSupport, type SupportTicket } from './composables/useSupport'

// Vue components are exported as .vue files directly
// Usage: import SupportButton from '@kosh/support/dist/components/SupportButton.vue'
// or use createSupportPlugin for global registration

import type { App } from 'vue'

export function createSupportPlugin() {
  return {
    install(app: App) {
      // Components will be lazily loaded from .vue files
      console.log('[Kosh Support] Plugin installed')
    },
  }
}
