import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('kosh_token') || null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    setToken(token: string) {
      this.token = token
      localStorage.setItem('kosh_token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    },
    logout() {
      this.token = null
      localStorage.removeItem('kosh_token')
      delete axios.defaults.headers.common['Authorization']
    }
  }
})
