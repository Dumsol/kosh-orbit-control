<template>
  <div class="redis-page">
    <!-- Resource Monitor -->
    <div class="resource-row">
      <div class="card card-sm flex-1">
        <label class="section-label">Memory</label>
        <div class="gauge-container">
          <div class="gauge-placeholder">
            <Zap :size="28" class="text-copper" />
            <div class="gauge-text">
              <span class="stat-value">{{ memUsed }}</span>
              <p class="text-3 text-xs">Redis allocation</p>
            </div>
          </div>
          <div class="gauge-bar"><div class="fill" :style="{ width: memPct + '%' }" /></div>
        </div>
      </div>
      <div class="card card-sm stats-grid">
        <div class="stat-item">
          <span class="text-3">Total Keys</span>
          <span class="stat-value small">{{ totalKeys.toLocaleString() }}</span>
        </div>
        <div class="stat-item">
          <span class="text-3">Ops/sec</span>
          <span class="stat-value small text-copper">{{ liveOps }}</span>
        </div>
        <div class="stat-item">
          <span class="text-3">Hit Rate</span>
          <span class="stat-value small text-success">{{ hitRate }}%</span>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="content-area">
      <nav class="tab-header card card-sm p-0 mb-4">
        <button @click="activeTab = 'keys'"    :class="{ active: activeTab === 'keys' }">Key Browser</button>
        <button @click="activeTab = 'bullmq'"  :class="{ active: activeTab === 'bullmq' }">BullMQ Queues</button>
        <button @click="activeTab = 'monitor'" :class="{ active: activeTab === 'monitor' }" @click.once="startMonitor">Live Monitor</button>
      </nav>

      <div class="tab-content card">
        <!-- Keys Tab -->
        <div v-if="activeTab === 'keys'" class="keys-tab">
          <div class="filter-actions mb-4">
            <div class="search-input">
              <Search :size="14" />
              <input
                v-model="keyPattern" type="text"
                placeholder="Pattern (e.g. deploy_key:* or bull:*)"
                class="input input-sm flex-1"
                @keyup.enter="fetchKeys"
              />
            </div>
            <button class="btn btn-sm btn-ghost" @click="fetchKeys">Scan</button>
          </div>
          <div class="key-grid" v-if="keyList.length">
            <div class="key-list-sidebar card card-sm">
              <div
                v-for="k in keyList" :key="k.key"
                class="key-item"
                :class="{ selected: selectedKey?.key === k.key }"
                @click="selectKey(k)"
              >
                <span class="badge badge-info text-xs">{{ k.type }}</span>
                <span class="mono text-2 text-xs">{{ k.key.slice(0, 32) }}{{ k.key.length > 32 ? '…' : '' }}</span>
              </div>
            </div>
            <div class="key-editor flex-1 p-4 bg-dark rounded" v-if="selectedKey">
              <div class="editor-header">
                <span class="text-3 text-xs">{{ selectedKey.key }}</span>
                <div class="actions">
                  <button class="btn btn-xs btn-danger" @click="deleteKey(selectedKey.key)">Delete</button>
                </div>
              </div>
              <div class="editor-body mt-4">
                <label class="section-label">Type: {{ selectedKey.type }} | TTL: {{ selectedKey.ttl === -1 ? 'no expiry' : selectedKey.ttl + 's' }}</label>
              </div>
            </div>
            <div class="key-editor flex-1 p-4 bg-dark rounded flex-center text-4" v-else>
              Select a key to inspect
            </div>
          </div>
          <div v-else class="empty-state">No keys found. Try a different pattern.</div>
        </div>

        <!-- BullMQ Tab -->
        <div v-if="activeTab === 'bullmq'" class="bullmq-tab">
          <div v-if="queuesLoading" class="empty-state">Loading queues...</div>
          <div v-else-if="!selectedQueue" class="queue-list">
            <div v-if="!queues.length" class="empty-state col-span-2">No BullMQ queues found in Redis.</div>
            <div
              v-for="q in queues" :key="q.name"
              class="card card-sm queue-card cursor-pointer"
              @click="openQueue(q.name)"
            >
              <div class="queue-info">
                <span class="font-bold text-copper">{{ q.name }}</span>
                <div class="queue-badges">
                  <span class="badge badge-success" title="Completed">{{ q.completed }}</span>
                  <span class="badge badge-warn" title="Waiting">{{ q.waiting }}</span>
                  <span class="badge badge-danger" title="Failed">{{ q.failed }}</span>
                </div>
              </div>
              <div class="queue-meta text-xs text-3 mt-2">
                {{ q.active }} active · {{ q.waiting }} waiting · {{ q.failed }} failed
              </div>
              <div class="queue-actions mt-3">
                <button class="btn btn-xs btn-ghost text-copper" @click.stop="openQueue(q.name)">View Jobs</button>
                <button class="btn btn-xs btn-ghost text-danger" @click.stop="purge(q.name)">Purge</button>
              </div>
            </div>
          </div>

          <!-- Jobs drill-down -->
          <div v-else class="jobs-view">
            <div class="jobs-header mb-4">
              <button class="btn btn-xs btn-ghost mr-2" @click="selectedQueue = null">← Back</button>
              <span class="text-3 font-bold">Queue: <span class="text-copper">{{ selectedQueue }}</span></span>
              <button class="btn btn-xs btn-ghost ml-auto" @click="fetchFailedJobs">Refresh</button>
            </div>
            <div v-if="!failedJobs.length" class="empty-state">No failed jobs.</div>
            <table v-else class="table">
              <thead><tr><th>Job ID</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="j in failedJobs" :key="j.id">
                  <td class="mono text-xs">#{{ j.id }}</td>
                  <td>{{ j.name || j.data?.event_type || '—' }}</td>
                  <td><span class="badge badge-danger">Failed</span></td>
                  <td class="actions">
                    <button class="btn btn-xs btn-primary mr-1" @click="retryJob(j.id)">Retry</button>
                    <button class="btn btn-xs btn-danger" @click="deleteJob(j.id)">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Live Monitor Tab -->
        <div v-if="activeTab === 'monitor'" class="monitor-tab">
          <div class="monitor-controls mb-3">
            <span class="text-3 text-xs">Live stream — subscribes to <code class="mono">kosh:logs:critical</code> + Redis stats</span>
            <button class="btn btn-xs btn-ghost ml-auto" @click="clearMonitor">Clear</button>
          </div>
          <div class="terminal-body mono p-4 rounded bg-black" ref="terminalRef">
            <div v-if="!monitorLines.length" class="mon-line text-4">Connecting to monitor stream...</div>
            <div v-for="(line, i) in monitorLines" :key="i" class="mon-line">
              <span class="text-4">[{{ line.ts }}]</span>
              <span v-if="line.type === 'log'" :class="line.level === 'CRITICAL' ? 'text-danger' : 'text-warn'"> {{ line.level }}</span>
              <span v-if="line.type === 'log'" class="text-copper"> {{ line.service }}</span>
              <span v-if="line.type === 'log'" class="text-3"> {{ line.message }}</span>
              <span v-if="line.type === 'stats'" class="text-success"> ops={{ line.ops_per_sec }}/s  hits={{ line.keyspace_hits }}  misses={{ line.keyspace_misses }}</span>
            </div>
            <div class="mon-line pulse text-4">_</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Zap, Search } from 'lucide-vue-next'
