#!/usr/bin/env node
/**
 * Kosh Logger CLI — instala e integra o logger em qualquer projeto
 * Uso: npm run kosh:init
 */

declare const process: any;
import * as fs   from 'fs'
import * as path from 'path'
import * as cp   from 'child_process'

// ─── Cores no terminal ───────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  red:    '\x1b[31m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
}

const ok   = (msg: string) => console.log(`${c.green}✓${c.reset} ${msg}`)
const warn = (msg: string) => console.log(`${c.yellow}⚠${c.reset} ${msg}`)
const info = (msg: string) => console.log(`${c.blue}→${c.reset} ${msg}`)
const err  = (msg: string) => console.log(`${c.red}✗${c.reset} ${msg}`)
const head = (msg: string) => console.log(`\n${c.bold}${msg}${c.reset}`)

// ─── Detectar onde está o logger e onde está o projeto alvo ─────────────────

const __filename_cli = process.argv[1]
const LOGGER_DIR = path.dirname(__filename_cli)       // onde está o cli.ts
const TARGET_DIR = process.cwd()                     // projeto que rodou npm run kosh:init

head('🔍 Kosh Logger — Instalação automática')
console.log(`${c.dim}Logger em: ${LOGGER_DIR}${c.reset}`)
console.log(`${c.dim}Projeto em: ${TARGET_DIR}${c.reset}\n`)

// ─── Lê package.json do projeto alvo ────────────────────────────────────────

function readPkg(dir: string): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  } catch { return {} }
}

const pkg = readPkg(TARGET_DIR)

// ─── Detecta tipo do projeto ─────────────────────────────────────────────────

type ProjectType = 'nuxt' | 'firebase' | 'vue' | 'worker' | 'monorepo' | 'unknown'

function detectProjectType(): ProjectType {
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }

  // Monorepo
  if (pkg.workspaces || fs.existsSync(path.join(TARGET_DIR, 'pnpm-workspace.yaml'))) {
    return 'monorepo'
  }
  // Nuxt
  if (deps['nuxt'] || deps['@nuxt/core'] || fs.existsSync(path.join(TARGET_DIR, 'nuxt.config.ts'))) {
    return 'nuxt'
  }
  // Firebase
  if (deps['firebase-admin'] || deps['firebase-functions'] ||
      fs.existsSync(path.join(TARGET_DIR, 'firebase.json'))) {
    return 'firebase'
  }
  // Vue standalone
  if (deps['vue'] && !deps['nuxt']) {
    return 'vue'
  }
  // Worker Node genérico
  if (deps['bullmq'] || deps['ioredis'] || pkg.name?.includes('worker')) {
    return 'worker'
  }
  return 'unknown'
}

const projectType = detectProjectType()
const projectName = pkg.name?.replace(/^@[^/]+\//, '') || path.basename(TARGET_DIR)

info(`Projeto detectado: ${c.bold}${projectName}${c.reset}`)
info(`Tipo detectado: ${c.bold}${projectType}${c.reset}`)

// ─── Detecta gerenciador de pacotes ──────────────────────────────────────────

function detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
  if (fs.existsSync(path.join(TARGET_DIR, 'pnpm-lock.yaml')))  return 'pnpm'
  if (fs.existsSync(path.join(TARGET_DIR, 'yarn.lock')))        return 'yarn'
  return 'npm'
}

const pm = detectPackageManager()
info(`Package manager: ${c.bold}${pm}${c.reset}`)

// ─── Copia a pasta /logger para o projeto alvo ───────────────────────────────

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const targetLoggerDir = path.join(TARGET_DIR, 'logger')

// Se o logger já está no projeto alvo (mesmo diretório), não copia
const isSameDir = path.resolve(LOGGER_DIR) === path.resolve(targetLoggerDir)

if (isSameDir) {
  ok('Logger já está neste projeto — pulando cópia')
} else {
  if (fs.existsSync(targetLoggerDir)) {
    warn('Pasta /logger já existe — sobrescrevendo...')
  }
  copyDir(LOGGER_DIR, targetLoggerDir)
  ok(`Logger copiado para ${targetLoggerDir}`)
}

// ─── Instala serialize-error ──────────────────────────────────────────────────

head('📦 Instalando dependência')

try {
  const installCmd = {
    npm:  'npm install serialize-error',
    yarn: 'yarn add serialize-error',
    pnpm: 'pnpm add serialize-error',
  }[pm]

  info(`Rodando: ${installCmd}`)
  cp.execSync(installCmd, { cwd: TARGET_DIR, stdio: 'inherit' })
  ok('serialize-error instalado')
} catch {
  err('Falha ao instalar serialize-error — instale manualmente:')
  console.log(`  ${pm} ${pm === 'npm' ? 'install' : 'add'} serialize-error`)
}

// ─── Atualiza .env e .env.example ────────────────────────────────────────────

head('🔧 Configurando variáveis de ambiente')

