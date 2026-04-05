<template>
  <div class="analytics">
    <!-- Top bar: project selector + actions -->
    <div class="analytics-topbar">
      <div class="topbar-left">
        <span class="topbar-title">Analytics</span>
        <div class="project-tabs">
          <button
            v-for="p in projects" :key="p.slug"
            class="proj-tab"
            :class="{ active: selectedProject === p.slug }"
            @click="selectProject(p.slug)"
          >{{ p.name.toUpperCase() }}</button>
        </div>
      </div>
      <div class="topbar-right">
        <select v-model="dateRange" class="select-clean" @change="fetchAll">
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 6 months</option>
          <option value="365">Last 12 months</option>
        </select>
        <button class="btn btn-ghost btn-sm" @click="fetchAll" :disabled="loading">
          <RefreshCw :size="13" :class="{ spinning: loading }" />
        </button>
        <button class="btn btn-sm btn-primary" @click="showQuery = !showQuery">
          <Code2 :size="13" /> SQL Query
        </button>
      </div>
    </div>

    <!-- SQL Query Panel (Redash-style) -->
    <div v-if="showQuery" class="query-panel card">
      <div class="query-header">
        <span class="section-label">Custom SQL Query — metrics_db</span>
        <div class="query-actions">
          <button class="btn btn-xs btn-ghost" @click="showQuery = false">Fechar</button>
          <button class="btn btn-xs btn-primary" @click="runQuery" :disabled="queryLoading">
            {{ queryLoading ? 'Running...' : '▶ Run Query' }}
          </button>
        </div>
      </div>
      <textarea
        v-model="customSql"
        class="sql-editor mono"
        placeholder="SELECT project_slug, SUM(revenue) FROM mrr_data GROUP BY 1 ORDER BY 2 DESC"
        rows="5"
      />
      <div v-if="queryResult.length" class="query-result">
        <table class="table table-compact">
          <thead><tr><th v-for="col in Object.keys(queryResult[0])" :key="col">{{ col }}</th></tr></thead>
          <tbody>
            <tr v-for="(row, i) in queryResult" :key="i">
              <td v-for="col in Object.keys(row)" :key="col" class="mono text-xs">{{ row[col] }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-3 text-xs mt-2">{{ queryResult.length }} rows · {{ queryDuration }}ms</p>
      </div>
      <p v-if="queryError" class="text-danger text-xs mt-2 mono">{{ queryError }}</p>
    </div>

    <!-- KPI Summary Row -->
    <div class="kpi-row">
      <div class="kpi-card">
        <span class="kpi-label">MRR Atual</span>
        <span class="kpi-value text-success">R$ {{ formatCurrency(currentMRR) }}</span>
        <span class="kpi-delta" :class="mrrDelta >= 0 ? 'up' : 'down'">
          {{ mrrDelta >= 0 ? '▲' : '▼' }} {{ Math.abs(mrrDelta).toFixed(1) }}%
        </span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Clientes Pagantes</span>
        <span class="kpi-value">{{ currentCustomers }}</span>
        <span class="kpi-sub">ARPU R$ {{ currentARPU }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Conversão Total</span>
        <span class="kpi-value text-copper">{{ totalConversion }}%</span>
        <span class="kpi-sub">{{ funnelData[0]?.sessions || 0 }} → {{ funnelData[funnelData.length-1]?.sessions || 0 }}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">LTV Médio</span>
        <span class="kpi-value">R$ {{ avgLTV }}</span>
        <span class="kpi-sub">CAC R$ {{ avgCAC }}</span>
      </div>
    </div>

    <!-- Main grid: chart + funnel side by side -->
    <div class="main-grid">
      <!-- MRR Chart — Metabase style: dark card, area fill -->
      <div class="chart-card card">
        <div class="chart-header">
          <div>
            <span class="section-label">Receita Mensal (MRR)</span>
            <p class="text-3 text-xs">{{ selectedProject.toUpperCase() }} — {{ mrrData.length }} meses</p>
          </div>
          <div class="chart-type-btns">
            <button
              v-for="t in ['line','bar']" :key="t"
              class="btn btn-xs btn-ghost"
              :class="{ active: chartType === t }"
              @click="chartType = t"
            >{{ t }}</button>
          </div>
        </div>
        <div class="chart-area">
          <Line v-if="chartType === 'line'" :data="mrrChartData" :options="lineOptions" />
          <Bar v-else :data="mrrBarData" :options="barOptions" />
        </div>
      </div>

      <!-- Funnel — vertical waterfall style -->
      <div class="funnel-card card">
        <span class="section-label">Funil de Conversão</span>
        <div v-if="!funnelData.length" class="empty-state">Sem dados</div>
        <div v-else class="funnel-bars">
          <div v-for="(step, i) in funnelData" :key="step.step_name" class="funnel-row">
            <div class="funnel-label">
              <span class="text-3 text-xs mono">#{{ step.step_order }}</span>
              <span class="text-1 text-sm">{{ step.step_name }}</span>
            </div>
            <div class="funnel-bar-wrap">
              <div
                class="funnel-bar-fill"
                :style="{
                  width: funnelBarWidth(step.sessions) + '%',
                  background: funnelColor(i),
                }"
              />
              <span class="funnel-count mono text-xs">{{ Number(step.sessions).toLocaleString() }}</span>
            </div>
            <div class="funnel-cr" v-if="i > 0">
              <span class="badge text-xs" :class="stepCR(i) < 20 ? 'badge-danger' : 'badge-success'">
                {{ stepCR(i).toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs: Cohort | Acquisition | SEO | Costs | Logs Volume -->
    <div class="tabs-section">
      <nav class="tab-bar-flat">
        <button
          v-for="t in tabs" :key="t.id"
          class="tab-flat"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          <component :is="t.icon" :size="13" />
          {{ t.label }}
        </button>
      </nav>

      <!-- COHORT -->
      <div v-if="activeTab === 'cohort'" class="tab-body">
        <div v-if="!cohortData.length" class="empty-state card">Sem dados de cohort ainda. Dados aparecem após o primeiro mês de atividade.</div>
        <div v-else class="cohort-wrap card">
          <CohortTable :rows="cohortData" :project-slug="selectedProject" />
        </div>
      </div>

      <!-- ACQUISITION -->
      <div v-if="activeTab === 'acquisition'" class="tab-body">
        <div class="card">
          <div class="card-table-header">
            <span class="section-label">Unit Economics por Canal</span>
          </div>
          <div v-if="!acquisitionData.length" class="empty-state p-8">Sem dados de aquisição.</div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>Canal</th>
                <th class="text-right">CAC</th>
                <th class="text-right">LTV</th>
                <th class="text-right">LTV:CAC</th>
                <th class="text-right">Payback</th>
                <th>Saúde</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in acquisitionData" :key="a.source">
                <td class="font-medium">{{ a.source }}</td>
                <td class="text-right mono text-danger">R$ {{ Number(a.cac).toFixed(0) }}</td>
                <td class="text-right mono text-success">R$ {{ Number(a.ltv).toFixed(0) }}</td>
                <td class="text-right mono font-bold" :class="ltvCacClass(a)">
                  {{ (Number(a.ltv) / (Number(a.cac) || 1)).toFixed(1) }}x
                </td>
                <td class="text-right">
                  <span class="badge" :class="paybackClass(a.payback_months)">{{ a.payback_months }}m</span>
                </td>
                <td>
                  <div class="health-bar">
                    <div class="health-fill" :style="{ width: Math.min(100, (Number(a.ltv) / (Number(a.cac)||1)) / 5 * 100) + '%', background: ltvCacColor(a) }" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SEO -->
      <div v-if="activeTab === 'seo'" class="tab-body">
        <div class="card">
          <div class="card-table-header">
            <span class="section-label">Top Queries Orgânicas (GSC)</span>
            <span class="text-3 text-xs">Últimos {{ dateRange }} dias</span>
          </div>
          <div v-if="!seoData.length" class="empty-state p-8">Sem dados de SEO. Importe via Google Search Console.</div>
          <table v-else class="table">
            <thead>
              <tr><th>Query</th><th class="text-right">Clicks</th><th class="text-right">Impressões</th><th class="text-right">CTR</th><th class="text-right">Posição</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in seoData" :key="s.query">
                <td>{{ s.query }}</td>
                <td class="text-right mono font-bold">{{ s.clicks }}</td>
                <td class="text-right mono text-3">{{ s.impressions }}</td>
                <td class="text-right mono">{{ (Number(s.ctr)*100).toFixed(1) }}%</td>
                <td class="text-right">
                  <span class="badge" :class="Number(s.position) <= 3 ? 'badge-success' : Number(s.position) <= 10 ? 'badge-info' : 'badge-warn'">
                    #{{ Math.round(Number(s.position)) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- COSTS -->
      <div v-if="activeTab === 'costs'" class="tab-body">
        <div class="card">
          <span class="section-label">GCP Billing</span>
          <div v-if="!costsData.length" class="empty-state p-8">Sem dados de billing. Configure exportação do GCP Billing para metrics_db.</div>
          <table v-else class="table">
            <thead><tr><th>Categoria</th><th>Serviço</th><th>Mês</th><th class="text-right">Total</th></tr></thead>
            <tbody>
              <tr v-for="c in costsData" :key="c.source + c.month">
                <td><span class="badge badge-info">{{ c.category }}</span></td>
                <td>{{ c.source }}</td>
                <td class="text-3 text-xs">{{ fmtMonth(c.month) }}</td>
                <td class="text-right mono font-bold text-danger">R$ {{ Number(c.total).toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- LOGS VOLUME (mini ELK panel) -->
      <div v-if="activeTab === 'logs'" class="tab-body">
        <div class="grid-2 gap-4">
          <div class="card">
            <span class="section-label">Volume (24h)</span>
            <div class="chart-area-sm">
              <Line v-if="logVolumeData.labels.length" :data="logVolumeData" :options="sparkOptions" />
              <div v-else class="empty-state">Sem logs.</div>
            </div>
          </div>
          <div class="card">
            <span class="section-label">Por Projeto (24h)</span>
            <table class="table">
              <thead><tr><th>Projeto</th><th class="text-right">Logs</th></tr></thead>
              <tbody>
                <tr v-for="p in logsByProject" :key="p.project">
                  <td>{{ p.project }}</td>
                  <td class="text-right mono font-bold">{{ p.c }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { RefreshCw, TrendingUp, Users, Target, Search, Server, BarChart2, Code2 } from 'lucide-vue-next'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, Title, Tooltip, Legend, LineElement, BarElement,
  CategoryScale, LinearScale, PointElement, Filler
} from 'chart.js'
import axios from 'axios'
import CohortTable from '@/components/CohortTable.vue'
import { useProjectStore } from '@/stores/project'

ChartJS.register(Title, Tooltip, Legend, LineElement, BarElement, CategoryScale, LinearScale, PointElement, Filler)

// ── State ─────────────────────────────────────────────────────
const loading        = ref(false)
const showQuery      = ref(false)
const queryLoading   = ref(false)
const queryError     = ref('')
const queryDuration  = ref(0)
const customSql      = ref('')
const queryResult    = ref<any[]>([])
const chartType      = ref<'line'|'bar'>('line')
const dateRange      = ref('90')
const activeTab      = ref('acquisition')

const projectStore = useProjectStore()
const selectedProject = computed({
  get: () => projectStore.selected,
  set: (value: string) => projectStore.setProject(value),
})
const projects = computed(() => projectStore.projectOptions)

const mrrData         = ref<any[]>([])
const cohortData      = ref<any[]>([])
const funnelData      = ref<any[]>([])
const acquisitionData = ref<any[]>([])
const seoData         = ref<any[]>([])
const costsData       = ref<any[]>([])
const logVolumeData   = ref<any>({ labels: [], datasets: [] })
const logsByProject   = ref<any[]>([])

const tabs = [
  { id: 'cohort',      label: 'Cohort',       icon: Users },
  { id: 'acquisition', label: 'Aquisição',    icon: Target },
  { id: 'seo',         label: 'SEO',          icon: Search },
  { id: 'costs',       label: 'Infraestrutura', icon: Server },
  { id: 'logs',        label: 'Log Volume',   icon: BarChart2 },
]

// ── KPI computeds ─────────────────────────────────────────────
const currentMRR   = computed(() => mrrData.value.length ? Number(mrrData.value[mrrData.value.length - 1]?.revenue || 0) : 0)
const prevMRR      = computed(() => mrrData.value.length > 1 ? Number(mrrData.value[mrrData.value.length - 2]?.revenue || 0) : 0)
const mrrDelta     = computed(() => prevMRR.value > 0 ? ((currentMRR.value - prevMRR.value) / prevMRR.value) * 100 : 0)
const currentCustomers = computed(() => mrrData.value.length ? mrrData.value[mrrData.value.length - 1]?.paying_customers || 0 : 0)
const currentARPU  = computed(() => currentCustomers.value > 0 ? (currentMRR.value / currentCustomers.value).toFixed(0) : '0')
const totalConversion = computed(() => {
  if (!funnelData.value.length) return '0.0'
  const first = Number(funnelData.value[0]?.sessions || 1)
  const last  = Number(funnelData.value[funnelData.value.length - 1]?.sessions || 0)
  return ((last / first) * 100).toFixed(1)
})
const avgLTV = computed(() => {
  if (!acquisitionData.value.length) return '0'
  const sum = acquisitionData.value.reduce((a, b) => a + Number(b.ltv || 0), 0)
  return (sum / acquisitionData.value.length).toFixed(0)
})
const avgCAC = computed(() => {
  if (!acquisitionData.value.length) return '0'
  const sum = acquisitionData.value.reduce((a, b) => a + Number(b.cac || 0), 0)
  return (sum / acquisitionData.value.length).toFixed(0)
})

// ── Charts ────────────────────────────────────────────────────
const COPPER = '#b87333'
const COPPER_A = 'rgba(184,115,51,0.15)'

const mrrChartData = computed(() => ({
  labels: mrrData.value.map(d => d.month?.slice(0, 7) || d.month),
  datasets: [{
    label: 'MRR (R$)',
    data: mrrData.value.map(d => Number(d.revenue)),
    borderColor: COPPER,
    backgroundColor: COPPER_A,
    tension: 0.4, fill: true,
    pointRadius: 4, pointBackgroundColor: '#fff',
    pointBorderColor: COPPER, pointBorderWidth: 2,
  }]
}))

const mrrBarData = computed(() => ({
  labels: mrrData.value.map(d => d.month?.slice(0, 7) || d.month),
  datasets: [{
    label: 'MRR (R$)',
    data: mrrData.value.map(d => Number(d.revenue)),
    backgroundColor: mrrData.value.map((_, i) => i === mrrData.value.length - 1 ? COPPER : COPPER_A),
    borderColor: COPPER, borderWidth: 1, borderRadius: 4,
  }]
}))

const lineOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: any) => `R$ ${ctx.parsed.y.toLocaleString('pt-BR')}` } }
  },
  scales: {
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#888', callback: (v: any) => `R$${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}` } },
    x: { grid: { display: false }, ticks: { color: '#888' } }
  }
}

