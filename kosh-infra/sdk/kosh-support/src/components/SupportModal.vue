<template>
  <div class="support-modal-overlay" @click.self="$emit('close')">
    <div class="support-modal">
      <div class="modal-header">
        <h2>Suporte Kosh</h2>
        <button class="close-btn" @click="$emit('close')" aria-label="Fechar">×</button>
      </div>
      <div class="modal-content">
        <div class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab"
            class="tab-btn"
            :class="{ active: activeTab === tab }"
            @click="activeTab = tab"
          >
            {{ tab === 'quick' ? '⚡ Rápido' : '📨 Ticket' }}
          </button>
        </div>

        <div v-if="activeTab === 'quick'" class="tab-content">
          <div class="quick-links">
            <button class="quick-link" @click="sendMessage('Preciso de ajuda com...')">
              <span>❓</span> Fazer pergunta
            </button>
            <button class="quick-link" @click="sendMessage('Encontrei um bug:')">
              <span>🐛</span> Reportar erro
            </button>
            <button class="quick-link" @click="sendMessage('Sugestão de feature:')">
              <span>💡</span> Sugestão
            </button>
          </div>
        </div>

        <div v-else class="tab-content">
          <form @submit.prevent="submitTicket">
            <div class="form-group">
              <label>Email</label>
              <input v-model="ticket.email" type="email" placeholder="seu@email.com" required />
            </div>
            <div class="form-group">
              <label>Assunto</label>
              <input v-model="ticket.subject" type="text" placeholder="Qual é o problema?" required />
            </div>
            <div class="form-group">
              <label>Mensagem</label>
              <textarea v-model="ticket.message" placeholder="Descreva em detalhes..." rows="4" required></textarea>
            </div>
            <button type="submit" class="submit-btn" :disabled="loading">
              {{ loading ? 'Enviando...' : 'Enviar Ticket' }}
            </button>
          </form>
          <div v-if="success" class="success-msg">✓ Ticket enviado com sucesso!</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineEmits<{ close: [] }>()

const tabs = ref(['quick', 'ticket'])
const activeTab = ref('quick')
const loading = ref(false)
const success = ref(false)

const ticket = ref({
  email: '',
  subject: '',
  message: '',
})

const sendMessage = (msg: string) => {
  ticket.value.message = msg
  activeTab.value = 'ticket'
}

const submitTicket = async () => {
  loading.value = true
  try {
    await fetch('/api/support/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticket.value),
    })
    success.value = true
    setTimeout(() => {
      ticket.value = { email: '', subject: '', message: '' }
      success.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to submit ticket:', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.support-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  z-index: 9998;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.support-modal {
  width: 100%;
  max-width: 400px;
  height: 600px;
  background: white;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #111;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  gap: 0;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #999;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn.active {
  color: #b87333;
  border-bottom-color: #b87333;
  font-weight: 600;
}

.tab-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.quick-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-link {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  font-size: 14px;
}

.quick-link:hover {
  background: #f3f4f6;
  border-color: #b87333;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #111;
  margin-bottom: 4px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #b87333;
  box-shadow: 0 0 0 3px rgba(184, 115, 51, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 10px;
  margin-top: 12px;
  background: linear-gradient(135deg, #b87333 0%, #d4a574 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(184, 115, 51, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-msg {
  padding: 12px;
  background: #dcfce7;
  color: #166534;
  border-radius: 6px;
  text-align: center;
  font-size: 14px;
  margin-top: 12px;
}
</style>
