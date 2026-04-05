import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import './styles/base.css'

// Set axios auth header from stored token (persists across page reloads)
const storedToken = localStorage.getItem('kosh_token')
if (storedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
}

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