const barOptions = { ...lineOptions }

const sparkOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#888', maxTicksLimit: 4 } },
    x: { grid: { display: false }, ticks: { color: '#888', maxTicksLimit: 8 } }
  }
}

// ── Funnel helpers ────────────────────────────────────────────
const maxSessions = computed(() => Math.max(...funnelData.value.map(s => Number(s.sessions)), 1))
const funnelBarWidth = (sessions: number) => (Number(sessions) / maxSessions.value) * 100
const funnelColor = (i: number) => {
  const colors = ['#b87333', '#c9883e', '#da9e4a', '#ebba5a', '#f9d06b']
  return colors[i % colors.length]
}
const stepCR = (i: number) => {
  const prev = Number(funnelData.value[i - 1]?.sessions || 1)
  const curr = Number(funnelData.value[i]?.sessions || 0)
  return (curr / prev) * 100
}

// ── Acquisition helpers ───────────────────────────────────────
const ltvCacClass = (a: any) => {
  const r = Number(a.ltv) / (Number(a.cac) || 1)
  return r >= 3 ? 'text-success' : r >= 1.5 ? 'text-warning' : 'text-danger'
}
const ltvCacColor = (a: any) => {
  const r = Number(a.ltv) / (Number(a.cac) || 1)
  return r >= 3 ? '#22c55e' : r >= 1.5 ? '#f59e0b' : '#ef4444'
}
const paybackClass = (m: number) => m <= 6 ? 'badge-success' : m <= 12 ? 'badge-info' : 'badge-warn'

