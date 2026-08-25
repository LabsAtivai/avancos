<template>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-brand">
    <span class="brand-name">Ativa<strong>.ai</strong></span>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/avancos"  class="nav-item" active-class="active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Avanços
        </router-link>
        <router-link to="/graficos" class="nav-item" active-class="active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Gráficos
        </router-link>
        <router-link to="/relatorio" class="nav-item" active-class="active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Gerar Relatório
        </router-link>
        <router-link to="/sdr" class="nav-item" active-class="active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          SDR Remoto
          <span v-if="followupBadge > 0" class="nav-badge">{{ followupBadge }}</span>
        </router-link>
        <router-link to="/credenciais" class="nav-item" active-class="active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Credenciais
        </router-link>
        <router-link to="/import"   class="nav-item" active-class="active">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Importar CSV
        </router-link>
      </nav>
    </aside>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app { display: flex; min-height: 100vh; }

.sidebar {
  width: 220px; flex-shrink: 0;
  background: #FFFFFF;
  display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; bottom: 0;
  border-right: 1px solid #EEEEEE;
  box-shadow: 2px 0 12px rgba(0,0,0,.15);
}

.sidebar-brand {
  padding: 20px 20px 16px;
  border-bottom: 1px solid #F0F0F0;
  display: flex; align-items: center; gap: 10px;
}
.brand-logo { width: 28px; height: 28px; object-fit: contain; }
.brand-name { color: #1A1210; font-size: 16px; font-weight: 400; letter-spacing: .02em; }
.brand-name strong { font-weight: 700; color: #1A1210; }

.sidebar-nav { padding: 12px 12px; display: flex; flex-direction: column; gap: 2px; flex: 1; }

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 6px;
  color: #555555; font-size: 13px; font-weight: 500;
  text-decoration: none; transition: all .15s;
}
.nav-item:hover  { background: #FFF3E0; color: #FF6B00; }
.nav-item.active {
  background: #FFF3E0; color: #FF6B00; font-weight: 600;
  border-left: 3px solid #FF6B00; padding-left: 9px;
}

.main { margin-left: 220px; flex: 1; min-height: 100vh; background: #111111; }
.nav-badge {
  background: #FF4D4D; color: var(--on-accent); font-size: 12px; font-weight: 700;
  padding: 1px 6px; border-radius: 10px; margin-left: auto;
}
</style>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '@/services/api'

const followupBadge = ref(0)

async function atualizarBadge() {
  const sdr = localStorage.getItem('sdr_ativo')
  if (!sdr) { followupBadge.value = 0; return }
  try {
    const r = await api.get('/avancos/followup-count', { params: { responsavel: sdr } })
    followupBadge.value = r.data.total || 0
  } catch {}
}

onMounted(() => {
  atualizarBadge()
  const t = setInterval(atualizarBadge, 60000)
  onUnmounted(() => clearInterval(t))
})
</script>
