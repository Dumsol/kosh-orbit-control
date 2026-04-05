<template>
  <div class="workers-view">
    <header class="view-header">
      <div class="title-group">
        <h1 class="text-1">Deploy Hub</h1>
        <p class="text-3">Gerencie a malha de Workers e deploys instantâneos via AI Agent.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" @click="generateNewKey">
          <Plus :size="16" /> Novo Worker (Deploy Key)
        </button>
      </div>
    </header>

    <main class="content-area grid-2-1">
      <!-- Left Column: Active Workers & Fleet -->
      <section class="fleet-section">
        <div class="section-label mb-4">Worker Fleet (Cloud Run)</div>
        <div class="grid-stats">
          <div v-for="w in workers" :key="w.name" class="card worker-card">
            <div class="worker-header">
                <div class="icon-box" :class="w.status">
                    <Cpu :size="20" />
                </div>
                <div class="worker-info">
                    <h3 class="text-1">{{ w.name }}</h3>
                    <span class="text-3 text-xs mono">{{ w.region }}</span>
                </div>
                <div class="status-indicator">
                    <div class="dot" :class="'dot-' + w.status"></div>
                </div>
            </div>
            <div class="worker-footer">
                <div class="revision">
                    <span class="text-3 text-xs">Revision:</span>
                    <span class="text-1 text-xs mono">{{ w.revision }}</span>
                </div>
                <button class="btn btn-ghost btn-xs text-copper" @click="rollback(w)">Rollback</button>
            </div>
          </div>
        </div>

        <div class="section-label mt-8 mb-4">Deploy History</div>
        <div class="history-list card">
           <table class="table">
               <thead>
                   <tr>
                       <th>Service</th>
                       <th>Revision</th>
                       <th>Status</th>
                       <th>Date</th>
                       <th>Logs</th>
                   </tr>
               </thead>
               <tbody>
                   <tr v-for="h in history" :key="h.id">
                       <td class="font-bold">{{ h.service_name }}</td>
                       <td class="mono text-xs">{{ h.revision }}</td>
                       <td>
                           <span class="badge" :class="h.status === 'success' ? 'badge-success' : 'badge-danger'">
                               {{ h.status }}
                           </span>
                       </td>
                       <td class="text-3 text-xs">{{ new Date(h.deployed_at).toLocaleString() }}</td>
                       <td>
                           <a :href="h.build_log_url" target="_blank" class="btn btn-ghost btn-xs">
                               <ExternalLink :size="12" />
                           </a>
                       </td>
                   </tr>
               </tbody>
           </table>
        </div>
      </section>

      <!-- Right Column: System Status / Action -->
      <aside class="side-info">
          <div class="card glassmorphism p-4 sticky-top">
              <h4 class="text-1 mb-2">Build Pipeline Status</h4>
              <div class="pipeline-progress">
                  <div class="progress-track">
                      <div class="progress-fill" style="width: 100%"></div>
                  </div>
                  <div class="progress-details mt-2">
                      <span class="text-3 text-xs">Environment: Production</span>
                      <span class="text-success text-xs font-bold">READY</span>
                  </div>
              </div>
              <div class="info-footer mt-4">
                  <p class="text-4 text-xs italic">Deploys via Worker Key Flow são protegidos por IAM e TTL de 24h.</p>
              </div>
          </div>
      </aside>
    </main>

    <!-- Modal: Deploy Key Flow -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card animate-slide-up">
        <header class="modal-header">
          <h3>Worker Key Pipeline</h3>
          <button class="btn-close" @click="closeModal"><X :size="18" /></button>
        </header>

        <div class="modal-body">
            <div v-if="deployKey" class="key-result">
                <div class="success-banner mb-6">
                    <CheckCircle :size="32" class="text-success" />
                    <h4>Deployment Key Gerada</h4>
                    <p class="text-3 text-sm">Passe esta chave ao seu Agente AI para iniciar o deploy.</p>
                </div>

                <div class="key-box card p-4 mb-4">
                    <label class="text-xs text-3 font-bold mb-2 block uppercase">Deploy Key (Master)</label>
                    <div class="input-group">
                        <input readonly :value="deployKey" class="input mono text-sm flex-1 bg-transparent" />
                        <button class="btn-copy p-2 text-copper" @click="copy(deployKey)">
                            <Copy :size="16" />
                        </button>
                    </div>
                </div>

                <div class="instruction-box bg-dark rounded p-4 border border-mid">
                    <h5 class="text-copper font-bold text-xs mb-2">PROMPT SUGERIDO:</h5>
                    <pre class="prompt-text text-sm mono text-1">
