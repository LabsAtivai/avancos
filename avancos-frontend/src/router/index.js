import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/',         redirect: '/avancos' },
  { path: '/avancos',  component: () => import('@/views/AvancosView.vue'),  name: 'avancos' },
  { path: '/import',   component: () => import('@/views/ImportView.vue'),   name: 'import' },
  { path: '/graficos',  component: () => import('@/views/GraficosView.vue'),  name: 'graficos' },
  { path: '/relatorio',   component: () => import('@/views/RelatorioView.vue'),   name: 'relatorio' },
  { path: '/sdr',         component: () => import('@/views/SdrView.vue'),         name: 'sdr' },
  { path: '/credenciais',  component: () => import('@/views/CredenciaisView.vue'), name: 'credenciais' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
