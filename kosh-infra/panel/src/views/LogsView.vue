<template>
  <div class="logs-page">
    <!-- Filter Bar: ELK-style -->
    <div class="filter-bar card card-sm">
      <div class="filter-row">
        <select v-model="filters.project" class="select-clean">
          <option v-for="p in projects" :key="p.slug" :value="p.slug">{{ p.name }}</option>
        </select>
        <select v-model="filters.service" class="select-clean">
          <option value="">All Services</option>
          <option v-for="s in services" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="filters.level" class="select-clean">
          <option value="">All Levels</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warning</option>
          <option value="ERROR">Error</option>
          <option value="CRITICAL">Critical</option>
        </select>
        
        <div class="date-range">
          <input type="datetime-local" v-model="filters.from" class="input-clean" />
          <span class="text-3">to</span>
          <input type="datetime-local" v-model="filters.to" class="input-clean" />
        </div>

        <div class="search-box">
          <Search :size="14" class="text-3" />
          <input 
            type="text" 
            v-model="filters.q" 
            placeholder="Search full-text (message, event...)" 
            class="input-search"
            @keyup.enter="performSearch"
          />
        </div>

        <div class="actions">
          <button 
            :class="['btn-live', { active: isLive }]" 
            @click="toggleLive"
          >
            <div class="live-dot"></div> Live
          </button>
          <button class="btn btn-xs btn-ghost text-copper" @click="exportCSV">
            <Download :size="14" /> Export CSV
          </button>
        </div>
      </div>

      <!-- Sparkline Volume (24h) -->
      <div class="volume-sparkline">
        <div class="spark-label">
            <Activity :size="12" />
            <span>Volume (24h)</span>
        </div>
        <div class="chart-container">
          <Line :data="chartData" :options="chartOptions" height="40" />
        </div>
      </div>
    </div>

    <!-- Tabs Context -->
    <div class="tab-system mt-4">
      <nav class="nav-tabs">
        <button 
          v-for="t in ['stream', 'errors', 'traces']" 
          :key="t"
          :class="{ active: activeTab === t }"
          @click="activeTab = t"
        >
          {{ t.charAt(0).toUpperCase() + t.slice(1) }}
        </button>
      </nav>

      <div class="tab-body card">
        <!-- Stream Tab -->
        <div v-if="activeTab === 'stream'" class="stream-view">
          <div class="log-table">
            <div class="log-header text-3">
              <span class="col-ts">Timestamp</span>
              <span class="col-lvl">Level</span>
              <span class="col-svc">Service</span>
              <span class="col-evt">Event</span>
              <span class="col-msg">Message</span>
            </div>
            <div class="log-list mono">
              <div 
                v-for="log in visibleLogs" 
                :key="log.id" 
                :class="['log-row-container', { expanded: expandedLog === log.id }]"
              >
                <div class="log-row" @click="toggleExpand(log.id)">
                  <span class="col-ts">{{ formatTime(log.created_at) }}</span>
                  <span :class="['col-lvl', `lvl-${log.level.toLowerCase()}`]">
                    {{ log.level }}
                  </span>
                  <span class="col-svc">{{ log.service }}</span>
                  <span class="col-evt">{{ log.event }}</span>
                  <span class="col-msg">{{ log.message }}</span>
                </div>
                
                <!-- Expanded Details -->
                <div v-if="expandedLog === log.id" class="log-details">
                  <div class="details-grid">
                    <div class="detail-item">
                      <label>Trace ID</label>
                      <span class="text-copper cursor-pointer" @click="searchTrace(log.trace_id)">{{ log.trace_id }}</span>
                    </div>
                    <div class="detail-item">
                      <label>User</label>
                      <span>{{ log.user_id || 'system' }}</span>
                    </div>
                    <div class="detail-item">
                      <label>Duration</label>
                      <span>{{ log.duration_ms }}ms</span>
                    </div>
                    <div class="detail-item full">
                      <label>Metadata</label>
                      <pre>{{ JSON.stringify(log.metadata, null, 2) }}</pre>
                    </div>
                    <div v-if="log.stack_trace" class="detail-item full">
                      <label>Stack Trace</label>
                      <pre class="text-danger">{{ log.stack_trace }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Errors Grouped Tab -->
        <div v-if="activeTab === 'errors'" class="errors-view">
            <table class="table-clean">
                <thead>
                    <tr>
                        <th>Fingerprint (Event + Message)</th>
                        <th>Count</th>
                        <th>First</th>
                        <th>Last</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="err in groupedErrors" :key="err.fingerprint">
                        <td>
                            <div class="flex flex-col">
                                <span class="text-copper font-bold">{{ err.event }}</span>
                                <span class="text-2 text-xs truncate max-w-md">{{ err.message }}</span>
                            </div>
                        </td>
                        <td><span class="badge badge-danger">{{ err.count }}</span></td>
                        <td class="text-xs text-3">{{ formatTime(err.first) }}</td>
                        <td class="text-xs text-3">{{ formatTime(err.last) }}</td>
                        <td>
                            <button class="btn btn-xs btn-ghost text-copper" @click="viewAllErrorInstances(err.fingerprint)">View All</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Traces Tab -->
        <div v-if="activeTab === 'traces'" class="traces-view">
            <div class="trace-search mb-4">
                <input v-model="traceSearchId" placeholder="Paste trace_id here..." class="input input-sm flex-1" />
                <button class="btn btn-sm btn-primary" @click="performTraceSearch">Search Trace</button>
            </div>
            <div v-if="traceLogs.length" class="trace-timeline log-list mono">
                <div v-for="log in traceLogs" :key="log.id" class="log-row no-hover">
                   <span class="col-ts">{{ formatTime(log.created_at) }}</span>
                   <span class="col-msg">{{ log.message }}</span>
                </div>
            </div>
            <div v-else class="text-center py-8 text-3">No trace selected or found.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search, Download, Activity } from 'lucide-vue-next'
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

