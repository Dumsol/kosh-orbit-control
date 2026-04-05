<template>
  <div class="costs-page">
    <header class="view-header">
      <div>
        <h1 class="text-1">Budget Control</h1>
        <p class="text-3">Projeto: <span class="mono">{{ selectedProject }}</span></p>
      </div>
      <button class="btn btn-ghost" @click="refreshAll" :disabled="loading">
        <RefreshCw :size="14" :class="{ spinning: loading }" />
      </button>
    </header>

    <div class="summary-grid">
      <div class="card metric">
        <span class="label">Gasto Mês</span>
        <span class="value">R$ {{ currency(summary.spent) }}</span>
      </div>
      <div class="card metric">
        <span class="label">Orçamento</span>
        <span class="value">R$ {{ currency(summary.budget) }}</span>
      </div>
      <div class="card metric">
        <span class="label">Uso</span>
        <span class="value" :class="summary.thresholdReached ? 'text-danger' : 'text-success'">
          {{ summary.usagePct.toFixed(1) }}%
        </span>
      </div>
      <div class="card metric">
        <span class="label">Threshold</span>
        <span class="value">{{ summary.thresholdPct.toFixed(0) }}%</span>
      </div>
    </div>

    <div class="content-grid">
      <section class="card p-4">
        <div class="section-head">
          <h3>Policy</h3>
          <span class="text-3 text-xs">Auto-pause por orçamento</span>
        </div>
        <div class="form-row">
          <label>Monthly Budget (R$)</label>
          <input v-model.number="policy.monthlyBudget" class="input" type="number" min="0" />
        </div>
        <div class="form-row">
          <label>Threshold (%)</label>
          <input v-model.number="policy.thresholdPct" class="input" type="number" min="1" max="100" />
        </div>
        <div class="form-row checkbox-row">
          <input id="auto-pause" v-model="policy.autoPauseEnabled" type="checkbox" />
          <label for="auto-pause">Habilitar auto-pause</label>
        </div>
        <div class="form-row">
          <label>Serviços para pausar (CSV)</label>
          <input v-model="pauseServicesCsv" class="input" placeholder="worker,alert-worker,ingest-api" />
        </div>
        <div class="actions">
          <button class="btn btn-primary" @click="savePolicy" :disabled="saving">
            {{ saving ? 'Salvando...' : 'Salvar Policy' }}
          </button>
        </div>
      </section>

      <section class="card p-4">
        <div class="section-head">
          <h3>Per Service</h3>
          <span class="text-3 text-xs">últimos 30 dias</span>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Service</th>
              <th class="text-right">Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in services" :key="item.source + item.label">
              <td>{{ item.label }}</td>
              <td class="text-right mono">R$ {{ currency(Number(item.total || 0)) }}</td>
              <td>
                <button class="btn btn-xs btn-ghost text-danger" @click="pauseService(item.source)">
                  Pause
                </button>
              </td>
            </tr>
            <tr v-if="!services.length">
              <td colspan="3" class="text-3">Sem dados de custos ainda.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <section class="card p-4">
      <div class="section-head">
        <h3>Actions Log</h3>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Serviço</th>
            <th>Ação</th>
            <th>Motivo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in actions" :key="a.id">
            <td class="mono text-xs">{{ new Date(a.created_at).toLocaleString('pt-BR') }}</td>
            <td>{{ a.service_name }}</td>
            <td><span class="badge">{{ a.action }}</span></td>
            <td class="text-3">{{ a.reason }}</td>
          </tr>
          <tr v-if="!actions.length">
            <td colspan="4" class="text-3">Sem ações registradas.</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { RefreshCw } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const selectedProject = computed(() => projectStore.selected)

const loading = ref(false)
const saving = ref(false)
const services = ref<any[]>([])
const actions = ref<any[]>([])
const summary = ref({
  spent: 0,
  budget: 0,
  usagePct: 0,
  thresholdPct: 90,
  thresholdReached: false,
  autoPauseEnabled: false,
  pauseServices: [] as string[],
})

const policy = ref({
  monthlyBudget: 0,
  thresholdPct: 90,
  autoPauseEnabled: false,
})
const pauseServicesCsv = ref('')

const currency = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const loadSummary = async () => {
  const { data } = await axios.get(`/api/costs/summary?project=${selectedProject.value}`)
  summary.value = {
    spent: Number(data.spent || 0),
    budget: Number(data.budget || 0),
    usagePct: Number(data.usagePct || 0),
    thresholdPct: Number(data.thresholdPct || 90),
    thresholdReached: !!data.thresholdReached,
    autoPauseEnabled: !!data.autoPauseEnabled,
    pauseServices: Array.isArray(data.pauseServices) ? data.pauseServices : [],
  }
  policy.value = {
    monthlyBudget: Number(data.budget || 0),
    thresholdPct: Number(data.thresholdPct || 90),
    autoPauseEnabled: !!data.autoPauseEnabled,
  }
  pauseServicesCsv.value = summary.value.pauseServices.join(',')
}

const loadServices = async () => {
  const { data } = await axios.get(`/api/costs/services?project=${selectedProject.value}&months=1`)
  services.value = Array.isArray(data) ? data : []
}

const loadActions = async () => {
  const { data } = await axios.get(`/api/costs/actions?project=${selectedProject.value}`)
  actions.value = Array.isArray(data) ? data : []
}

const refreshAll = async () => {
  loading.value = true
  try {
    await Promise.all([loadSummary(), loadServices(), loadActions()])
  } finally {
    loading.value = false
  }
}

const savePolicy = async () => {
  saving.value = true
  try {
    await axios.post('/api/costs/policy', {
      project: selectedProject.value,
      monthlyBudget: policy.value.monthlyBudget,
      thresholdPct: policy.value.thresholdPct,
      autoPauseEnabled: policy.value.autoPauseEnabled,
      pauseServices: pauseServicesCsv.value.split(',').map((s) => s.trim()).filter(Boolean),
    })
    await refreshAll()
  } finally {
    saving.value = false
  }
}

const pauseService = async (service: string) => {
  await axios.post('/api/costs/pause-service', {
    project: selectedProject.value,
    service,
    reason: 'Manual pause from panel',
  })
  await loadActions()
}

watch(selectedProject, () => {
  refreshAll()
})

onMounted(async () => {
  await projectStore.fetchProjects()
  await refreshAll()
})
</script>

<style scoped>
.costs-page { display: flex; flex-direction: column; gap: 16px; }
.view-header { display: flex; justify-content: space-between; align-items: center; }
.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.metric { padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 11px; text-transform: uppercase; color: var(--text-3); }
.value { font-size: 22px; font-weight: 700; }

.content-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.checkbox-row { flex-direction: row; align-items: center; }

.actions { margin-top: 8px; }
.text-right { text-align: right; }

.spinning { animation: spin 600ms linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
