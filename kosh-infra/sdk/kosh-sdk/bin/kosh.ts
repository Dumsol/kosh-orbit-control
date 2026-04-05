#!/usr/bin/env node

import { Command } from 'commander'
import { initLogin } from '../src/cli/login'
import { initInit } from '../src/cli/init'
import { initLogs } from '../src/cli/logs'
import { initStatus } from '../src/cli/status'
import { initDeploy } from '../src/cli/deploy'

const program = new Command()

program
  .name('kosh')
  .description('Kosh CLI — unified SDK for projects')
  .version('1.0.0')

program
  .command('init')
  .description('Initialize a new Kosh project')
  .action(initInit)

program
  .command('login')
  .description('Authenticate with Kosh')
  .option('-e, --email <email>', 'Email address')
  .option('-t, --token <token>', 'API token')
  .action(initLogin)

program
  .command('logs')
  .description('View project logs')
  .option('-l, --limit <number>', 'Number of logs to show', '50')
  .option('-f, --filter <level>', 'Filter by log level (info/error/warning/critical)')
  .action(initLogs)

program
  .command('status')
  .description('Check project status')
  .action(initStatus)

program
  .command('deploy')
  .description('Deploy project to Kosh cloud')
  .option('-e, --environment <env>', 'Deployment environment (dev/staging/prod)', 'prod')
  .option('--no-backup', 'Skip backup before deploy')
  .action(initDeploy)

program.parse(process.argv)

if (program.args.length === 0) {
  program.help()
}
