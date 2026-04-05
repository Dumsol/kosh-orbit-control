<template>
  <aside class="sidebar">
    <div class="logo">
      <div class="dot dot-copper"></div>
      <span class="logo-text">KOSH</span>
    </div>

    <nav class="nav-links">
      <router-link to="/" class="nav-item" active-class="active">
        <LayoutDashboard :size="18" />
        <span>Overview</span>
      </router-link>
      
      <div class="section-label">Observability</div>
      <router-link to="/logs" class="nav-item" active-class="active">
        <Terminal :size="18" />
        <span>Logs Monitor</span>
      </router-link>
      <router-link to="/analytics" class="nav-item" active-class="active">
        <BarChart3 :size="18" />
        <span>Analytics</span>
      </router-link>

      <div class="section-label">Infrastructure</div>
      <router-link to="/postgres" class="nav-item" active-class="active">
        <Database :size="18" />
        <span>Postgres Iowa</span>
      </router-link>
      <router-link to="/redis" class="nav-item" active-class="active">
        <Zap :size="18" />
        <span>Redis Cache</span>
      </router-link>
      <router-link to="/workers" class="nav-item" active-class="active">
        <Cpu :size="18" />
        <span>Worker Fleet</span>
      </router-link>
      <router-link to="/costs" class="nav-item" active-class="active">
        <Wallet :size="18" />
        <span>Budget Control</span>
      </router-link>

      <div class="section-label">Business</div>
      <router-link to="/crm" class="nav-item" active-class="active">
        <Users :size="18" />
        <span>CRM / Users</span>
      </router-link>
      <router-link to="/support" class="nav-item" active-class="active">
        <LifeBuoy :size="18" />
        <span>Support Hub</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <router-link to="/credentials" class="nav-item" active-class="active">
        <Key :size="18" />
        <span>Access Tokens</span>
      </router-link>
      <router-link to="/settings" class="nav-item" active-class="active">
        <Settings :size="18" />
        <span>Settings</span>
      </router-link>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { 
  LayoutDashboard, Terminal, BarChart3, 
  Database, Zap, Cpu, Users, LifeBuoy, Settings, Key, Wallet
} from 'lucide-vue-next'
</script>

<style scoped>
.sidebar {
  width: 240px;
  height: 100vh;
  background: var(--bg-1);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  position: fixed;
  left: 0;
  top: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px 30px;
}

.logo-text {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.1em;
  color: var(--text-1);
}

.nav-links {
  flex: 1;
  padding: 0 12px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  color: var(--text-2);
  text-decoration: none;
  border-radius: var(--r-md);
  margin-bottom: 4px;
  transition: all 150ms;
}

.nav-item:hover {
  background: var(--bg-2);
  color: var(--text-1);
}

.nav-item.active {
  background: var(--copper-glow);
  color: var(--copper-light);
  border-left: 3px solid var(--copper);
  border-radius: 0 var(--r-md) var(--r-md) 0;
}

.section-label {
  padding: 24px 12px 10px;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
}
</style>
