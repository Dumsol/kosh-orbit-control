declare const process: any;
declare const require: any;
import type { LogEnvironment } from './types'

export function detectContext(): { project: string, env: LogEnvironment } {
  let project = 'unknown'
  let env: LogEnvironment = 'worker'

  if (typeof process !== 'undefined' && process.env) {
    project = process.env.LOG_PROJECT || process.env.VITE_LOG_PROJECT || 'unknown'
    if (process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_CONFIG) {
      env = 'firebase-function'
    } else if (process.env.NUXT || process.env.NITRO_VERSION) {
      env = 'nuxt-ssr'
    } else {
      env = 'worker'
    }
  } else if (typeof window !== 'undefined') {
    // Best effort on client
    project = (import.meta as any)?.env?.VITE_LOG_PROJECT || 'unknown'
    env = 'vue'
  }

  // Try to read from client config if initialized
  try {
    const { getConfig } = require('./client')
    const config = getConfig()
    if (config && config.project) {
      project = config.project
      env = config.env
    }
  } catch (e) {
    // Ignore if not initialized
  }

  return { project, env }
}