// ── Formatting ────────────────────────────────────────────────
const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtMonth = (d: string) => new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })

// ── Data fetching ─────────────────────────────────────────────
const selectProject = (p: string) => { selectedProject.value = p }

const fetchAll = async () => {
  loading.value = true
  const p = selectedProject.value
  try {
    const [mrr, cohort, funnel, acq, seo, costs, logStats] = await Promise.allSettled([
      axios.get(`/api/bi/mrr?project=${p}`),
      axios.get(`/api/bi/cohort?project=${p}`),
      axios.get(`/api/bi/funnel?project=${p}&funnel=main_funnel&days=${dateRange.value}`),
      axios.get(`/api/bi/acquisition?project=${p}`),
      axios.get(`/api/bi/seo?project=${p}&days=${dateRange.value}`),
      axios.get(`/api/bi/costs?project=${p}`),
      axios.get(`/api/logs/stats?project=${p}`),
    ])
    if (mrr.status === 'fulfilled')    mrrData.value         = mrr.value.data
    if (cohort.status === 'fulfilled') cohortData.value      = cohort.value.data
    if (funnel.status === 'fulfilled') funnelData.value      = funnel.value.data
    if (acq.status === 'fulfilled')    acquisitionData.value = acq.value.data
    if (seo.status === 'fulfilled')    seoData.value         = seo.value.data
    if (costs.status === 'fulfilled')  costsData.value       = costs.value.data

    if (logStats.status === 'fulfilled') {
      const stats = logStats.value.data
      logsByProject.value = stats.byProject || []
      const therm = stats.thermometer || []
      logVolumeData.value = {
        labels: therm.map((r: any) => new Date(r.h).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })),
        datasets: [{
          label: 'Logs/h',
          data: therm.map((r: any) => r.c),
          borderColor: COPPER, backgroundColor: COPPER_A,
          tension: 0.3, fill: true, pointRadius: 2,
        }]
      }
    }
  } finally {
    loading.value = false
  }
}