const envVars = `
# Kosh Logger — configurado automaticamente para ${projectName}
LOG_PROJECT=${projectName}
LOG_INGEST_URL=https://ingest.cspfood.com.br/ingest
LOG_INGEST_TOKEN=<cole aqui o token do Bitwarden: Kosh VM - Log Ingest Token>
`.trim()

function appendEnvIfMissing(filePath: string): void {
  const exists  = fs.existsSync(filePath)
  const content = exists ? fs.readFileSync(filePath, 'utf8') : ''

  if (content.includes('LOG_INGEST_TOKEN')) {
    ok(`${path.basename(filePath)} já tem as variáveis Kosh`)
    return
  }

  fs.appendFileSync(filePath, `\n\n${envVars}\n`)
  ok(`Variáveis adicionadas em ${path.basename(filePath)}`)
}

// Sempre atualiza .env.example
const envExamplePath = path.join(TARGET_DIR, '.env.example')
if (!fs.existsSync(envExamplePath)) {
  fs.writeFileSync(envExamplePath, envVars + '\n')
  ok('.env.example criado')
} else {
  appendEnvIfMissing(envExamplePath)
}

// Atualiza .env só se existir (não cria — pode ter segredos)
const envPath = path.join(TARGET_DIR, '.env')
if (fs.existsSync(envPath)) {
  appendEnvIfMissing(envPath)
} else {
  warn('.env não encontrado — crie manualmente e adicione as variáveis do .env.example')
}

// ─── Integração automática por tipo de projeto ───────────────────────────────

head('🔌 Integrando com o projeto')

function addImportIfMissing(filePath: string, importLine: string, afterLine?: string): boolean {
  if (!fs.existsSync(filePath)) return false
  const content = fs.readFileSync(filePath, 'utf8')
  if (content.includes('kosh-agent') || content.includes('logger/agent')) {
    ok(`${path.basename(filePath)} já tem o import do Kosh`)
    return true
  }

  let newContent: string
  if (afterLine && content.includes(afterLine)) {
    newContent = content.replace(afterLine, `${afterLine}\n${importLine}`)
  } else {
    newContent = `${importLine}\n${content}`
  }

  fs.writeFileSync(filePath, newContent)
  ok(`Import adicionado em ${path.basename(filePath)}`)
  return true
}

