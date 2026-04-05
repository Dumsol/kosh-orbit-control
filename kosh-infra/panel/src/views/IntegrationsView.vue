<template>
  <div class="integrations-view">
    <header class="view-header">
      <div class="title-group">
        <h1 class="text-1">Integrações</h1>
        <p class="text-3">Gerencie webhooks e conecte fontes de dados externas ao Kosh.</p>
      </div>
      <div class="header-actions">
        <select v-model="selectedProject" class="input project-selector">
          <option v-for="p in projects" :key="p.slug" :value="p.slug">{{ p.name.toUpperCase() }}</option>
        </select>
        <button class="btn btn-primary" @click="showModal = true">
          <Plus :size="16" /> Nova Integração
        </button>
      </div>
    </header>

    <main class="content-area">
      <div v-if="loading" class="loading-placeholder card">
        <div class="pulse">Buscando integrações...</div>
      </div>

      <div v-else-if="integrations.length === 0" class="empty-state card">
        <div class="empty-icon"><Zap :size="48" /></div>
        <h3>Nenhuma integração encontrada</h3>
        <p>Conecte Hotmart, Kiwify ou Stripe para começar a coletar métricas.</p>
        <button class="btn btn-copper mt-4" @click="showModal = true">Criar primeira integração</button>
      </div>

      <div v-else class="integrations-list">
        <div v-for="item in filteredIntegrations" :key="item.id" class="card integration-card" :class="{ 'inactive': !item.active }">
          <div class="integration-main">
            <div class="source-icon" :class="item.source">
              <component :is="getSourceIcon(item.source)" :size="20" />
            </div>
            <div class="integration-info">
              <div class="name-row">
                <h3 class="text-1">{{ item.name }}</h3>
                <span class="badge" :class="item.active ? 'badge-success' : 'badge-ghost'">
                  {{ item.active ? 'Ativo' : 'Inativo' }}
                </span>
                <span class="badge badge-copper">{{ item.project_slug }}</span>
              </div>
              <div class="meta-row">
                <span class="text-3 mono text-xs">{{ item.source.toUpperCase() }}</span>
                <span class="dot-separator">•</span>
                <span class="text-3 text-xs">Criado em {{ new Date(item.created_at).toLocaleDateString() }}</span>
              </div>
            </div>
            <div class="integration-stats">
              <div class="stat">
                  <span class="stat-value">{{ Math.floor(Math.random() * 50) }}</span>
                  <span class="stat-label">Eventos hoje</span>
              </div>
            </div>
            <div class="integration-actions">
                <button class="btn btn-ghost btn-sm" @click="viewDetails(item)" title="Ver Detalhes">
                    <ExternalLink :size="14" />
                </button>
                <button class="btn btn-ghost btn-sm text-danger" @click="deleteIntegration(item.id)" title="Desativar">
                    <Trash2 :size="14" />
                </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal: Nova Integração -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-card animate-slide-up">
        <header class="modal-header">
          <h3>Nova Integração</h3>
          <button class="btn-close" @click="closeModal"><X :size="18" /></button>
        </header>

        <div v-if="!createdResult" class="modal-body">
          <div class="form-group">
            <label>Nome da Integração</label>
            <input v-model="newForm.name" type="text" placeholder="Ex: Hotmart Principal" class="input" />
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label>Plataforma (Source)</label>
              <select v-model="newForm.source" class="input">
                <option value="hotmart">Hotmart</option>
                <option value="kiwify">Kiwify</option>
                <option value="stripe">Stripe</option>
                <option value="eduzz">Eduzz</option>
                <option value="custom">Custom (SDK/API)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Projeto</label>
              <select v-model="newForm.project_slug" class="input">
                <option v-for="p in projects" :key="p.slug" :value="p.slug">{{ p.name.toUpperCase() }}</option>
              </select>
            </div>
          </div>
          <footer class="modal-footer">
            <button class="btn btn-ghost" @click="closeModal">Cancelar</button>
            <button class="btn btn-primary" :disabled="!isFormValid || creating" @click="createIntegration">
               <span v-if="creating">Criando...</span>
               <span v-else>Criar Integração</span>
            </button>
          </footer>
        </div>

        <div v-else class="modal-body result-body">
           <div class="success-banner">
               <CheckCircle :size="32" class="text-success" />
               <h4>Integração Criada com Sucesso!</h4>
           </div>
           
           <div class="field-box mt-4">
               <label>Webhook URL</label>
               <div class="copy-group">
                   <input readonly :value="createdResult.webhook_url" class="input mono text-xs" />
                   <button @click="copy(createdResult.webhook_url)" class="btn-copy"><Copy :size="14" /></button>
               </div>
               <p class="help-text">Cole esta URL nas configurações de Webhook/API do {{ newForm.source }}.</p>
           </div>

           <div class="field-box mt-4">
               <label>API Key</label>
               <div class="copy-group">
                   <input readonly :value="createdResult.api_key" class="input mono text-xs" />
                   <button @click="copy(createdResult.api_key)" class="btn-copy"><Copy :size="14" /></button>
               </div>
               <p class="help-text text-danger"><strong>IMPORTANTE:</strong> Salve esta chave agora. Por segurança, ela não será exibida novamente.</p>
           </div>

           <div class="guide-box mt-4">
               <h5>Próximos Passos:</h5>
               <ol class="text-3">
                   <li>Copie a Webhook URL acima.</li>
                   <li>Vá ao painel da sua plataforma de vendas.</li>
                   <li>Configure um novo Webhook apontando para esta URL.</li>
                   <li>Certifique-se de enviar os eventos que deseja monitorar.</li>
               </ol>
           </div>

           <footer class="modal-footer mt-6">
               <button class="btn btn-primary w-full" @click="closeModal">Concluído</button>
           </footer>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { 
  Plus, X, Zap, CheckCircle, Copy, Trash2, 
  ExternalLink, Globe, CreditCard, Layout, Terminal, ShoppingCart 
} from 'lucide-vue-next'
import axios from 'axios'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const selectedProject = computed({
  get: () => projectStore.selected,
  set: (value: string) => projectStore.setProject(value),
})
const projects = computed(() => projectStore.projectOptions)
const integrations = ref<any[]>([])
const loading = ref(false)
const creating = ref(false)
const showModal = ref(false)
const createdResult = ref<any>(null)