// SQL runner — uses /api/query (logs_db) but routes to separate metrics endpoint if needed
const runQuery = async () => {
  if (!customSql.value.trim()) return
  queryLoading.value = true; queryError.value = ''; queryResult.value = []
  const t = Date.now()
  try {
    const res = await axios.post('/api/query', { sql: customSql.value })
    queryResult.value = res.data.rows || []
    queryDuration.value = Date.now() - t
  } catch (e: any) {
    queryError.value = e.response?.data?.error || e.message
  } finally {
    queryLoading.value = false
  }
}

onMounted(async () => {
  await projectStore.fetchProjects()
  fetchAll()
})

watch(selectedProject, () => {
  fetchAll()
})
</script>

<style scoped>
.analytics { display: flex; flex-direction: column; gap: 20px; }

/* Topbar */
.analytics-topbar {
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid var(--border-mid); padding-bottom: 14px;
}
.topbar-title { font-size: 18px; font-weight: 700; color: var(--text-1); margin-right: 20px; }
.topbar-left { display: flex; align-items: center; gap: 0; }
.topbar-right { display: flex; align-items: center; gap: 8px; }

.project-tabs { display: flex; gap: 4px; }
.proj-tab {
  padding: 5px 12px; border: 1px solid var(--border-mid); background: transparent;
  border-radius: var(--r-sm); font-size: 11px; font-weight: 600; color: var(--text-3);
  cursor: pointer; transition: all 0.15s; letter-spacing: 0.5px;
}
.proj-tab:hover { background: var(--bg-2); color: var(--text-1); }
.proj-tab.active { background: var(--copper-glow); border-color: var(--copper-border); color: var(--copper); }

