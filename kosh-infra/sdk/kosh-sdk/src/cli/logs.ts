import axios from 'axios'
import { loadConfig } from '../core/config'
import * as chalk from 'chalk'

export async function initLogs(options: any) {
  console.log(chalk.default.cyan('\n📋 Project Logs\n'))

  const config = loadConfig()
  if (!config) {
    console.error(chalk.default.red('Error: kosh.config.ts not found'))
    process.exit(1)
  }

  try {
    const response = await axios.get(`${config.apiUrl}/api/logs`, {
      params: {
        limit: options.limit,
        level: options.filter,
      },
      headers: {
        Authorization: `Bearer ${process.env.KOSH_TOKEN}`,
      },
    })

    const logs = response.data || []
    if (logs.length === 0) {
      console.log(chalk.default.gray('No logs found'))
      return
    }

    logs.forEach((log: any) => {
      const color = {
        ERROR: chalk.default.red,
        CRITICAL: chalk.default.red.bold,
        WARN: chalk.default.yellow,
        INFO: chalk.default.blue,
        DEBUG: chalk.default.gray,
      }[log.level] || chalk.default.white

      const timestamp = new Date(log.created_at).toLocaleTimeString()
      console.log(color(`[${log.level}] ${timestamp} — ${log.message}`))
    })

    console.log(chalk.default.gray(`\nTotal: ${logs.length} logs\n`))
  } catch (err: any) {
    console.error(chalk.default.red(`Error fetching logs: ${err.message}`))
    process.exit(1)
  }
}
