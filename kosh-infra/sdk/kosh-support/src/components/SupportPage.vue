<template>
  <div class="support-page">
    <div class="support-container">
      <header class="support-header">
        <h1>🤝 Suporte Kosh</h1>
        <p>Estamos aqui para ajudar. Envie sua dúvida, sugestão ou reporte um problema.</p>
      </header>

      <div class="support-grid">
        <div class="support-card">
          <div class="card-icon">❓</div>
          <h3>Dúvidas</h3>
          <p>Não sabe como usar um recurso? Faça sua pergunta!</p>
          <button @click="scrollTo('form')">Perguntar</button>
        </div>

        <div class="support-card">
          <div class="card-icon">🐛</div>
          <h3>Relatar Bug</h3>
          <p>Encontrou um erro? Nos ajude a corrigir!</p>
          <button @click="scrollTo('form')">Reportar</button>
        </div>

        <div class="support-card">
          <div class="card-icon">💡</div>
          <h3>Sugestões</h3>
          <p>Tem uma ideia brilhante? Queremos ouvir!</p>
          <button @click="scrollTo('form')">Sugerir</button>
        </div>

        <div class="support-card">
          <div class="card-icon">📚</div>
          <h3>Documentação</h3>
          <p>Explore nossa base de conhecimento</p>
          <a href="https://docs.kosh.dev" target="_blank">Acessar Docs</a>
        </div>
      </div>

      <form ref="formEl" class="support-form" @submit.prevent="submitForm">
        <h2>Enviar Mensagem</h2>

        <div class="form-group">
          <label>Email *</label>
          <input
            v-model="form.email"
            type="email"
            placeholder="seu@email.com"
            required
          />
        </div>

        <div class="form-group">
          <label>Categoria *</label>
          <select v-model="form.category" required>
            <option value="">Selecione uma categoria</option>
            <option value="duvida">Dúvida</option>
            <option value="bug">Relatar Bug</option>
            <option value="sugestao">Sugestão</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div class="form-group">
          <label>Assunto *</label>
          <input
            v-model="form.subject"
            type="text"
            placeholder="Qual é o assunto?"
            required
          />
        </div>

        <div class="form-group">
          <label>Mensagem *</label>
          <textarea
            v-model="form.message"
            placeholder="Descreva em detalhes..."
            rows="6"
            required
          ></textarea>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? '⏳ Enviando...' : '📤 Enviar Mensagem' }}
        </button>

        <div v-if="success" class="success-msg">
          ✅ Sua mensagem foi enviada com sucesso! Em breve entraremos em contato.
        </div>
        <div v-if="error" class="error-msg">
          ❌ Erro ao enviar: {{ error }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const formEl = ref<HTMLFormElement | null>(null)
const loading = ref(false)
const success = ref(false)
const error = ref('')

const form = ref({
  email: '',
  category: '',
  subject: '',
  message: '',
})

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const submitForm = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/support/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })
    if (!response.ok) throw new Error('Erro ao enviar')
    success.value = true
    form.value = { email: '', category: '', subject: '', message: '' }
    setTimeout(() => { success.value = false }, 5000)
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.support-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  padding: 40px 20px;
}

.support-container {
  max-width: 1000px;
  margin: 0 auto;
}

.support-header {
  text-align: center;
  margin-bottom: 40px;
}

.support-header h1 {
  font-size: 32px;
  margin: 0 0 12px;
  color: #111;
}

.support-header p {
  font-size: 16px;
  color: #666;
  margin: 0;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.support-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.support-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
}

.card-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.support-card h3 {
  font-size: 18px;
  margin: 0 0 8px;
  color: #111;
}

.support-card p {
  font-size: 14px;
  color: #666;
  margin: 0 0 16px;
}

.support-card button,
.support-card a {
  display: inline-block;
  padding: 8px 16px;
  background: linear-gradient(135deg, #b87333 0%, #d4a574 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;
}

.support-card button:hover,
.support-card a:hover {
  transform: scale(1.05);
}

.support-form {
  background: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.support-form h2 {
  margin: 0 0 24px;
  font-size: 24px;
  color: #111;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 600;
  color: #111;
  margin-bottom: 8px;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #b87333;
  box-shadow: 0 0 0 3px rgba(184, 115, 51, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #b87333 0%, #d4a574 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(184, 115, 51, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-msg,
.error-msg {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  font-weight: 500;
}

.success-msg {
  background: #dcfce7;
  color: #166534;
}

.error-msg {
  background: #fee2e2;
  color: #991b1b;
}
</style>