.select-clean {
  height: 30px; padding: 0 10px; border: 1px solid var(--border-mid);
  border-radius: var(--r-sm); background: var(--bg-1); font-size: 12px; color: var(--text-1);
}

/* SQL Panel */
.query-panel { padding: 16px; }
.query-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.query-actions { display: flex; gap: 8px; }
.sql-editor {
  width: 100%; background: #0d0d0f; color: #e8e8e8; border: 1px solid #2a2a2e;
  border-radius: var(--r-sm); padding: 12px; font-size: 12px; font-family: 'JetBrains Mono', monospace;
  resize: vertical; outline: none; box-sizing: border-box;
}
.sql-editor:focus { border-color: var(--copper-border); }
.query-result { margin-top: 12px; overflow-x: auto; max-height: 240px; overflow-y: auto; }
.table-compact td, .table-compact th { padding: 6px 12px; }

/* KPI Row */
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi-card {
  background: var(--bg-1); border: 1px solid var(--border-subtle);
  border-radius: var(--r-md); padding: 16px 20px;
  display: flex; flex-direction: column; gap: 4px;
}
.kpi-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; }
.kpi-value { font-size: 24px; font-weight: 700; color: var(--text-1); }
.kpi-delta { font-size: 11px; font-weight: 600; }
.kpi-delta.up { color: var(--success); }
.kpi-delta.down { color: var(--danger); }
.kpi-sub { font-size: 11px; color: var(--text-3); }