switch (projectType) {

  case 'nuxt': {
    // Cria plugins/kosh-agent.ts se não existir
    const pluginsDir  = path.join(TARGET_DIR, 'plugins')
    const pluginFile  = path.join(pluginsDir, 'kosh-agent.ts')
    fs.mkdirSync(pluginsDir, { recursive: true })

    if (!fs.existsSync(pluginFile)) {
      if (fs.existsSync(path.join(targetLoggerDir, 'nuxt-agent.ts'))) {
        fs.copyFileSync(
          path.join(targetLoggerDir, 'nuxt-agent.ts'),
          pluginFile
        )
        ok('plugins/kosh-agent.ts criado')
      } else {
        err('nuxt-agent.ts não encontrado no logger source')
      }
    } else {
      ok('plugins/kosh-agent.ts já existe')
    }

    // Adiciona runtimeConfig no nuxt.config.ts
    const nuxtConfig = path.join(TARGET_DIR, 'nuxt.config.ts')
    if (fs.existsSync(nuxtConfig)) {
      const content = fs.readFileSync(nuxtConfig, 'utf8')
      if (!content.includes('LOG_INGEST_TOKEN') && !content.includes('logToken')) {
        warn('Adicione ao nuxt.config.ts manualmente:')
        console.log(`${c.dim}  runtimeConfig: {
    public: {
      logProject:   process.env.LOG_PROJECT,
      logIngestUrl: process.env.LOG_INGEST_URL,
      logToken:     process.env.LOG_INGEST_TOKEN,
    }
  }${c.reset}`)
      }
    }
    break
  }

  case 'firebase': {
    // Adiciona import no index.ts das functions
    const funcsPaths = [
      path.join(TARGET_DIR, 'functions/src/index.ts'),
      path.join(TARGET_DIR, 'src/index.ts'),
      path.join(TARGET_DIR, 'index.ts'),
    ]

    let added = false
    for (const p of funcsPaths) {
      if (addImportIfMissing(p, `import '../logger/firebase-agent'`)) {
        added = true
        break
      }
      // Tenta com caminho relativo diferente
      if (addImportIfMissing(p, `import './logger/firebase-agent'`)) {
        added = true
        break
      }
    }

    if (!added) {
      warn('Não encontrei functions/src/index.ts — adicione manualmente:')
      console.log(`${c.dim}  import './logger/firebase-agent'${c.reset}`)
    }
    break
  }

  case 'vue': {
    const mainPaths = [
      path.join(TARGET_DIR, 'src/main.ts'),
      path.join(TARGET_DIR, 'src/main.js'),
      path.join(TARGET_DIR, 'main.ts'),
    ]

    let added = false
    for (const p of mainPaths) {
      if (addImportIfMissing(p,
        `import { installAgent } from './logger/agent'\ninstallAgent()`,
        `import { createApp }`
      )) { added = true; break }
    }

    if (!added) {
      warn('Não encontrei src/main.ts — adicione manualmente:')
      console.log(`${c.dim}  import { installAgent } from './logger/agent'
  installAgent()${c.reset}`)
    }
    break
  }

  case 'worker': {
    // Adiciona import no index.ts/js principal do worker
    const workerPaths = [
      path.join(TARGET_DIR, 'src/index.ts'),
      path.join(TARGET_DIR, 'index.ts'),
      path.join(TARGET_DIR, 'src/index.js'),
      path.join(TARGET_DIR, 'index.js'),
    ]

    let added = false
    for (const p of workerPaths) {
      if (addImportIfMissing(p, `import '../logger/vm-agent'`)) {
        added = true; break
      }
      if (addImportIfMissing(p, `require('./logger/vm-agent')`)) {
        added = true; break
      }
    }

    if (!added) {
      warn('Não encontrei o arquivo principal do worker — adicione manualmente:')
      console.log(`${c.dim}  // Linha 1 do seu arquivo principal:
  import './logger/vm-agent'${c.reset}`)
    }
    break
  }

  case 'monorepo': {
    // Em monorepos, detecta os subprojetos e instala em cada um
    info('Monorepo detectado — procurando subprojetos...')

    const workspaces: string[] = []

    // pnpm-workspace.yaml
    const pnpmWs = path.join(TARGET_DIR, 'pnpm-workspace.yaml')
    if (fs.existsSync(pnpmWs)) {
      const content = fs.readFileSync(pnpmWs, 'utf8')
      const matches = content.match(/- ['"]?(.+?)['"]?$/gm) || []
      workspaces.push(...matches.map((m: string) => m.replace(/- ['"]?|['"]?$/g, '').trim()))
    }

    // package.json workspaces
    if (Array.isArray(pkg.workspaces)) {
      workspaces.push(...pkg.workspaces)
    }

    if (workspaces.length === 0) {
      warn('Não encontrei workspaces definidos — rode em cada subprojeto manualmente')
      break
    }

    info(`Workspaces encontrados: ${workspaces.join(', ')}`)
    warn('Para monorepos, rode em cada subprojeto:')
    for (const ws of workspaces) {
      // Remove glob — pega o padrão base
      const wsBase = ws.replace(/\/\*$/, '')
      const wsDir  = path.join(TARGET_DIR, wsBase)
      if (fs.existsSync(wsDir)) {
        const subDirs = fs.readdirSync(wsDir, { withFileTypes: true })
          .filter((d: any) => d.isDirectory())
          .map((d: any) => path.join(wsBase, d.name))
        for (const sub of subDirs) {
          console.log(`  cd ${sub} && npm run kosh:init`)
        }
      } else {
        console.log(`  cd ${wsBase} && npm run kosh:init`)
      }
    }
    break
  }

  default: {
    warn(`Tipo de projeto não reconhecido — integração manual necessária`)
    console.log(`${c.dim}  Adicione no ponto de entrada do seu projeto:
  import './logger/agent'
  import { installAgent } from './logger/agent'
  installAgent()${c.reset}`)
  }
}

// ─── Adiciona script kosh:init no package.json do projeto alvo ───────────────

head('📝 Adicionando npm run kosh:init ao projeto')

const targetPkg     = readPkg(TARGET_DIR)
const pkgPath       = path.join(TARGET_DIR, 'package.json')
const relativeCliPath = path.relative(TARGET_DIR, path.join(targetLoggerDir, 'cli.ts'))

if (!targetPkg.scripts?.['kosh:init']) {
  targetPkg.scripts = targetPkg.scripts || {}
  targetPkg.scripts['kosh:init'] = `ts-node ${relativeCliPath.replace(/\\/g, '/')}`
  fs.writeFileSync(pkgPath, JSON.stringify(targetPkg, null, 2) + '\n')
  ok('Script kosh:init adicionado ao package.json')
} else {
  ok('Script kosh:init já existe no package.json')
}

// ─── Resumo final ─────────────────────────────────────────────────────────────

head('✅ Instalação concluída')
console.log()
console.log(`  Projeto  : ${c.bold}${projectName}${c.reset}`)
console.log(`  Tipo     : ${c.bold}${projectType}${c.reset}`)
console.log(`  Logger   : ${c.bold}${targetLoggerDir}${c.reset}`)
console.log()
console.log(`${c.yellow}Próximo passo:${c.reset}`)
console.log(`  Adicione LOG_INGEST_TOKEN no seu .env`)
console.log(`  Token disponível em: Bitwarden → Kosh VM → Log Ingest Token`)
console.log()
console.log(`${c.dim}Uso mínimo (zero config):${c.reset}`)
console.log(`  import { log } from './logger'`)
console.log(`  log({ service: 'meu-servico', level: 'INFO', event: 'ok', message: 'funcionando' })`)
console.log()
