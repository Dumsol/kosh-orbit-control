<template>
  <div class="support-page">
    <div class="support-header">
      <div class="header-info">
        <span class="dot dot-online mr-2"></span>
        <span class="font-medium text-1">Peppermint - Help Desk</span>
        <span class="text-3 text-xs ml-3 mono">{{ selectedProject }}</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-sm btn-ghost" @click="fetchStats" :disabled="loading">
          <RefreshCw :size="13" :class="{ spinning: loading }" />
        </button>
        <a
          :href="peppermintUrl"
          target="_blank"
          class="btn btn-sm btn-ghost"
        >
          <ExternalLink :size="13" /> Open in New Tab
        </a>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stats-card">
        <span class="label">Open</span>
        <span class="value text-warn">{{ stats.open }}</span>
      </div>
      <div class="stats-card">
        <span class="label">Pending</span>
        <span class="value text-copper">{{ stats.pending }}</span>
      </div>
      <div class="stats-card">
        <span class="label">Closed</span>
        <span class="value text-success">{{ stats.closed }}</span>
      </div>
      <div class="stats-card">
        <span class="label">Total</span>
        <span class="value">{{ stats.total }}</span>
      </div>
      <div class="stats-meta text-4 text-xs">
        Ultima atualizacao: {{ stats.lastUpdate ? new Date(stats.lastUpdate).toLocaleString('pt-BR') : '-' }}
      </div>
    </div>

    <div class="iframe-wrap">
      <iframe
        :src="peppermintUrl"
        class="support-iframe"
        title="Peppermint Help Desk"
        allow="fullscreen"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import axios from 'axios'
import { ExternalLink, RefreshCw } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const selectedProject = computed(() => projectStore.selected)
const peppermintUrl = import.meta.env.VITE_PEPPERMINT_URL || 'https://support.example.com'

const loading = ref(false)
const stats = ref({
  total: 0,
  open: 0,
  pending: 0,
  closed: 0,
  lastUpdate: '',
})
let timer: any = null

const fetchStats = async () => {
  loading.value = true
  try {
    const { data } = await axios.get(`/api/support/stats?project=${selectedProject.value}`)
    stats.value = {
      total: Number(data.total || 0),
      open: Number(data.open || 0),
      pending: Number(data.pending || 0),
      closed: Number(data.closed || 0),
      lastUpdate: data.lastUpdate || '',
    }
  } catch {
    stats.value = { total: 0, open: 0, pending: 0, closed: 0, lastUpdate: '' }
  } finally {
    loading.value = false
  }
}

watch(selectedProject, () => {
  fetchStats()
})

onMounted(async () => {
  await projectStore.fetchProjects()
  await fetchStats()
  timer = setInterval(fetchStats, 30000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<style scoped>
.support-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 86px);
  gap: 0;
}
.support-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md) var(--r-md) 0 0;
  border-bottom: 2px solid var(--copper-border);
}
.header-actions { display: flex; align-items: center; gap: 8px; }
.header-info { display: flex; align-items: center; }
.mr-2 { margin-right: 8px; }
.ml-3 { margin-left: 12px; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 10px 0;
}

.stats-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--bg-1);
}

.label {
  font-size: 11px;
  color: var(--text-3);
  text-transform: uppercase;
}

.value {
  font-size: 20px;
  line-height: 1;
  font-weight: 700;
}

.stats-meta {
  grid-column: 1 / -1;
  padding-left: 4px;
}

.iframe-wrap {
  flex: 1;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  overflow: hidden;
}
.support-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.spinning { animation: spin 600ms linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
