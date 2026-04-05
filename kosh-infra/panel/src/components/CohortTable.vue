<!-- CohortTable.vue -->
<!-- Recebe: rows: Array<{cohort_month, months_after, retention_rate, cohort_size}> -->
<!-- Renderiza heat-map: vermelho=0%, verde=100% -->
<template>
  <div class="cohort-wrapper card">
    <p class="section-label">Retenção de Cohort — {{ projectSlug }}</p>
    <div style="overflow-x:auto">
      <table class="table cohort-table">
        <thead>
          <tr>
            <th>Cohort</th>
            <th v-for="m in maxMonths" :key="m">M+{{ m }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, cohort) in cohortMap" :key="cohort">
            <td class="mono font-bold">{{ cohort }}</td>
            <td v-for="m in maxMonths" :key="m"
              :style="cellStyle(row[m])"
              :title="`${row[m]?.retained ?? '—'} / ${row[m]?.cohort_size ?? '—'} clientes`"
              class="cohort-cell">
              {{ row[m] ? `${row[m].retention_rate}%` : '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ rows: any[], projectSlug: string }>()

const cohortMap = computed(() => {
  const map: Record<string, Record<number, any>> = {}
  for (const r of props.rows) {
    const k = r.cohort_month.slice(0,7)
    if (!map[k]) map[k] = {}
    map[k][r.months_after] = r
  }
  return map
})

const maxMonths = computed(() => {
  let max = 0
  for (const rows of Object.values(cohortMap.value))
    max = Math.max(max, ...Object.keys(rows).map(Number))
  return Array.from({ length: max + 1 }, (_, i) => i)
})

const cellStyle = (r: any) => {
  if (!r) return { background: 'transparent', color: 'var(--text-3)' }
  const pct = parseFloat(r.retention_rate) / 100
  // Interpolação: 0%=vermelho, 50%=copper, 100%=verde
  // hsl(0, ...) é vermelho, hsl(120, ...) é verde
  const h = Math.round(pct * 120) // hue: 0=red, 120=green
  return {
    background: `hsl(${h}, 55%, 20%)`,
    color: `hsl(${h}, 80%, 72%)`,
    border: '1px solid rgba(255,255,255,0.05)'
  }
}
</script>

<style scoped>
.cohort-wrapper {
  padding: 20px;
}
.cohort-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
}
.cohort-cell {
  width: 60px;
  min-width: 60px;
  height: 40px;
  font-family: var(--mono);
  font-size: 11px;
  text-align: center;
  border-radius: 2px;
  transition: transform 0.1s;
}
.cohort-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}
.cohort-table th {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-3);
    padding: 8px;
}
</style>
