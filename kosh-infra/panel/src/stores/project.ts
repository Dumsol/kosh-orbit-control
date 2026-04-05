import { defineStore } from 'pinia'
import axios from 'axios'

type ProjectOption = {
  slug: string
  name: string
}

const FALLBACK_PROJECTS: ProjectOption[] = [
  { slug: 'kosh', name: 'Kosh' },
  { slug: 'nakta', name: 'Nakta' },
  { slug: 'csp', name: 'CSP' },
  { slug: 'opemly', name: 'Opemly' },
]

export const useProjectStore = defineStore('project', {
  state: () => ({
    selected: localStorage.getItem('kosh_project') || 'kosh',
    projects: FALLBACK_PROJECTS as ProjectOption[],
    loading: false,
  }),
  getters: {
    projectOptions: (state) => state.projects,
  },
  actions: {
    setProject(slug: string) {
      this.selected = slug
      localStorage.setItem('kosh_project', slug)
    },
    async fetchProjects() {
      this.loading = true
      try {
        const { data } = await axios.get('/api/auth/projects')
        const list = Array.isArray(data)
          ? data
              .map((item: any) => ({
                slug: String(item.slug || item.project_slug || '').trim(),
                name: String(item.name || item.slug || item.project_slug || '').trim(),
              }))
              .filter((p: ProjectOption) => !!p.slug)
          : []

        this.projects = list.length ? list : FALLBACK_PROJECTS
      } catch {
        this.projects = FALLBACK_PROJECTS
      } finally {
        if (!this.projects.find((p) => p.slug === this.selected)) {
          this.setProject(this.projects[0]?.slug || 'kosh')
        }
        this.loading = false
      }
    },
  },
})
