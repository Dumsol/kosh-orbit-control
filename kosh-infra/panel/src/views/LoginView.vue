<template>
  <div class="login-wrapper">
    <div class="card card-copper login-card">
      <div class="header">
        <div class="dot dot-copper"></div>
        <h1>KOSH ADMIN</h1>
        <p>Enter your secret to access Iowa Node.</p>
      </div>

      <div class="form-group">
        <label class="section-label">Panel Secret</label>
        <input 
          type="password" 
          v-model="secret" 
          class="input" 
          placeholder="••••••••••••"
          @keyup.enter="handleLogin"
        />
      </div>

      <button @click="handleLogin" class="btn btn-primary w-full">
        <span>Enter Dashboard</span>
      </button>
      
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const secret = ref('')
const error = ref('')
const router = useRouter()
const auth = useAuthStore()

const handleLogin = () => {
  if (secret.value.length > 3) {
    auth.setToken(secret.value)
    router.push('/')
  } else {
    error.value = 'Invalid secret key.'
  }
}
</script>

<style scoped>
.login-wrapper {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-0);
}

.login-card {
  width: 360px;
  padding: 40px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h1 {
  font-size: 18px;
  margin-top: 12px;
}

.header p {
  color: var(--text-3);
  font-size: 12px;
}

.form-group {
  margin-bottom: 24px;
}

.w-full {
  width: 100%;
  justify-content: center;
  margin-top: 20px;
}

.error {
  color: var(--danger);
  font-size: 11px;
  text-align: center;
  margin-top: 12px;
}
</style>
