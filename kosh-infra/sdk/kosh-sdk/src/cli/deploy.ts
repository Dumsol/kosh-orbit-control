import axios from 'axios'
import { loadConfig } from '../core/config'
import * as chalk from 'chalk'

export async function initDeploy(options: any) {
  console.log(chalk.default.cyan('\n🚀 Deploy Project\n'))

  const config = loadConfig()
  if (!config) {
    console.error(chalk.default.red('Error: kosh.config.ts not found'))
    process.exit(1)
  }

  if (options.backup) {
    console.log(chalk.default.gray('Creating backup...'))
    // Backup logic here
  }

  try {
    console.log(chalk.default.gray(`Deploying to ${options.environment}...`))

    const response = await axios.post(
      `${config.apiUrl}/api/deploy`,
      {
        projectSlug: config.projectSlug,
        environment: options.environment,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.KOSH_TOKEN}`,
        },
      }
    )

    if (response.data.success) {
      console.log(chalk.default.green(`✓ Deployment successful`))
      console.log(`Revision: ${response.data.revision}`)
      console.log(`URL: ${response.data.url}\n`)
    } else {
      console.error(chalk.default.red(`Deployment failed: ${response.data.error}`))
      process.exit(1)
    }
  } catch (err: any) {
    console.error(chalk.default.red(`Error during deploy: ${err.message}`))
    process.exit(1)
  }
}