import axios from 'axios'
import { useProjectStore } from '@/stores/project'

// State
const activeTab = ref('stream')
const isLive = ref(true) 
const expandedLog = ref<number | null>(null)
const traceSearchId = ref('')
const sseSource = ref<EventSource | null>(null)
const projectStore = useProjectStore()

const filters = ref({
  project: projectStore.selected,
  service: '',
  level: '',
  from: '',
  to: '',
  q: ''
})

const logs = ref<any[]>([])
const traceLogs = ref<any[]>([])
const projects = computed(() => projectStore.projectOptions)
const services = ['api', 'worker', 'webhook', 'cron']

// Chart Data (Sparkline)
const chartData = computed(() => ({
  labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
  datasets: [{
    label: 'Logs/hr',
    data: [120, 150, 180, 140, 100, 80, 90, 110, 130, 160, 200, 250, 300, 280, 240, 220, 210, 190, 180, 170, 160, 150, 140, 130],
    borderColor: '#b87333',
    backgroundColor: 'rgba(184, 115, 51, 0.1)',
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.4,
    fill: true,
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: { 
    x: { display: false }, 
    y: { display: false } 
  }
}

// Grouped Errors Logic (Fingerprints)
const groupedErrors = computed(() => {
    const map = new Map();
    logs.value.filter(l => ['ERROR', 'CRITICAL'].includes(l.level)).forEach(l => {
        const key = `${l.event}:${l.message}`;
        if (!map.has(key)) {
            map.set(key, { 
                fingerprint: key,
                event: l.event, 
                message: l.message, 
                count: 0, 
                first: l.created_at, 
                last: l.created_at 
            });
        }
        const entry = map.get(key);
        entry.count++;
        if (new Date(l.created_at) < new Date(entry.first)) entry.first = l.created_at;
        if (new Date(l.created_at) > new Date(entry.last)) entry.last = l.created_at;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
})

const visibleLogs = computed(() => logs.value.slice(0, 1000))

// Methods
const formatTime = (ts: string) => {
    if (!ts) return ''
    try {
        const d = new Date(ts)
        return d.toLocaleTimeString('pt-BR', { hour12: false }) + '.' + d.getMilliseconds().toString().padStart(3, '0')
    } catch { return ts }
}

const toggleExpand = (id: number) => {
    expandedLog.value = expandedLog.value === id ? null : id
}

const toggleLive = () => {
    isLive.value = !isLive.value
    if (isLive.value) {
        startSSE()
    } else {
        stopSSE()
    }
}

const startSSE = () => {
    stopSSE()
    const query = new URLSearchParams(filters.value).toString()
    sseSource.value = new EventSource(`/api/logs/stream?${query}`)
    sseSource.value.onmessage = (e) => {
        const data = JSON.parse(e.data)
        logs.value = [...data, ...logs.value].slice(0, 1000)
    }
    sseSource.value.onerror = () => {
        console.error('SSE Connection failed.')
    }
}

const stopSSE = () => {
    if (sseSource.value) {
        sseSource.value.close()
        sseSource.value = null
    }
}

const performSearch = async () => {
    stopSSE()
    isLive.value = false
    try {
        const { data } = await axios.get('/api/logs', { params: filters.value })
        logs.value = data.logs
    } catch (e) {
        console.error('Search failed', e)
    }
}

const searchTrace = (id: string) => {
    traceSearchId.value = id
    activeTab.value = 'traces'
    performTraceSearch()
}

const performTraceSearch = async () => {
    if (!traceSearchId.value) return
    try {
        const { data } = await axios.get(`/api/logs/trace/${traceSearchId.value}`)
        traceLogs.value = data
    } catch (e) {
        console.error('Trace search failed', e)
    }
}

const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
        + ["Timestamp", "Level", "Service", "Event", "Message"].join(",") + "\n"
        + logs.value.map(l => [l.created_at, l.level, l.service, l.event, `"${(l.message||'').replace(/"/g, '""')}"`].join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kosh_logs_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const viewAllErrorInstances = (fp: string) => {
    const [event] = fp.split(':')
    filters.value.q = event
    activeTab.value = 'stream'
    performSearch()
}

watch(() => projectStore.selected, (project) => {
    if (filters.value.project === project) return
    filters.value.project = project
    if (isLive.value) startSSE()
    else performSearch()
})

watch(() => filters.value.project, (project) => {
    if (project && project !== projectStore.selected) {
        projectStore.setProject(project)
    }
})

onMounted(async () => {
    await projectStore.fetchProjects()
    filters.value.project = projectStore.selected
    if (isLive.value) startSSE()
})

onUnmounted(() => {
    stopSSE()
})
</script>

<style scoped>
.logs-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.select-clean, .input-clean, .input-search {
  background: var(--bg-2);
  border: 1px solid var(--border-mid);
  border-radius: var(--r-sm);
  color: var(--text-2);
  font-size: 11.5px;
  padding: 6px 10px;
  outline: none;
}

.select-clean:hover, .input-clean:hover { border-color: var(--copper-border); }

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-2);
  border: 1px solid var(--border-mid);
  border-radius: var(--r-sm);
  padding: 0 10px;
}

.input-search {
  border: none;
  background: transparent;
  flex: 1;
}

.btn-live {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-2);
  border: 1px solid var(--border-mid);
  color: var(--text-2);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-live.active {
  border-color: var(--success);
  color: var(--success);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
}

.btn-live.active .live-dot {
  background: var(--success);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

/* Sparkline */
.volume-sparkline {
    display: flex;
    align-items: center;
    gap: 20px;
    height: 40px;
    border-top: 1px solid var(--border-subtle);
    padding-top: 8px;
}

.spark-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-3);
    font-weight: 700;
    letter-spacing: 0.05em;
    min-width: 100px;
}

.chart-container {
    flex: 1;
    height: 100%;
}

/* Tabs */
.nav-tabs {
    display: flex;
    gap: 24px;
    border-bottom: 1px solid var(--border-mid);
    padding-bottom: 2px;
    margin-bottom: 16px;
}

.nav-tabs button {
    background: none;
    border: none;
    color: var(--text-3);
    font-size: 13px;
    font-weight: 600;
    padding-bottom: 8px;
    cursor: pointer;
    position: relative;
}

.nav-tabs button.active {
    color: var(--text-1);
}

.nav-tabs button.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--copper);
}

/* Stream Table */
.log-table {
    display: flex;
    flex-direction: column;
}

.log-header {
    display: flex;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-subtle);
}

.log-list {
    max-height: calc(100vh - 400px);
    overflow-y: auto;
}

.log-row-container {
    border-bottom: 1px solid var(--border-subtle);
}

.log-row {
    display: flex;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12.5px;
    transition: background 0.1s;
}

.log-row:hover { background: var(--bg-3); }

.col-ts { width: 100px; color: var(--text-4); flex-shrink: 0; }
.col-lvl { width: 80px; flex-shrink: 0; }
.col-svc { width: 120px; color: var(--copper-light); flex-shrink: 0; }
.col-evt { width: 150px; color: var(--text-2); flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; }
.col-msg { flex: 1; color: var(--text-1); }

.lvl-info { color: var(--success); }
.lvl-warn { color: var(--warning); }
.lvl-error, .lvl-critical { color: var(--danger); }

/* Details */
.log-details {
    background: #080705;
    padding: 16px;
    border-top: 1px dashed var(--border-mid);
}

.details-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.detail-item label {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 4px;
}

.detail-item span { font-size: 13px; color: var(--text-2); }
.detail-item pre {
    background: var(--bg-2);
    padding: 12px;
    border-radius: var(--r-sm);
    font-size: 12px;
    color: var(--muted-white);
    max-height: 200px;
    overflow: auto;
}

.full { grid-column: span 3; }

/* Table Clean */
.table-clean { width: 100%; border-collapse: collapse; }
.table-clean th { text-align: left; padding: 12px; font-size: 11px; color: var(--text-3); border-bottom: 1px solid var(--border-mid); }
.table-clean td { padding: 12px; border-bottom: 1px solid var(--border-subtle); }

.flex-col { display: flex; flex-direction: column; }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.max-w-md { max-width: 28rem; }
</style>
