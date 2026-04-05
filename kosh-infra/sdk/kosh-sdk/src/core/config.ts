import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export interface KoshConfig {
  projectSlug: string
  apiUrl: string
  apiKey: string
  environment: 'development' | 'staging' | 'production'
  integrations?: {
    email?: { provider: string; apiKey: string }
    telegram?: { token: string; chatId: string }
  }
}

const CONFIG_PATH = resolve(process.cwd(), 'kosh.config.ts')

export function loadConfig(): KoshConfig | null {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8')
    // Extract config object from ES module default export
    const match = content.match(/export\s+default\s+({[\s\S]*?})/m)
    if (!match) return null
    // Safely evaluate config (note: in production, use a proper parser)
    const code = `(${match[1]})`
    return eval(code) as KoshConfig
  } catch (e) {
    console.error('Failed to load kosh.config.ts:', e)
    return null
  }
}

export function saveConfig(config: KoshConfig): void {
  const template = `// Generated kosh.config.ts
export default ${JSON.stringify(config, null, 2)} as const
`
  writeFileSync(CONFIG_PATH, template)
}

export function validateConfig(config: KoshConfig): string[] {
  const errors: string[] = []
  if (!config.projectSlug) errors.push('projectSlug is required')
  if (!config.apiUrl) errors.push('apiUrl is required')
  if (!config.apiKey) errors.push('apiKey is required')
  return errors
}
