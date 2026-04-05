<template>
  <div class="layout-wrapper" v-if="auth.isLoggedIn">
    <SidebarNav />
    <div class="main-content">
      <TopHeader />
      <main class="page-body">
        <router-view />
      </main>
    </div>
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import SidebarNav from './components/SidebarNav.vue'
import TopHeader from './components/TopHeader.vue'

const auth = useAuthStore()

onMounted(() => {
  // Para fins de teste inicial, podemos injetar um token se quisermos
  // auth.setToken('dev-token')
})
</script>

<style>
.layout-wrapper {
  display: flex;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  margin-left: 240px; /* Largura da Sidebar */
  display: flex;
  flex-direction: column;
}

.page-body {
  padding: 30px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}
</style>
