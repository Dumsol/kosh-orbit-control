<template>
  <div class="crm-page">
    <div class="crm-header">
      <div class="header-left">
        <span :class="['dot', crmOnline ? 'dot-online' : 'dot-warn']"></span>
        <span class="font-medium text-1">SuiteCRM Workspace</span>
        <span class="text-3 text-xs mono">{{ selectedProject }}</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-sm btn-ghost" @click="checkService" :disabled="loading">
          <RefreshCw :size="13" :class="{ spinning: loading }" />
        </button>
        <a :href="suitecrmUrl" target="_blank" class="btn btn-sm btn-ghost">
          <ExternalLink :size="13" /> Open in New Tab
        </a>
      </div>
    </div>

    <div class="crm-hint card card-sm">
      <span class="text-3 text-xs">
        If initial setup is pending, run bootstrap once and then reload this page.
      </span>
    </div>

    <div class="iframe-wrap">
      <iframe
        :src="suitecrmUrl"
        class="crm-iframe"
        title="SuiteCRM"
        allow="fullscreen"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { ExternalLink, RefreshCw } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const selectedProject = computed(() => projectStore.selected)
const suitecrmUrl = import.meta.env.VITE_SUITECRM_URL || '/crm-app/'

const crmOnline = ref(false)
const loading = ref(false)

const checkService = async () => {
  loading.value = true
  try {
    const { data } = await axios.get(`/api/services?project=${selectedProject.value}`)
    crmOnline.value = data?.cloudRun?.suitecrm?.status === 'online'
  } catch {
    crmOnline.value = false
  } finally {
    loading.value = false
  }
}

watch(selectedProject, () => {
  checkService()
})

onMounted(async () => {
  await projectStore.fetchProjects()
  checkService()
})
</script>

<style scoped>
.crm-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 86px);
  gap: 10px;
}

.crm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  border-bottom: 2px solid var(--copper-border);
}

.header-left,
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.crm-hint {
  border-left: 3px solid var(--copper-border);
}

.iframe-wrap {
  flex: 1;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--bg-2);
}

.crm-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.spinning { animation: spin 600ms linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
