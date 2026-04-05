<template>
  <div class="overview-page">
    <div class="header">
      <div>
        <h1 class="page-title">Operational Overview</h1>
        <p class="subtitle text-3">Iowa Node & Cloud Run Cluster</p>
      </div>
      <div class="header-actions">
        <span class="refresh-timer text-4">Refresh in {{ countdown }}s</span>
        <button class="btn btn-ghost" @click="refreshData">
          <RefreshCw :size="14" :stroke-width="3" :class="{ spinning: loading }" />
          Manual Sync
        </button>
      </div>
    </div>

    <!-- VM Resource Stats -->
    <div class="grid-stats">
      <div class="card card-sm">
        <label class="section-label">CPU (Cloud Run)</label>
        <div class="stat-main">
          <span class="stat-value">{{ metrics.cpu }}%</span>
          <div class="stat-chart mini-bar" :style="{ width: metrics.cpu + '%', background: metrics.cpu > 80 ? 'var(--danger)' : 'var(--success)' }"></div>
        </div>
        <p class="text-4">{{ metrics.cpuCores }} vCPU</p>
      </div>
      <div class="card card-sm">
        <label class="section-label">RAM VM (Iowa)</label>
        <div class="stat-main">
          <span class="stat-value">{{ metrics.ramUsed }}</span>
          <div class="stat-chart mini-bar" :style="{ width: metrics.ramPct + '%', background: metrics.ramPct > 80 ? 'var(--danger)' : 'var(--warning)' }"></div>
        </div>
        <p class="text-4">Total: {{ metrics.ramTotal }}</p>
      </div>
      <div class="card card-sm">
        <label class="section-label">Redis Memory</label>
        <div class="stat-main">
          <span class="stat-value">{{ services.redis?.memory || '—' }}</span>
          <div class="stat-chart mini-bar" style="width: 15%; background: var(--info);"></div>
        </div>
        <p class="text-4">Status: <span :class="services.redis?.status === 'online' ? 'text-success' : 'text-danger'">{{ services.redis?.status || '—' }}</span></p>
      </div>
      <div class="card card-sm">
        <label class="section-label">PostgreSQL</label>
        <div class="stat-main">
          <span class="stat-value">{{ services.postgres?.status === 'online' ? 'Online' : 'Offline' }}</span>
          <div class="stat-chart mini-bar" :style="{ width: '100%', background: services.postgres?.status === 'online' ? 'var(--success)' : 'var(--danger)' }"></div>
        </div>
        <p class="text-4">{{ services.postgres?.host }}</p>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid-main">
      <!-- Col 1: Service Status (replaces Docker — panel-api runs in Cloud Run) -->
      <div class="card col-section">
        <div class="card-header">
          <label class="section-label">Service Status</label>
          <div :class="['dot', allOnline ? 'dot-online' : 'dot-offline']"></div>
        </div>
        <table class="table">
          <thead><tr><th>Service</th><th>Status</th><th>Type</th></tr></thead>
          <tbody>
            <tr>
              <td class="font-medium mono text-1">postgres</td>
              <td><div :class="['dot', `dot-${services.postgres?.status || 'offline'}`]"></div></td>
              <td class="text-3 text-xs">VM Docker</td>
            </tr>
            <tr>
              <td class="font-medium mono text-1">redis</td>
              <td><div :class="['dot', `dot-${services.redis?.status || 'offline'}`]"></div></td>
              <td class="text-3 text-xs">VM Docker</td>
            </tr>
            <tr v-for="(svc, name) in (services.cloudRun || {})" :key="name">
              <td class="font-medium mono text-1">{{ name }}</td>
              <td><div :class="['dot', `dot-${svc.status || 'offline'}`]"></div></td>
              <td class="text-3 text-xs">Cloud Run</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Col 2: Cloud Run detail -->
      <div class="card col-section">
        <div class="card-header">
          <label class="section-label">Cloud Run Services</label>
          <div class="dot dot-copper"></div>
        </div>
        <div class="list-services">
          <div
            v-for="(svc, name) in (services.cloudRun || {})"
            :key="name"
            class="service-item"
          >
            <div class="service-info">
              <div :class="['dot', `dot-${svc.status}`]"></div>
              <span class="font-medium text-1">{{ name }}</span>
            </div>
            <div class="service-meta">
              <span class="text-3">southamerica-east1</span>
              <span :class="['badge', svc.status === 'online' ? 'badge-success' : 'badge-danger']">{{ svc.status }}</span>
            </div>
          </div>
          <div v-if="!Object.keys(services.cloudRun || {}).length" class="text-4 text-xs italic p-4">
            Loading...
          </div>
        </div>
      </div>

      <!-- Col 3: Active Alerts -->
      <div class="card col-section card-danger">
        <div class="card-header">
          <label class="section-label">Active Alerts</label>
          <div :class="['dot', alerts.length ? 'dot-offline pulse' : 'dot-online']"></div>
        </div>
        <div class="activity-feed">
          <div v-if="!alerts.length" class="alert-empty">
            <span class="text-success">✓</span> Sem alertas recentes
          </div>
          <div v-for="a in alerts" :key="a.time + a.msg" class="alert-item">
            <div class="alert-side" :class="`level-${a.level.toLowerCase()}`"></div>
            <div class="alert-content">
              <div class="alert-meta">
                <span class="level-tag" :class="`level-${a.level.toLowerCase()}`">{{ a.level }}</span>
                <span class="text-4">{{ a.time }}</span>
              </div>
              <p class="alert-msg">{{ a.msg }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import axios from 'axios'
import { useProjectStore } from '@/stores/project'

const loading  = ref(false)
const countdown = ref(30)
let timer: any = null
const projectStore = useProjectStore()
const selectedProject = computed(() => projectStore.selected)

const metrics = ref({
  cpu: 0, cpuCores: 1,
  ramUsed: '—', ramTotal: '—', ramPct: 0,
})
const services = ref<any>({ postgres: null, redis: null, cloudRun: {} })
const alerts   = ref<any[]>([])

const allOnline = computed(() =>
  services.value.postgres?.status === 'online' &&
  services.value.redis?.status === 'online'
)

const fetchMetrics = async () => {
  try {
    const res = await axios.get(`/api/metrics?project=${selectedProject.value}`)
    const m = res.data
    metrics.value.cpu = Math.round(m.cpu?.currentLoad || 0)
    metrics.value.cpuCores = m.cpu?.cpus || 1
    const ram = m.mem
    if (ram) {
      const usedGB = (ram.used / 1024 / 1024 / 1024).toFixed(2)
      const totGB  = (ram.total / 1024 / 1024 / 1024).toFixed(1)
      metrics.value.ramUsed  = `${usedGB} GB`
      metrics.value.ramTotal = `${totGB} GB`
      metrics.value.ramPct   = Math.round((ram.used / ram.total) * 100)
    }
  } catch {}
}

const fetchServices = async () => {
  try {
    const res = await axios.get(`/api/services?project=${selectedProject.value}`)
    services.value = res.data
  } catch {}
}

const fetchAlerts = async () => {
  try {
    const res = await axios.get(`/api/logs/alerts?project=${selectedProject.value}`)
    alerts.value = Array.isArray(res.data) ? res.data : []
  } catch {}
}

const refreshData = async () => {
  loading.value = true
  countdown.value = 30
  await Promise.allSettled([fetchMetrics(), fetchServices(), fetchAlerts()])
  loading.value = false
}

watch(selectedProject, () => {
  refreshData()
})

onMounted(async () => {
  await projectStore.fetchProjects()
  refreshData()
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      refreshData()
    }
  }, 1000)
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.overview-page { display: flex; flex-direction: column; gap: 24px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; }
.header-actions { display: flex; align-items: center; gap: 16px; }
.refresh-timer { font-size: 11px; font-family: 'JetBrains Mono', monospace; }

