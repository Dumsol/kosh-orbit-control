<template>
  <div class="kosh-support-button" @click="toggleModal">
    <button class="support-btn" :class="{ open: isOpen }" aria-label="Abrir suporte">
      <svg v-if="!isOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span v-else style="font-size: 20px">×</span>
    </button>
    <SupportModal v-if="isOpen" @close="closeModal" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SupportModal from './SupportModal.vue'

const isOpen = ref(false)

const toggleModal = () => {
  isOpen.value = !isOpen.value
}

const closeModal = () => {
  isOpen.value = false
}
</script>

<style scoped>
.kosh-support-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.support-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #b87333 0%, #d4a574 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(184, 115, 51, 0.3);
  transition: all 0.3s ease;
}

.support-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(184, 115, 51, 0.4);
}

.support-btn.open {
  background: linear-gradient(135deg, #d4a574 0%, #b87333 100%);
}
</style>
