import * as inquirer from 'inquirer'
import { saveConfig } from '../core/config'
import * as chalk from 'chalk'

export async function initInit() {
  console.log(chalk.default.cyan('\n🚀 Initialize Kosh Project\n'))

  const answers = await inquirer.default.prompt([
    {
      type: 'input',
      name: 'projectSlug',
      message: 'Project slug (e.g., my-app):',
      validate: (v) => !/^[a-z0-9-]+$/.test(v) ? 'Must be lowercase letters, numbers, and hyphens' : true,
    },
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL (e.g., https://api.kosh.dev):',
      default: 'http://localhost:3000',
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key:',
    },
    {
      type: 'list',
      name: 'environment',
      message: 'Environment:',
      choices: ['development', 'staging', 'production'],
      default: 'development',
    },
  ])

  saveConfig(answers)
  console.log(chalk.default.green(`\n✓ Project initialized at kosh.config.ts\n`))
}
