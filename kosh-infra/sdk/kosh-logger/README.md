# @kosh/logger

SDK de logs centralizado para todos os projetos Kosh.
Os logs são enviados para https://ingest.cspfood.com.br/ingest

## Instalação
Copie a pasta `/logger` para a raiz do projeto.

## Variáveis de ambiente necessárias
```env
LOG_PROJECT=nome-do-projeto       # ex: queja-platform, cspfood, kosh-admin
LOG_INGEST_URL=https://ingest.cspfood.com.br/ingest
LOG_INGEST_TOKEN=<Bitwarden: Kosh VM - Log Ingest Token>
```

## Uso básico (qualquer ambiente)
```typescript
import { initLogger, log } from '~/logger'

initLogger({
  project:   process.env.LOG_PROJECT!,
  ingestUrl: process.env.LOG_INGEST_URL!,
  token:     process.env.LOG_INGEST_TOKEN!,
  env:       'worker',
})

log({
  project: 'meu-projeto',
  service: 'meu-servico',
  level:   'INFO',
  event:   'alguma.coisa',
  message: 'Descrição do que aconteceu',
})
```

## Nuxt 3
1. Copie `adapters/nuxt.ts` para `plugins/logger.ts`
2. Adicione as variáveis no `nuxt.config.ts` (ver comentários no arquivo)

## Vue 3 standalone
```typescript
import { loggerPlugin } from '~/logger/adapters/vue'
app.use(loggerPlugin, { project: '...', ingestUrl: '...', token: '...', env: 'vue' })
```

## Cloud Functions Firebase
```typescript
import { initFirebaseLogger, wrapHttpFunction } from '~/logger/adapters/firebase'

initFirebaseLogger({ project: 'meu-projeto', ingestUrl: '...', token: '...', env: 'firebase-function' })

export const minhaFunction = functions.https.onRequest(
  wrapHttpFunction(async (req, res) => {
    // sua lógica aqui
  }, { service: 'minha-function', event: 'minha.action' })
)
```

## Webhook (Stripe, etc)
```typescript
import { processWebhook } from '~/logger'

await processWebhook({
  project: 'meu-projeto',
  service: 'stripe-webhook',
  source:  'stripe',
  headers: req.headers,
  body:    req.body,
  handler: async () => {
    // sua lógica aqui
  }
})
```

## Medir duração de operações
```typescript
import { measure } from '~/logger'

const resultado = await measure(
  () => buscarDadosDaAPI(),
  { project: 'meu-projeto', service: 'api-client', event: 'api.fetch', message: 'Buscando dados' }
)
```

## Identificar usuário logado
```typescript
import { setUser, clearUser } from '~/logger'

// No login
setUser({ id: user.uid, email: user.email, role: user.role })

// No logout
clearUser()
```

## .NET / C#
Veja as instruções em `adapters/dotnet.ts`