import axios from 'axios'

const activeTab    = ref('bullmq')
const keyPattern   = ref('*')
const keyList      = ref<any[]>([])
const selectedKey  = ref<any>(null)
const totalKeys    = ref(0)
const memUsed      = ref('—')
const memPct       = ref(0)
const liveOps      = ref(0)
const hitRate      = ref(99.0)

const queues        = ref<any[]>([])
const queuesLoading = ref(false)
const selectedQueue = ref<string|null>(null)
const failedJobs    = ref<any[]>([])

const monitorLines  = ref<any[]>([])
const terminalRef   = ref<HTMLElement>()
let   monitorSSE: EventSource | null = null

// ── Stats ─────────────────────────────────────────────────────
const fetchStats = async () => {
  try {
    const res = await axios.get('/api/redis-keys?pattern=*&limit=1')
    totalKeys.value = res.data.total || 0
    memUsed.value   = res.data.memory_used || '—'
    const mem = parseFloat(memUsed.value) || 0
    memPct.value    = Math.min(100, (mem / 150) * 100)
  } catch {}
}

// ── Keys ──────────────────────────────────────────────────────
const fetchKeys = async () => {
  try {
    const res = await axios.get(`/api/redis-keys?pattern=${encodeURIComponent(keyPattern.value)}&limit=100`)
    keyList.value = res.data.keys || []
    totalKeys.value = res.data.total || 0
  } catch {}
}

const selectKey = (k: any) => { selectedKey.value = k }

const deleteKey = async (key: string) => {
  if (!confirm(`Delete key: ${key}?`)) return
  await axios.delete(`/api/redis-keys/${encodeURIComponent(key)}`)
  keyList.value = keyList.value.filter(k => k.key !== key)
  selectedKey.value = null
}

// ── BullMQ ────────────────────────────────────────────────────
const fetchQueues = async () => {
  queuesLoading.value = true
  try {
    const res = await axios.get('/api/redis-keys/queues')
    queues.value = res.data || []
  } finally {
    queuesLoading.value = false
  }
}

const openQueue = async (name: string) => {
  selectedQueue.value = name
  await fetchFailedJobs()
}

const fetchFailedJobs = async () => {
  if (!selectedQueue.value) return
  try {
    const res = await axios.get(`/api/redis-keys/queues/${selectedQueue.value}/failed`)
    failedJobs.value = res.data || []
  } catch {}
}