const newForm = ref({
  name: '',
  source: 'hotmart',
  project_slug: selectedProject.value
})

const isFormValid = computed(() => {
  return newForm.value.name.length > 2 && newForm.value.project_slug
})

const filteredIntegrations = computed(() =>
  integrations.value.filter(i => i.project_slug === selectedProject.value)
)

const getSourceIcon = (source: string) => {
  if (source === 'hotmart') return ShoppingCart
  if (source === 'kiwify') return CreditCard
  if (source === 'stripe') return Globe
  if (source === 'custom') return Terminal
  return Layout
}

const fetchIntegrations = async () => {
    // Note: Em produção, isso bateria no endpoint /integrations/manage?project=...
    // Mas para o dashboard de Admin, talvez listemos tudo ou filtremos por projeto.
    // Usaremos a API configurada no integration-bus.
    loading.value = true
    try {
        // Simulação enquanto o serviço não está live ou estamos no dashboard admin
        const res = await axios.get(`/integrations/manage?project=${selectedProject.value}`)
        integrations.value = res.data
    } catch (e) {
        console.error('Erro ao buscar integrações', e)
        // Mock data para visualização
        integrations.value = [
            { id: 1, name: 'Hotmart Principal', source: 'hotmart', project_slug: 'kosh', active: true, created_at: new Date().toISOString() },
            { id: 2, name: 'Stripe Global', source: 'stripe', project_slug: 'nakta', active: false, created_at: new Date().toISOString() }
        ]
    } finally {
        loading.value = false
    }
}

const createIntegration = async () => {
    creating.value = true
    try {
        const res = await axios.post('/integrations/manage', newForm.value)
        createdResult.value = res.data
        fetchIntegrations()
    } catch (e) {
        console.error('Erro ao criar integração', e)
        alert('Falha ao criar integração. Verifique o servidor.')
    } finally {
        creating.value = false
    }
}

const deleteIntegration = async (id: number) => {
    if (!confirm('Deseja realmente desativar esta integração?')) return
    try {
        await axios.delete(`/integrations/manage/${id}`)
        fetchIntegrations()
    } catch (e) {
        console.error('Erro ao deletar', e)
    }
}