.grid-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.stat-main { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.stat-value { font-size: 18px; font-weight: 700; color: var(--text-1); }
.mini-bar { height: 4px; border-radius: 2px; opacity: 0.8; transition: width 0.3s; }

.grid-main { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
.col-section { display: flex; flex-direction: column; min-height: 360px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }

.list-services { display: flex; flex-direction: column; gap: 12px; }
.service-item { padding: 12px; background: var(--bg-2); border-radius: var(--r-md); display: flex; justify-content: space-between; align-items: center; }
.service-info { display: flex; align-items: center; gap: 10px; }
.service-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 10px; }

.activity-feed { display: flex; flex-direction: column; gap: 12px; }
.alert-empty { padding: 16px; text-align: center; color: var(--text-3); font-size: 13px; }
.alert-item { display: flex; background: var(--bg-2); border-radius: var(--r-md); overflow: hidden; }
.alert-side { width: 4px; flex-shrink: 0; }
.alert-side.level-critical { background: var(--danger); }
.alert-side.level-error { background: var(--danger); opacity: 0.6; }
.alert-side.level-warn { background: var(--warning); }
.alert-content { padding: 10px 12px; flex: 1; }
.alert-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
.level-tag { font-size: 10px; font-weight: 800; }
.level-critical { color: var(--danger); }
.level-error { color: var(--danger); opacity: 0.8; }
.level-warn { color: var(--warning); }
.alert-msg { font-size: 12px; color: var(--text-2); }

.spinning { animation: spin 800ms linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.pulse { animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.2); } 100% { opacity:1; transform:scale(1); } }
</style>
