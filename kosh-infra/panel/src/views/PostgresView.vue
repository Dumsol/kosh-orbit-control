<template>
  <div class="postgres-page">
    <!-- Top: DB Selector -->
    <div class="db-selector scroll-x">
      <button 
        v-for="db in databases" :key="db"
        :class="['db-tab', { 'active': activeDb === db }]"
        @click="activeDb = db"
      >
        <Database :size="14" />
        {{ db }}
      </button>
    </div>

    <div class="main-layout">
      <!-- Left: Table Browser -->
      <aside class="table-sidebar card card-sm">
        <label class="section-label">Tables ({{ tables.length }})</label>
        <div class="table-list">
          <div 
            v-for="t in tables" :key="t.name"
            :class="['table-item', { 'active': selectedTable === t.name }]"
            @click="selectedTable = t.name"
          >
            <span class="mono">{{ t.name }}</span>
            <span class="row-count text-3">{{ t.rows }}</span>
          </div>
        </div>
      </aside>

      <!-- Right: Main Area -->
      <div class="content-area flex-1">
        <div class="tab-header card card-sm p-0">
          <button @click="activeTab = 'browse'" :class="{ active: activeTab === 'browse' }">Browse Data</button>
          <button @click="activeTab = 'query'" :class="{ active: activeTab === 'query' }">SQL Query</button>
          <button @click="activeTab = 'stats'" :class="{ active: activeTab === 'stats' }">Stats & Health</button>
        </div>

        <div class="tab-content card">
          <!-- Browse Tab -->
          <div v-if="activeTab === 'browse'" class="browse-tab">
            <div class="table-actions">
                <span class="text-3 font-medium">Viewing table: <span class="text-copper">{{ selectedTable }}</span></span>
                <input type="text" placeholder="Filter column..." class="input input-sm w-48" />
            </div>
            <div class="data-table-wrapper">
                <table class="table">
                    <thead>
                        <tr>
                            <th v-for="col in 5" :key="col">Column_{{ col }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in 6" :key="row">
                            <td v-for="col in 5" :key="col" class="text-3 mono">data_{{ row }}_{{ col }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
          </div>

          <div v-if="activeTab === 'query'" class="query-tab">
            <div class="editor-container mono" ref="editorContainer">
                <!-- CodeMirror Editor will mount here -->
            </div>
                <pre class="code-preview">
<span class="text-copper">SELECT</span> * <span class="text-copper">FROM</span> {{ selectedTable }}
<span class="text-copper">WHERE</span> created_at > <span class="text-success">'2026-03-30'</span>
<span class="text-copper">LIMIT</span> 50;</pre>
            <div class="query-footer">
                <button class="btn btn-primary btn-sm" @click="runQuery">
                    <Play :size="14" /> Run Query (Ctrl+Enter)
                </button>
            </div>
          </div>

          <!-- Stats Tab -->
          <div v-if="activeTab === 'stats'" class="stats-tab grid-stats">
              <div class="stat-box">
                  <label class="section-label">Active Connections</label>
                  <div class="stat-value">12 / 100</div>
              </div>
              <div class="stat-box">
                  <label class="section-label">Slow Queries (24h)</label>
                  <div class="stat-value text-warn">2</div>
              </div>
              <div class="stat-box">
                  <label class="section-label">Index Size</label>
                  <div class="stat-value">4.2 GB</div>
              </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <footer class="footer">
      <div class="text-4">Last automatic backup: 2h ago</div>
      <button class="btn btn-sm btn-ghost" @click="triggerBackup">
        <HardDriveDownload :size="14" />
        Backup Now
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { Database, Play, HardDriveDownload } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'

// CodeMirror imports
import { EditorView, basicSetup } from 'codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'

const activeDb = ref('logs_db')
const activeTab = ref('browse')
const selectedTable = ref('logs')
const editorContainer = ref<HTMLElement | null>(null)
let editor: EditorView | null = null

const databases = ['logs_db', 'metrics_db', 'peppermint_db', 'bot_config', 'auth_db']

const tables = ref([
  { name: 'logs', rows: '1.4M' },
  { name: 'webhooks_raw', rows: '850K' },
  { name: 'errors', rows: '12K' },
  { name: 'ingest_queue', rows: '0' },
  { name: 'users', rows: '5.2K' },
  { name: 'transactions', rows: '42K' },
])

onMounted(() => {
  if (editorContainer.value) {
    editor = new EditorView({
      doc: `SELECT * FROM public.${selectedTable.value}\nWHERE created_at > '2026-03-30'\nORDER BY created_at DESC\nLIMIT 50;`,
      extensions: [
        basicSetup,
        sql(),
        oneDark,
        EditorView.lineWrapping
      ],
      parent: editorContainer.value
    })
  }
})

// Sincroniza o editor quando trocar de aba ou tabela (opcional)
watch(selectedTable, (newTable) => {
  if (editor && activeTab.value === 'query') {
      // Pequeno hack para atualizar o doc sem recriar o editor
      const transaction = editor.state.update({
          changes: { from: 0, to: editor.state.doc.length, insert: `SELECT * FROM public.${newTable}\nLIMIT 50;` }
      })
      editor.dispatch(transaction)
  }
})

const runQuery = () => {
    const query = editor?.state.doc.toString()
    console.log('Executing:', query)
    alert('Query triggered for ' + activeDb.value)
}

const triggerBackup = () => {
    alert('Backup process started!')
}
</script>

<style scoped>
.postgres-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.db-selector {
  display: flex;
  gap: 8px;
  padding-bottom: 8px;
}

.db-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  color: var(--text-2);
  cursor: pointer;
  white-space: nowrap;
}

.db-tab.active {
  background: var(--bg-2);
  border-color: var(--copper);
  color: var(--text-1);
}

.main-layout {
  display: flex;
  gap: 20px;
}

.table-sidebar {
  width: 240px;
  max-height: calc(100vh - 250px);
  overflow-y: auto;
}

.table-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
}

.table-item:hover { background: var(--bg-2); }
.table-item.active { background: var(--copper-glow); color: var(--copper-light); }

.tab-header {
  display: flex;
  background: var(--bg-1);
  margin-bottom: 12px;
  border-radius: var(--r-md);
  overflow: hidden;
}

.tab-header button {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-weight: 500;
  font-size: 12px;
  cursor: pointer;
}

.tab-header button.active {
  background: var(--bg-2);
  color: var(--text-1);
  box-shadow: inset 0 -2px 0 var(--copper);
}

.tab-content {
  min-height: 300px;
}

.table-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.editor-container {
    background: #0d0d0f;
    padding: 20px;
    border-radius: var(--r-md);
    border: 1px solid var(--border-mid);
    min-height: 200px;
    margin-bottom: 16px;
}

.code-preview {
    font-size: 14px;
    line-height: 1.6;
}

.grid-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}

.stat-box {
    background: var(--bg-2);
    padding: 16px;
    border-radius: var(--r-md);
    text-align: center;
}

.stat-value {
    font-size: 20px;
    font-weight: 700;
    margin-top: 8px;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.text-warn { color: var(--warning); }
.w-48 { width: 12rem; }
</style>
