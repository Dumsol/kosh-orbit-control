import axios from 'axios'
import { loadConfig } from '../core/config'
import * as chalk from 'chalk'

export async function initStatus() {
  console.log(chalk.default.cyan('\n📊 Project Status\n'))

  const config = loadConfig()
  if (!config) {
    console.error(chalk.default.red('Error: kosh.config.ts not found'))
    process.exit(1)
  }

  try {
    const response = await axios.get(`${config.apiUrl}/api/services`, {
      headers: {
        Authorization: `Bearer ${process.env.KOSH_TOKEN}`,
      },
    })

    const services = response.data || []

    console.log(`Project: ${chalk.default.cyan(config.projectSlug)}`)
    console.log(`Environment: ${chalk.default.cyan(config.environment)}`)
    console.log(`\nServices:\n`)

    services.forEach((svc: any) => {
      const status = svc.online ? chalk.default.green('✓ online') : chalk.default.red('✗ offline')
      console.log(`  ${svc.name.padEnd(20)} ${status}`)
    })

    console.log()
  } catch (err: any) {
    console.error(chalk.default.red(`Error fetching status: ${err.message}`))
    process.exit(1)
  }
}
