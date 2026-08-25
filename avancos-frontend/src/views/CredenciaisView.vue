<template>
  <div class="page">
    <div class="page-header">
      <div>
        <div class="page-title">Credenciais</div>
        <div class="page-sub">Contas Gmail e Snov.io por cliente</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer;
                      background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:6px 12px">
          <input type="checkbox" v-model="mostrarTudo" />
          Mostrar credenciais
        </label>
        <button class="btn btn-primary" @click="abrirModal(null)">+ Nova credencial</button>
      </div>
    </div>

    <!-- Loading / empty -->
    <div v-if="carregando" class="loading" style="padding:40px"><div class="spinner"></div></div>
    <div v-else-if="!dados.length" class="card">
      <div class="empty" style="padding:48px">
        <div class="empty-icon">🔑</div>
        <div class="empty-text">Nenhuma credencial cadastrada</div>
        <button class="btn btn-primary" style="margin-top:12px" @click="abrirModal(null)">
          Adicionar primeira credencial
        </button>
      </div>
    </div>

    <!-- Cards de credenciais -->
    <div v-else class="cred-grid">
      <div v-for="c in dados" :key="c.id" class="cred-card" :class="{ inativo: !c.ativo }">

        <!-- Header do card -->
        <div class="cred-card-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="cred-avatar">{{ c.cliente.slice(0,2).toUpperCase() }}</div>
            <div>
              <div class="cred-nome">{{ c.cliente }}</div>
              <div class="cred-email-sub">{{ c.emailClient }}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span :class="c.ativo ? 'status-ativo' : 'status-inativo'">
              {{ c.ativo ? 'Ativo' : 'Inativo' }}
            </span>
            <button class="icon-btn" @click="abrirModal(c)" title="Editar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="icon-btn danger" @click="confirmarExcluir(c)" title="Excluir">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Seção Gmail / OAuth2 -->
        <div class="cred-section">
          <div class="cred-section-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Gmail / OAuth2
          </div>
          <div class="cred-fields">
            <div class="cred-field">
              <div class="cred-field-label">Client ID</div>
              <div class="cred-field-value mono">
                {{ mostrarTudo ? c.clientId : mascararMeio(c.clientId) }}
                <button class="copy-btn" @click="copiar(c.clientId)" title="Copiar">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
            <div class="cred-field">
              <div class="cred-field-label">Client Secret</div>
              <div class="cred-field-value mono">
                {{ mostrarTudo ? (c.clientSecret || '••• não carregado') : '••••••••••••••••' }}
                <button v-if="mostrarTudo && c.clientSecret" class="copy-btn" @click="copiar(c.clientSecret)" title="Copiar">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção Snov.io -->
        <div class="cred-section">
          <div class="cred-section-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Snov.io
          </div>
          <div class="cred-fields">
            <div class="cred-field">
              <div class="cred-field-label">Email</div>
              <div class="cred-field-value">
                {{ c.snovEmail }}
                <button class="copy-btn" @click="copiar(c.snovEmail)" title="Copiar">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
            <div class="cred-field">
              <div class="cred-field-label">Senha</div>
              <div class="cred-field-value mono">
                {{ mostrarTudo ? (c.snovSenha || '••• não carregado') : '••••••••' }}
                <button v-if="mostrarTudo && c.snovSenha" class="copy-btn" @click="copiar(c.snovSenha)" title="Copiar">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Toast copiado -->
    <div v-if="copiado" class="toast">✓ Copiado!</div>

    <!-- Modal criar/editar -->
    <div v-if="modalAberto" class="modal-overlay" @click.self="fecharModal">
      <div class="modal" style="max-width:560px">
        <div class="modal-header">
          <h2>{{ editando ? 'Editar credencial' : 'Nova credencial' }}</h2>
          <button class="modal-close" @click="fecharModal">×</button>
        </div>
        <div class="modal-body">

          <div class="form-group">
            <label class="form-label">Cliente *
              <span style="color:var(--muted);font-weight:400;font-size:12px"> — igual ao nome em Avanços</span>
            </label>
            <input v-model="form.cliente" class="form-control" placeholder="Ex: AKSUM" list="clientes-cred" />
            <datalist id="clientes-cred">
              <option v-for="c in clientesExistentes" :key="c" :value="c" />
            </datalist>
          </div>

          <div class="form-section">
            <div class="form-section-title gmail">✉ Gmail / OAuth2</div>
            <div class="form-group">
              <label class="form-label">Email Client *</label>
              <input v-model="form.emailClient" class="form-control" type="email" placeholder="cliente.ativa@gmail.com" />
            </div>
            <div class="form-row cols-2">
              <div class="form-group" style="margin:0">
                <label class="form-label">Client ID *</label>
                <div style="position:relative">
                  <input v-model="form.clientId" class="form-control"
                         :type="verClientId ? 'text' : 'password'"
                         placeholder="bc57c0befa493c0c2e..."
                         style="font-family:monospace;font-size:12px;padding-right:32px" />
                  <button class="eye-btn" @click="verClientId = !verClientId">{{ verClientId ? '🙈' : '👁' }}</button>
                </div>
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">
                  Client Secret {{ editando ? '(deixe vazio para não alterar)' : '*' }}
                </label>
                <div style="position:relative">
                  <input v-model="form.clientSecret" class="form-control"
                         :type="verSecret ? 'text' : 'password'"
                         placeholder="a8896fa7de8528..."
                         style="font-family:monospace;font-size:12px;padding-right:32px" />
                  <button class="eye-btn" @click="verSecret = !verSecret">{{ verSecret ? '🙈' : '👁' }}</button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title snov">⬡ Snov.io</div>
            <div class="form-row cols-2">
              <div class="form-group" style="margin:0">
                <label class="form-label">Email *</label>
                <input v-model="form.snovEmail" class="form-control" type="email" placeholder="cliente@ativa.ai" />
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">
                  Senha {{ editando ? '(deixe vazio para não alterar)' : '*' }}
                </label>
                <div style="position:relative">
                  <input v-model="form.snovSenha" class="form-control"
                         :type="verSenha ? 'text' : 'password'"
                         placeholder="••••••••"
                         style="padding-right:32px" />
                  <button class="eye-btn" @click="verSenha = !verSenha">{{ verSenha ? '🙈' : '👁' }}</button>
                </div>
              </div>
            </div>
          </div>

          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-top:4px">
            <input type="checkbox" v-model="form.ativo" />
            Credencial ativa
          </label>

          <div v-if="erro" class="alert alert-danger" style="margin-top:14px">{{ erro }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="fecharModal">Cancelar</button>
          <button class="btn btn-primary" :disabled="salvando" @click="salvar">
            {{ salvando ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmar exclusão -->
    <div v-if="excluindo" class="modal-overlay" @click.self="excluindo = null">
      <div class="modal" style="max-width:380px">
        <div class="modal-header"><h2>Excluir credencial</h2></div>
        <div class="modal-body">
          <p>Excluir as credenciais de <strong>{{ excluindo.cliente }}</strong>?</p>
          <p style="margin-top:8px;color:var(--muted);font-size:12px">Esta ação não pode ser desfeita.</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="excluindo = null">Cancelar</button>
          <button class="btn btn-danger" :disabled="excluindoId" @click="executarExcluir">
            {{ excluindoId ? 'Excluindo...' : 'Excluir' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api, { avancosApi } from '@/services/api'

const dados            = ref([])
const carregando       = ref(false)
const modalAberto      = ref(false)
const editando         = ref(null)
const excluindo        = ref(null)
const excluindoId      = ref(false)
const salvando         = ref(false)
const erro             = ref('')
const mostrarTudo      = ref(false)
const copiado          = ref(false)
const clientesExistentes = ref([])

// Toggles por campo no modal
const verClientId = ref(false)
const verSecret   = ref(false)
const verSenha    = ref(false)

const form = reactive({
  cliente: '', emailClient: '', clientId: '',
  clientSecret: '', snovEmail: '', snovSenha: '', ativo: true,
})

onMounted(async () => {
  await carregar()
  try {
    const r = await avancosApi.opcoes()
    clientesExistentes.value = (r.data.clientes || []).map(c => c.valor || c)
  } catch {}
})

async function carregar() {
  carregando.value = true
  try {
    // Busca com credenciais completas para exibição
    const r = await api.get('/credenciais?completo=true')
    dados.value = r.data
  } finally {
    carregando.value = false
  }
}

function abrirModal(c) {
  editando.value = c
  erro.value     = ''
  verClientId.value = false
  verSecret.value   = false
  verSenha.value    = false

  if (c) {
    Object.assign(form, {
      cliente:      c.cliente,
      emailClient:  c.emailClient,
      clientId:     c.clientId,
      clientSecret: '', // vazio — só preenche se quiser alterar
      snovEmail:    c.snovEmail,
      snovSenha:    '',
      ativo:        c.ativo,
    })
  } else {
    Object.assign(form, {
      cliente: '', emailClient: '', clientId: '',
      clientSecret: '', snovEmail: '', snovSenha: '', ativo: true,
    })
  }
  modalAberto.value = true
}

function fecharModal() { modalAberto.value = false }

async function salvar() {
  erro.value = ''
  if (!form.cliente || !form.emailClient || !form.clientId || !form.snovEmail) {
    erro.value = 'Preencha todos os campos obrigatórios'
    return
  }
  if (!editando.value && (!form.clientSecret || !form.snovSenha)) {
    erro.value = 'Client Secret e Senha Snov.io são obrigatórios no cadastro'
    return
  }

  salvando.value = true
  try {
    const payload = { ...form }
    if (editando.value) {
      if (!payload.clientSecret) delete payload.clientSecret
      if (!payload.snovSenha)    delete payload.snovSenha
      await api.put(`/credenciais/${editando.value.id}`, payload)
    } else {
      await api.post('/credenciais', payload)
    }
    fecharModal()
    await carregar()
  } catch (e) {
    erro.value = e.response?.data?.message || 'Erro ao salvar'
  } finally {
    salvando.value = false
  }
}

function confirmarExcluir(c) { excluindo.value = c }

async function executarExcluir() {
  excluindoId.value = true
  try {
    await api.delete(`/credenciais/${excluindo.value.id}`)
    excluindo.value = null
    await carregar()
  } finally {
    excluindoId.value = false
  }
}

function mascararMeio(s) {
  if (!s || s.length < 8) return s
  return s.slice(0, 6) + '•••••••' + s.slice(-4)
}

function copiar(texto) {
  navigator.clipboard.writeText(texto || '').then(() => {
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 1800)
  })
}
</script>

<style scoped>
.cred-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 16px;
}

.cred-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--border-radius-lg, 10px);
  overflow: hidden; transition: box-shadow .2s;
}
.cred-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
.cred-card.inativo { opacity: .6; }

.cred-card-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, var(--brand) 0%, #1565c0 100%);
}

