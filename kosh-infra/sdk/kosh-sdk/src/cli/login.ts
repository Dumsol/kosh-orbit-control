import axios from 'axios'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import * as chalk from 'chalk'

export async function initLogin() {
  console.log(chalk.default.cyan('\n📝 Kosh Login\n'))

  const password = process.env.PANEL_SECRET || process.argv[process.argv.length - 1]

  if (!password) {
    console.log(chalk.default.red('Error: PANEL_SECRET env var or password argument required'))
    process.exit(1)
  }

  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      password,
    })

    const tokenFile = resolve(process.cwd(), '.kosh-token')
    writeFileSync(tokenFile, response.data.token)

    console.log(chalk.default.green(`✓ Login successful. Token saved to ${tokenFile}`))
  } catch (err: any) {
    console.error(chalk.default.red(`✗ Login failed: ${err.response?.data?.error || err.message}`))
    process.exit(1)
  }
}