const retryJob = async (jobId: string) => {
  await axios.post(`/api/redis-keys/queues/${selectedQueue.value}/retry/${jobId}`)
  await fetchFailedJobs()
}

const deleteJob = async (jobId: string) => {
  if (!confirm('Delete this job?')) return
  await axios.delete(`/api/redis-keys/queues/${selectedQueue.value}/failed/${jobId}`)
  await fetchFailedJobs()
}

const purge = async (name: string) => {
  if (!confirm(`Purge all jobs in queue: ${name}?`)) return
  await axios.delete(`/api/redis-keys/queues/${name}/purge`)
  await fetchQueues()
}

// ── Live Monitor SSE ──────────────────────────────────────────
const startMonitor = () => {
  if (monitorSSE) return
  const token = localStorage.getItem('kosh_token') || ''
  // SSE doesn't support headers — use query param
  const url = `/api/redis-keys/monitor?token=${encodeURIComponent(token)}`
  monitorSSE = new EventSource(url)
  monitorSSE.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      const ts = new Date(data.ts).toLocaleTimeString('pt-BR')
      monitorLines.value.push({ ...data, ts })
      if (monitorLines.value.length > 200) monitorLines.value.shift()
      // Update live stats from stats events
      if (data.type === 'stats') {
        liveOps.value = data.ops_per_sec
        const h = data.keyspace_hits, m = data.keyspace_misses
        hitRate.value = h + m > 0 ? Math.round((h / (h + m)) * 1000) / 10 : 99.0
      }
      // Auto-scroll
      setTimeout(() => {
        if (terminalRef.value) terminalRef.value.scrollTop = terminalRef.value.scrollHeight
      }, 50)
    } catch {}
  }
  monitorSSE.onerror = () => {}
}

const clearMonitor = () => { monitorLines.value = [] }

onMounted(() => {
  fetchStats()
  fetchQueues()
})

onUnmounted(() => {
  if (monitorSSE) { monitorSSE.close(); monitorSSE = null }
})
</script>

<style scoped>
.redis-page { display: flex; flex-direction: column; gap: 20px; }

.resource-row { display: flex; gap: 20px; }
.gauge-container { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
.gauge-placeholder { display: flex; align-items: center; gap: 16px; }
.gauge-bar { height: 6px; background: var(--bg-2); border-radius: 3px; overflow: hidden; }
.gauge-bar .fill { height: 100%; background: var(--copper); box-shadow: 0 0 8px var(--copper); transition: width 0.3s; }

.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; min-width: 360px; }
.stat-item { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.stat-value.small { font-size: 16px; font-weight: 700; margin-top: 4px; }

.tab-header { display: flex; background: var(--bg-1); border-radius: var(--r-md); overflow: hidden; }
.tab-header button { flex: 1; padding: 12px; border: none; background: transparent; color: var(--text-3); font-weight: 500; font-size: 12px; cursor: pointer; }
.tab-header button.active { background: var(--bg-2); color: var(--text-1); box-shadow: inset 0 -2px 0 var(--copper); }

.filter-actions { display: flex; gap: 12px; }
.search-input { display: flex; align-items: center; background: var(--bg-2); border: 1px solid var(--border-mid); padding: 0 12px; border-radius: var(--r-sm); flex: 1; gap: 8px; }

.key-grid { display: flex; gap: 16px; height: 380px; }
.key-list-sidebar { width: 280px; overflow-y: auto; background: var(--bg-1); }
.key-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); cursor: pointer; font-size: 12px; }
.key-item:hover, .key-item.selected { background: var(--bg-2); }
.editor-header { display: flex; justify-content: space-between; align-items: center; }
.bg-dark { background: #0d0d0f; }
.flex-center { display: flex; align-items: center; justify-content: center; color: var(--text-4); font-style: italic; }

.queue-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.col-span-2 { grid-column: span 2; }
.queue-card { border-left: 3px solid var(--copper); cursor: pointer; }
.queue-card:hover { transform: translateY(-1px); }
.queue-info { display: flex; justify-content: space-between; align-items: flex-start; }
.queue-badges { display: flex; gap: 5px; }
.queue-meta { }
.jobs-header { display: flex; align-items: center; }
.empty-state { display: flex; align-items: center; justify-content: center; min-height: 80px; color: var(--text-4); font-style: italic; }

.monitor-controls { display: flex; align-items: center; gap: 10px; }
.terminal-body { min-height: 320px; max-height: 480px; overflow-y: auto; background: #000; }
.mon-line { font-size: 12px; margin-bottom: 3px; line-height: 1.6; }
.pulse { animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0; } }

.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.ml-auto { margin-left: auto; }
.ml-2 { margin-left: 8px; }
.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }
code { background: var(--bg-2); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
.text-warn { color: var(--warning); }
.badge-warn { background: #fef3c7; color: #d97706; }
</style>
