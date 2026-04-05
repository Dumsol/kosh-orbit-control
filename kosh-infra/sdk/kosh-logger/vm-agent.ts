declare const process: any;
declare const require: any;
// Para workers Node.js na VM (ingest-api, worker, alert-worker)
// Adicione UMA linha no topo de cada worker:
// import '~/logger/vm-agent'

import { installAgent } from './agent'
import { wrapPgPool }   from './pg-agent'
import { wrapRedis }    from './redis-agent'

// Instala agente com Nginx watcher (estamos na VM)
installAgent({
  interceptConsole: true,
  interceptFetch:   true,
  watchNginxLog:    true,  // VM tem Nginx local
  nginxLogPath:     '/var/log/nginx/error.log',
})

// Re-exporta wrappers para uso nos workers
export { wrapPgPool, wrapRedis }

// Monitora também memória da VM a cada 5 minutos
if (typeof process !== 'undefined') {
  setInterval(() => {
    const used   = process.memoryUsage()
    const heapMB = Math.round(used.heapUsed / 1024 / 1024)
    const rssMB  = Math.round(used.rss      / 1024 / 1024)

    // Alerta se heap > 200MB (sinal de memory leak)
    if (heapMB > 200) {
      const { send }       = require('./client')
      const { detectContext } = require('./detect')
      const ctx = detectContext()

      send({
        project: ctx.project,
        service: 'vm-process',
        level:   heapMB > 350 ? 'CRITICAL' : 'WARN',
        event:   'vm.memory.high',
        message: `Heap alto: ${heapMB}MB RSS: ${rssMB}MB`,
        metadata: { heapMB, rssMB, pid: process.pid },
      })
    }
  }, 5 * 60 * 1000)
}
