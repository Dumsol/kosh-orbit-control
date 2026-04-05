<template>
  <header class="top-header">
    <div class="search-bar">
      <Search :size="16" />
      <input type="text" placeholder="Search logs, users or configs..." class="search-input" />
    </div>

    <div class="status-group">
      <div class="project-picker">
        <label class="text-3 text-xs">Projeto</label>
        <select v-model="selectedProject" class="project-select">
          <option v-for="p in projectOptions" :key="p.slug" :value="p.slug">
            {{ p.name }}
          </option>
        </select>
      </div>
      <div class="status-item">
        <div class="dot dot-online"></div>
        <span>Iowa Node</span>
      </div>
      <div class="status-item">
        <div class="dot dot-warn"></div>
        <span>Alerts</span>
      </div>
    </div>

    <div class="profile">
      <div class="avatar">KD</div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Search } from 'lucide-vue-next'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()

const projectOptions = computed(() => projectStore.projectOptions)
const selectedProject = computed({
  get: () => projectStore.selected,
  set: (value: string) => projectStore.setProject(value),
})

onMounted(() => {
  projectStore.fetchProjects()
})
</script>

<style scoped>
.top-header {
  height: 60px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-2);
  border: 1px solid var(--border-mid);
  padding: 0 12px;
  border-radius: var(--r-md);
  width: 300px;
}

.search-input {
  background: transparent;
  border: none;
  padding: 8px;
  color: var(--text-1);
  font-size: 13px;
  outline: none;
  width: 100%;
}

.status-group {
  display: flex;
  align-items: center;
  gap: 24px;
}

.project-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-select {
  height: 34px;
  background: var(--bg-2);
  border: 1px solid var(--border-mid);
  color: var(--text-1);
  border-radius: var(--r-sm);
  padding: 0 10px;
  font-size: 12px;
  min-width: 140px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-2);
}

.avatar {
  width: 32px;
  height: 32px;
  background: var(--copper);
  color: var(--white);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 12px;
}
</style>
