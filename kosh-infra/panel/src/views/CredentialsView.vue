<template>
  <div class="credentials-page">
    <header class="page-header">
      <h1 class="text-1">Infrastructure Access</h1>
      <p class="text-3">Connection URLs and REST API Tokens for external integrations.</p>
    </header>

    <div class="credentials-grid" v-if="access">
      <!-- Redis Card -->
      <div class="card card-copper">
        <div class="card-header">
          <div class="service-icon redis-bg"><Zap :size="18" /></div>
          <div>
            <h3 class="text-1">{{ access.redis.name }}</h3>
            <span class="badge badge-copper">Upstash compatible</span>
          </div>
        </div>
        <div class="card-body">
          <div class="field">
            <label>REST URL</label>
            <div class="input-group">
              <input :value="access.redis.rest_url" readonly class="input-flat" />
              <button class="btn-copy" @click="copy(access.redis.rest_url)"><Copy :size="14" /></button>
            </div>
          </div>
          <div class="field">
            <label>REST Token</label>
            <div class="input-group">
              <input :type="shown.redis ? 'text' : 'password'" :value="access.redis.token" readonly class="input-flat" />
              <button class="btn-toggle" @click="shown.redis = !shown.redis">
                <EyeOff v-if="shown.redis" :size="14" />
                <Eye v-else :size="14" />
              </button>
              <button class="btn-copy" @click="copy(access.redis.token)"><Copy :size="14" /></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Postgres Card -->
      <div class="card card-copper">
        <div class="card-header">
          <div class="service-icon pg-bg"><Database :size="18" /></div>
          <div>
            <h3 class="text-1">{{ access.postgres.name }}</h3>
            <span class="badge badge-success">Neon compatible</span>
          </div>
        </div>
        <div class="card-body">
          <div class="field">
            <label>REST URL (Data API)</label>
            <div class="input-group">
              <input :value="access.postgres.rest_url" readonly class="input-flat" />
              <button class="btn-copy" @click="copy(access.postgres.rest_url)"><Copy :size="14" /></button>
            </div>
          </div>
          <div class="field">
            <label>API Token</label>
            <div class="input-group">
              <input :type="shown.pg ? 'text' : 'password'" :value="access.postgres.token" readonly class="input-flat" />
              <button class="btn-toggle" @click="shown.pg = !shown.pg">
                <EyeOff v-if="shown.pg" :size="14" />
                <Eye v-else :size="14" />
              </button>
              <button class="btn-copy" @click="copy(access.postgres.token)"><Copy :size="14" /></button>
            </div>
          </div>
          <div class="field mt-2">
            <label>Connection String</label>
            <div class="input-group">
              <input :type="shown.pgStr ? 'text' : 'password'" :value="access.postgres.connection_string" readonly class="input-flat text-xs" />
              <button class="btn-toggle" @click="shown.pgStr = !shown.pgStr">
                <EyeOff v-if="shown.pgStr" :size="14" />
                <Eye v-else :size="14" />
              </button>
              <button class="btn-copy" @click="copy(access.postgres.connection_string)"><Copy :size="14" /></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Ingest Card -->
      <div class="card card-copper">
        <div class="card-header">
          <div class="service-icon ingest-bg"><Terminal :size="18" /></div>
          <div>
            <h3 class="text-1">{{ access.ingest.name }}</h3>
            <span class="badge badge-info">Ingestion Only</span>
          </div>
        </div>
        <div class="card-body">
          <div class="field">
            <label>Ingest URL</label>
            <div class="input-group">
              <input :value="access.ingest.url" readonly class="input-flat" />
              <button class="btn-copy" @click="copy(access.ingest.url)"><Copy :size="14" /></button>
            </div>
          </div>
          <div class="field">
            <label>Ingest Token</label>
            <div class="input-group">
              <input :type="shown.ingest ? 'text' : 'password'" :value="access.ingest.token" readonly class="input-flat" />
              <button class="btn-toggle" @click="shown.ingest = !shown.ingest">
                <EyeOff v-if="shown.ingest" :size="14" />
                <Eye v-else :size="14" />
              </button>
              <button class="btn-copy" @click="copy(access.ingest.token)"><Copy :size="14" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="loading-state card">
        <div class="skeleton-text">Loading access credentials...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Zap, Database, Terminal, Copy, Eye, EyeOff } from 'lucide-vue-next'
import axios from 'axios'

const access = ref<any>(null)
const shown = ref({
  redis: false,
  pg: false,
  pgStr: false,
  ingest: false
})

const fetchAccess = async () => {
  try {
    const { data } = await axios.get('/api/access')
    access.value = data
  } catch (e) {
    console.error('Failed to fetch credentials', e)
  }
}

const copy = (text: string) => {
  navigator.clipboard.writeText(text)
  // TODO: Add toast notification
  alert('Copied to clipboard!')
}

onMounted(fetchAccess)
</script>

<style scoped>
.credentials-page { display: flex; flex-direction: column; gap: 24px; }
.page-header h1 { font-size: 24px; font-weight: 700; }
.page-header p { font-size: 14px; margin-top: 4px; }

.credentials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.card-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.card-header h3 { font-size: 16px; font-weight: 700; margin-bottom: 2px; }

.service-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.redis-bg { background: #dc2626; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2); }
.pg-bg { background: #336791; box-shadow: 0 4px 12px rgba(51, 103, 145, 0.2); }
.ingest-bg { background: #b87333; box-shadow: 0 4px 12px rgba(184, 115, 51, 0.2); }

.field { margin-bottom: 12px; }
.field label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }

.input-group {
  display: flex;
  background: var(--bg-2);
  border: 1px solid var(--border-mid);
  border-radius: var(--r-sm);
  overflow: hidden;
}

.input-flat {
  flex: 1;
  background: transparent;
  border: none;
  padding: 8px 12px;
  color: var(--text-1);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  outline: none;
}

.btn-copy, .btn-toggle {
  background: transparent;
  border: none;
  border-left: 1px solid var(--border-mid);
  padding: 0 10px;
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy:hover, .btn-toggle:hover {
  background: var(--bg-3);
  color: var(--copper);
}

.card-copper {
    border: 1px solid var(--copper-border);
    transition: transform 0.2s;
}
.card-copper:hover { transform: translateY(-2px); }

.loading-state { padding: 40px; text-align: center; }
</style>
