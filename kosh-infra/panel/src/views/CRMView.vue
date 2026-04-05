<template>
  <div class="crm-page">
    <div class="coming-soon card">
      <div class="cs-icon">
        <Users :size="40" class="text-copper" />
      </div>
      <h2 class="cs-title">SuiteCRM - Em Breve</h2>
      <p class="cs-desc">
        O CRM completo da plataforma Kosh esta sendo configurado.<br>
        SuiteCRM sera implantado como um servico Cloud Run dedicado com PostgreSQL.
      </p>

      <div class="cs-steps">
        <div class="step done">
          <div class="step-dot"><Check :size="12" /></div>
          <div class="step-info">
            <span class="step-label">Banco de dados pronto</span>
            <span class="step-sub">PostgreSQL 15 - via Secret Manager</span>
          </div>
        </div>
        <div class="step pending-step">
          <div class="step-dot pending-dot"><Clock :size="12" /></div>
          <div class="step-info">
            <span class="step-label">Deploy SuiteCRM (Cloud Run)</span>
            <span class="step-sub">bitnami/suitecrm - 1Gi RAM - southamerica-east1</span>
          </div>
        </div>
        <div class="step pending-step">
          <div class="step-dot pending-dot"><Clock :size="12" /></div>
          <div class="step-info">
            <span class="step-label">Configuracao de usuarios e pipelines</span>
            <span class="step-sub">Integracao com Integration Bus e Ingest API</span>
          </div>
        </div>
      </div>

      <div class="cs-cmd card card-sm mt-6">
        <span class="section-label mb-2 block">Para fazer o deploy agora:</span>
        <pre class="mono text-xs text-3">gcloud run deploy suitecrm \
  --image=bitnami/suitecrm \
  --memory=1Gi --region=southamerica-east1 \
  --set-secrets=KOSH_CONFIG=KOSH_CONFIG:latest</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users, Check, Clock } from 'lucide-vue-next'
</script>

<style scoped>
.crm-page { display: flex; align-items: center; justify-content: center; min-height: 60vh; }

.coming-soon {
  max-width: 520px; width: 100%; padding: 40px;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  border: 1px solid var(--copper-border); background: var(--copper-glow);
}

.cs-icon { margin-bottom: 16px; }
.cs-title { font-size: 20px; font-weight: 700; color: var(--text-1); margin-bottom: 10px; }
.cs-desc { color: var(--text-3); font-size: 14px; line-height: 1.6; margin-bottom: 24px; }

.cs-steps { width: 100%; display: flex; flex-direction: column; gap: 12px; text-align: left; }
.step { display: flex; align-items: center; gap: 14px; }
.step-dot {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--success); color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.pending-dot { background: var(--bg-3); color: var(--text-3); }
.step-info { display: flex; flex-direction: column; gap: 2px; }
.step-label { font-size: 13px; font-weight: 600; color: var(--text-1); }
.step-sub { font-size: 11px; color: var(--text-3); }
.step.done .step-label { color: var(--success); }
.step.pending-step .step-label { color: var(--text-2); }

.cs-cmd { text-align: left; width: 100%; }
.cs-cmd pre { margin: 0; padding: 10px; background: #0d0d0f; border-radius: var(--r-sm); color: #e8e8e8; white-space: pre-wrap; }
.mt-6 { margin-top: 24px; }
.mb-2 { margin-bottom: 8px; }
</style>