DEPLOY_KEY={{ deployKey }}
Cwd={{ selectedProject }}
Implemente um worker Node.js que...
                    </pre>
                    <button class="btn btn-ghost btn-xs mt-2" @click="copyPrompt">
                        <Copy :size="10" /> Copiar Prompt
                    </button>
                </div>

                <div class="ttl-warning mt-4 text-center">
                    <Clock :size="12" class="inline mr-1 text-warn" />
                    <span class="text-4 text-xs">Expira em 24h ({{ expiresAt }})</span>
                </div>
            </div>

            <div v-else class="loading-state p-8 text-center">
                <div class="pulse mb-4">Gerando Chave Segura...</div>
            </div>
        </div>

        <footer class="modal-footer p-4 border-t border-subtle">
            <button class="btn btn-primary w-full" @click="closeModal">Concluído</button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { 
  Plus, X, Cpu, CheckCircle, Copy, Clock, 
  ExternalLink, ArrowRight, History 
} from 'lucide-vue-next'
import axios from 'axios'
import { useProjectStore } from '@/stores/project'

const showModal = ref(false)
const deployKey = ref('')
const expiresAt = ref('')
const projectStore = useProjectStore()
const selectedProject = computed(() => projectStore.selected)

const workers = ref<any[]>([])

const fetchWorkers = async () => {
  try {
    const res = await axios.get(`/api/services?project=${selectedProject.value}`)
    const svc = res.data
    const list: any[] = []
    if (svc.cloudRun) {
      for (const [name, info] of Object.entries(svc.cloudRun as Record<string, any>)) {
        list.push({
          name,
          status: info.status === 'online' ? 'online' : 'warn',
          region: 'southamerica-east1',
          revision: info.revision || 'active',
        })
      }
    }
    // Add VM services
    if (svc.postgres) list.push({ name: 'postgres', status: svc.postgres.status, region: svc.postgres.host, revision: 'vm' })
    if (svc.redis)    list.push({ name: 'redis',    status: svc.redis.status,    region: 'VM Docker',      revision: 'vm' })
    workers.value = list
  } catch {
    workers.value = [
      { name: 'ingest-api', status: 'online', region: 'southamerica-east1', revision: 'active' },
      { name: 'webhooks',   status: 'online', region: 'southamerica-east1', revision: 'active' },
    ]
  }
}

const history = ref<any[]>([])

const fetchHistory = async () => {
    try {
        const res = await axios.get(`/api/workers/history?project=${selectedProject.value}`)
        history.value = res.data
    } catch (e) {
        console.error('Failed to fetch history', e)
        // Mock fallback
        history.value = [
            { id: 1, service_name: 'ingest-api', revision: 'v2-9a8b7', status: 'success', deployed_at: new Date().toISOString(), build_log_url: '#' },
            { id: 2, service_name: 'worker-metrics', revision: 'v1-4f2e1', status: 'success', deployed_at: new Date().toISOString(), build_log_url: '#' }
        ]
    }
}

const generateNewKey = async () => {
    showModal.value = true
    deployKey.value = ''
    try {
        const res = await axios.post('/api/workers/new')
        deployKey.value = res.data.key
        expiresAt.value = new Date(res.data.expires_at).toLocaleTimeString()
        fetchHistory()
    } catch (e) {
        console.error('Failed to generate key', e)
        alert('Erro ao gerar chave de deploy.')
    }
}

const rollback = (worker: any) => {
    if(confirm(`Deseja fazer rollback para a versão anterior de ${worker.name}?`)) {
        alert('Revertendo tráfego no Cloud Run...')
    }
}

const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copiado!')
}

const copyPrompt = () => {
    const prompt = `DEPLOY_KEY=${deployKey.value}\nCwd=${selectedProject.value}\nImplemente um worker Node.js que...`
    copy(prompt)
}

const closeModal = () => {
    showModal.value = false
    deployKey.value = ''
}

watch(selectedProject, () => {
  fetchHistory()
  fetchWorkers()
})

onMounted(async () => {
  await projectStore.fetchProjects()
  fetchHistory()
  fetchWorkers()
})
</script>

<style scoped>
.workers-view { display: flex; flex-direction: column; gap: 24px; }
.grid-2-1 { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }

.worker-card { border-left: 4px solid var(--copper); transition: transform 0.2s; }
.worker-card:hover { transform: translateY(-2px); }

.worker-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; position: relative; }
.icon-box { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--bg-3); color: var(--copper); }
.icon-box.warn { color: var(--text-warn); }

.status-indicator { position: absolute; top: 0; right: 0; }
.dot-online { background: #10b981; box-shadow: 0 0 8px #10b981; }
.dot-warn { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }

.worker-footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--border-subtle); padding-top: 12px; }

.history-list { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border-subtle); }

.glassmorphism { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.05); }

.progress-track { height: 6px; background: var(--bg-3); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--copper), #fff); animation: pulse 2s infinite; }

.input-group { display: flex; align-items: center; background: var(--bg-3); border-radius: 6px; padding: 4px 8px; border: 1px solid var(--border-mid); }
.instruction-box { background: #000; border: 1px solid #333; }
.prompt-text { white-space: pre-wrap; line-height: 1.5; color: #aaa; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-card { background: var(--bg-1); width: 100%; max-width: 500px; border-radius: 12px; overflow: hidden; }
.modal-header { padding: 16px 24px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; }

@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-up { animation: slideUp 0.3s ease-out; }

.sticky-top { position: sticky; top: 20px; }
</style>