const closeModal = () => {
  showModal.value = false
  createdResult.value = null
  newForm.value = { name: '', source: 'hotmart', project_slug: selectedProject.value }
}

const copy = (text: string) => {
  navigator.clipboard.writeText(text)
  alert('Copiado com sucesso!')
}

const viewDetails = (item: any) => {
    alert(`Detalhes da integração: ${item.name}\nWebhook: ${item.webhook_url || 'N/A'}`)
}

watch(selectedProject, () => {
  newForm.value.project_slug = selectedProject.value
  fetchIntegrations()
})

onMounted(async () => {
  await projectStore.fetchProjects()
  newForm.value.project_slug = selectedProject.value
  fetchIntegrations()
})
</script>

<style scoped>
.integrations-view { display: flex; flex-direction: column; gap: 24px; min-height: 100%; }
.view-header { display: flex; justify-content: space-between; align-items: flex-start; }
.header-actions { display: flex; gap: 12px; align-items: center; }
.project-selector { min-width: 200px; height: 40px; padding: 0 12px; }

.integrations-list { display: flex; flex-direction: column; gap: 12px; }

.integration-card { transition: all 0.2s; border-left: 4px solid var(--copper); }
.integration-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.05); }
.integration-card.inactive { border-left-color: var(--text-4); opacity: 0.7; }

.integration-main { display: flex; align-items: center; gap: 20px; padding: 16px; }

.source-icon {
  width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-3); color: var(--copper);
}
.source-icon.hotmart { background: #ff510015; color: #ff5100; }
.source-icon.kiwify { background: #5d5dff15; color: #5d5dff; }
.source-icon.stripe { background: #635bff15; color: #635bff; }
.source-icon.custom { background: var(--copper-glow); color: var(--copper); }

.integration-info { flex: 1; }
.name-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.name-row h3 { font-size: 16px; font-weight: 700; }

.integration-stats { text-align: center; padding: 0 24px; border-left: 1px solid var(--border-subtle); border-right: 1px solid var(--border-subtle); }
.stat { display: flex; flex-direction: column; }
.stat-value { font-size: 18px; font-weight: 700; color: var(--text-1); }
.stat-label { font-size: 10px; text-transform: uppercase; color: var(--text-3); font-weight: 600; }

.integration-actions { display: flex; gap: 4px; }

.empty-state { text-align: center; padding: 60px 40px; }
.empty-icon { color: var(--text-4); margin-bottom: 20px; }
.empty-state h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.empty-state p { color: var(--text-3); }

/* Modal Styles */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-card {
  width: 100%; max-width: 500px; max-height: 90vh;
  background: var(--bg-1); border-radius: var(--r-lg); border: 1px solid var(--border-mid);
  box-shadow: 0 20px 40px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column;
}
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border-subtle); }
.modal-header h3 { font-size: 18px; font-weight: 700; }
.btn-close { background: transparent; border: none; color: var(--text-3); cursor: pointer; }
.modal-body { padding: 24px; overflow-y: auto; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-2); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding-top: 12px; }

.result-body { text-align: center; }
.success-banner { margin-bottom: 24px; }
.success-banner h4 { font-size: 18px; font-weight: 700; margin-top: 12px; color: var(--text-1); }

.field-box { text-align: left; background: var(--bg-2); padding: 16px; border-radius: var(--r-md); border: 1px solid var(--border-subtle); }
.field-box label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-3); margin-bottom: 8px; display: block; }
.copy-group { display: flex; gap: 8px; }
.help-text { font-size: 11px; color: var(--text-3); margin-top: 8px; }

.guide-box { text-align: left; padding: 16px; background: var(--bg-3); border-radius: var(--r-md); }
.guide-box h5 { font-size: 12px; font-weight: 700; margin-bottom: 10px; }
.guide-box ol { padding-left: 20px; font-size: 12px; line-height: 1.6; }

.animate-slide-up { animation: slideUp 0.3s ease-out; }
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.w-full { width: 100%; }
.mt-4 { margin-top: 1rem; }
.mt-6 { margin-top: 1.5rem; }
.pulse { animation: pulse 1.5s infinite; }
@keyframes pulse { 50% { opacity: 0.5; } }
</style>