.cred-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,.25); color: white;
  font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.cred-nome    { font-size: 14px; font-weight: 700; color: white; }
.cred-email-sub { font-size: 12px; color: rgba(255,255,255,.75); margin-top: 1px; }

.status-ativo   { font-size: 12px; font-weight: 600; background: rgba(255,255,255,.2); color: white; padding: 2px 8px; border-radius: 10px; }
.status-inativo { font-size: 12px; font-weight: 600; background: rgba(0,0,0,.2); color: rgba(255,255,255,.6); padding: 2px 8px; border-radius: 10px; }

.icon-btn {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(255,255,255,.15); border: none; cursor: pointer;
  color: white; display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.icon-btn:hover        { background: rgba(255,255,255,.3); }
.icon-btn.danger:hover { background: rgba(239,68,68,.4); }

.cred-section { padding: 12px 16px; border-bottom: 1px solid var(--border); }
.cred-section:last-child { border-bottom: none; }

.cred-section-title {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .06em; color: var(--muted);
  display: flex; align-items: center; gap: 5px; margin-bottom: 8px;
}

.cred-fields { display: flex; flex-direction: column; gap: 6px; }
.cred-field  { display: flex; align-items: baseline; gap: 8px; }
.cred-field-label {
  font-size: 12px; color: var(--muted); font-weight: 500;
  min-width: 80px; flex-shrink: 0;
}
.cred-field-value {
  font-size: 12px; color: var(--text); flex: 1;
  display: flex; align-items: center; gap: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cred-field-value.mono { font-family: monospace; font-size: 12px; }

.copy-btn {
  flex-shrink: 0; background: none; border: none; cursor: pointer;
  color: var(--muted); padding: 2px; border-radius: 4px;
  opacity: 0; transition: opacity .15s;
}
.cred-field:hover .copy-btn { opacity: 1; }
.copy-btn:hover { color: var(--brand); }

/* Modal */
.form-section {
  background: var(--bg); border-radius: var(--radius);
  padding: 14px; margin-bottom: 14px;
}
.form-section-title {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .05em; margin-bottom: 12px;
}
.form-section-title.gmail { color: var(--brand); }
.form-section-title.snov  { color: #5b4fcf; }

.eye-btn {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  font-size: 13px; line-height: 1;
}

/* Toast */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: #1e293b; color: white; font-size: 13px; font-weight: 500;
  padding: 8px 20px; border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,.2);
  animation: fadeInOut 1.8s ease forwards;
  z-index: 9999;
}
@keyframes fadeInOut {
  0%   { opacity: 0; transform: translateX(-50%) translateY(10px); }
  15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
  75%  { opacity: 1; }
  100% { opacity: 0; }
}
</style>