/* Main grid */
.main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
.chart-card { padding: 16px; }
.chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.chart-type-btns { display: flex; gap: 4px; }
.chart-type-btns .active { background: var(--bg-2); color: var(--copper); }
.chart-area { height: 240px; }
.chart-area-sm { height: 160px; }

/* Funnel */
.funnel-card { padding: 16px; }
.funnel-bars { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.funnel-row { display: flex; align-items: center; gap: 10px; }
.funnel-label { display: flex; flex-direction: column; width: 100px; flex-shrink: 0; }
.funnel-bar-wrap { flex: 1; display: flex; align-items: center; gap: 8px; position: relative; }
.funnel-bar-fill { height: 24px; border-radius: 4px; min-width: 4px; transition: width 0.4s ease; }
.funnel-count { color: var(--text-2); white-space: nowrap; }
.funnel-cr { width: 54px; flex-shrink: 0; text-align: right; }

/* Tabs */
.tabs-section { display: flex; flex-direction: column; gap: 0; }
.tab-bar-flat {
  display: flex; gap: 2px; border-bottom: 1px solid var(--border-mid); padding-bottom: 0;
}
.tab-flat {
  display: flex; align-items: center; gap: 6px; padding: 10px 16px;
  border: none; background: transparent; color: var(--text-3); font-size: 12px;
  font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent;
  transition: all 0.15s; margin-bottom: -1px;
}
.tab-flat:hover { color: var(--text-1); background: var(--bg-2); border-radius: var(--r-sm) var(--r-sm) 0 0; }
.tab-flat.active { color: var(--copper); border-bottom-color: var(--copper); }
.tab-body { padding-top: 16px; }

/* Tables */
.card-table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.text-right { text-align: right; }

/* Health bar */
.health-bar { width: 80px; height: 6px; background: var(--bg-3); border-radius: 3px; overflow: hidden; }
.health-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }

/* Empty */
.empty-state { display: flex; align-items: center; justify-content: center; min-height: 80px; color: var(--text-4); font-style: italic; font-size: 13px; }
.cohort-wrap { overflow-x: auto; }

/* Grid */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
.gap-4 { gap: 16px; }
.p-8 { padding: 32px; }
.mt-2 { margin-top: 8px; }

/* Spinner */
.spinning { animation: spin 600ms linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Badge overrides */
.badge-warn { background: #fef3c7; color: #d97706; }
.badge-info { background: #e0f2fe; color: #0284c7; }
</style>
