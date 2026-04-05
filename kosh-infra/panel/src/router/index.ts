import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login',     name: 'Login',    component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/',          name: 'Overview', component: () => import('@/views/OverviewView.vue') },
  { path: '/logs',      name: 'Logs',     component: () => import('@/views/LogsView.vue') },
  { path: '/analytics', name: 'Analytics',component: () => import('@/views/AnalyticsView.vue') },
  { path: '/postgres',  name: 'Postgres', component: () => import('@/views/PostgresView.vue') },
  { path: '/redis',     name: 'Redis',    component: () => import('@/views/RedisView.vue') },
  { path: '/email',     name: 'Email',    component: () => import('@/views/EmailView.vue') },
  { path: '/workers',   name: 'Workers',  component: () => import('@/views/WorkersView.vue') },
  { path: '/costs',     name: 'Costs',    component: () => import('@/views/CostsView.vue') },
  { path: '/crm',       name: 'CRM',      component: () => import('@/views/CRMView.vue') },
  { path: '/support',   name: 'Support',  component: () => import('@/views/SupportView.vue') },
  { path: '/settings',  name: 'Settings', component: () => import('@/views/SettingsView.vue') },
  { path: '/credentials', name: 'Credentials', component: () => import('@/views/CredentialsView.vue') },
  { path: '/integrations', name: 'Integrations', component: () => import('@/views/IntegrationsView.vue') },
]

const router = createRouter({
  history: createWebHistory('/'),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isLoggedIn) return '/login'
})

export default router
