<template>
  <div class="page">
    <div class="page-header">
      <div>
        <div class="page-title">SDR Remoto</div>
        <div class="page-sub">Acompanhamento de tratativas e follow-ups</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <!-- Seletor de SDR -->
        <div class="sdr-selector">
          <span style="font-size:12px;color:var(--muted)">Sou:</span>
          <button
            v-for="s in sdrs" :key="s"
            class="sdr-btn" :class="{ ativo: sdrAtivo === s }"
            @click="setSdr(s)"
          >{{ s }}</button>
          <button class="sdr-btn" :class="{ ativo: sdrAtivo === '' }" @click="setSdr('')">Todos</button>
        </div>
        <!-- Badge de follow-ups -->
        <div v-if="badge.total > 0" class="followup-badge" @click="filtrarFollowups" title="Ver follow-ups pendentes">
          <span>📅</span>
          <span v-if="badge.vencidos > 0" class="badge-vencido">{{ badge.vencidos }} vencido(s)</span>
          <span v-if="badge.hoje > 0" class="badge-hoje">{{ badge.hoje }} hoje</span>
        </div>
        <button class="btn btn-primary btn-sm" @click="abrirModal(null)">+ Novo avanço</button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card card-body" style="margin-bottom:16px">
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">

        <div class="form-group" style="margin:0;min-width:180px">
          <label class="form-label">Cliente</label>
          <input v-model="filtros.busca" class="form-control" placeholder="Buscar..." @input="onFiltro" />
        </div>

        <div class="form-group" style="margin:0;min-width:150px">
          <label class="form-label">Tipo de retorno</label>
          <select v-model="filtros.tipo" class="form-control" @change="onFiltro">
            <option value="">Todos</option>
            <option v-for="t in tipos" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="form-group" style="margin:0;min-width:160px">
          <label class="form-label">Follow-up</label>
          <select v-model="filtros.followupStatus" class="form-control" @change="onFiltro">
            <option value="">Todos</option>
            <option value="vencido">🔴 Vencidos</option>
            <option value="hoje">🟡 Hoje</option>
            <option value="pendente">🟢 Pendentes</option>
            <option value="sem">Sem follow-up</option>
          </select>
        </div>

        <div class="form-group" style="margin:0;min-width:140px">
          <label class="form-label">Período</label>
          <input v-model="filtros.dataInicio" type="date" class="form-control" @change="onFiltro" />
        </div>
        <div class="form-group" style="margin:0;min-width:140px">
          <label class="form-label">&nbsp;</label>
          <input v-model="filtros.dataFim" type="date" class="form-control" @change="onFiltro" />
        </div>

        <button class="btn btn-ghost btn-sm" @click="limparFiltros" style="margin-bottom:1px">Limpar</button>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card">
      <div v-if="carregando" class="loading" style="padding:40px"><div class="spinner"></div></div>
      <div v-else-if="!dados.length" class="empty">
        <div class="empty-icon">📋</div>
        <div class="empty-text">Nenhum avanço encontrado</div>
      </div>
      <div v-else style="overflow-x:auto">
        <table class="sdr-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Nome / Empresa</th>
              <th>Cargo / Setor</th>
              <th>Tipo</th>
              <th>Follow-up</th>
              <th>Tratativa</th>
              <th>Responsável</th>
              <th style="width:60px"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in dados" :key="a.id"
              :class="statusFollowup(a.dataFollowup)"
            >
              <!-- Cliente -->
              <td>
                <div class="td-main">{{ a.cliente }}</div>
                <div class="td-sub">{{ fdata(a.dataAvanco) }}</div>
              </td>

              <!-- Nome / Empresa -->
              <td>
                <div class="td-main">{{ a.nomeLead || '—' }}</div>
                <div class="td-sub">{{ a.empresa || '—' }}</div>
              </td>

              <!-- Cargo / Setor -->
              <td>
                <div class="td-main">{{ a.cargo || '—' }}</div>
                <div class="td-sub">{{ a.segmento || '—' }}</div>
              </td>

              <!-- Tipo -->
              <td>
                <span :class="'badge badge-' + tipoClass(a.tipo)">{{ a.tipo }}</span>
              </td>

              <!-- Follow-up — editável inline -->
              <td @click.stop>
                <div class="followup-cell">
                  <input
                    type="datetime-local"
                    class="followup-input"
                    :class="statusFollowup(a.dataFollowup)"
                    :value="toDatetimeLocal(a.dataFollowup)"
                    @change="salvarFollowup(a, $event.target.value)"
                    :title="a.dataFollowup ? 'Follow-up: ' + fdatetime(a.dataFollowup) : 'Sem follow-up'"
                  />
                  <button v-if="a.dataFollowup" class="clear-btn"
                          @click="salvarFollowup(a, '')" title="Remover follow-up">×</button>
                </div>
              </td>

              <!-- Tratativa — editável inline -->
              <td @click.stop class="tratativa-td">
                <textarea
                  class="tratativa-input"
                  :value="a.tratativa || ''"
                  :placeholder="'Anotação...'"
                  rows="2"
                  @blur="salvarTratativa(a, $event.target.value)"
                  @keydown.ctrl.enter="salvarTratativa(a, $event.target.value)"
                ></textarea>
              </td>

              <!-- Responsável -->
              <td>
                <span class="responsavel-chip">{{ a.responsavel || '—' }}</span>
              </td>

              <!-- Ações -->
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" @click="abrirModal(a)" title="Editar">✏️</button>
                  <button class="btn btn-ghost btn-sm" @click="confirmarExcluir(a)" title="Excluir">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Paginação -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border)">
          <span style="font-size:12px;color:var(--muted)">{{ total }} registros</span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" :disabled="pagina <= 1" @click="if(pagina>1){pagina--;carregar()}">‹</button>
            <span style="font-size:12px;padding:4px 8px">{{ pagina }} / {{ totalPaginas }}</span>
            <button class="btn btn-ghost btn-sm" :disabled="pagina >= totalPaginas" @click="if(pagina<totalPaginas){pagina++;carregar()}">›</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal criar/editar -->
    <div v-if="modalAberto" class="modal-overlay" @click.self="fecharModal">
      <div class="modal" style="max-width:640px">
        <div class="modal-header">
          <h2>{{ editando ? 'Editar avanço' : 'Novo avanço SDR' }}</h2>
          <button class="modal-close" @click="fecharModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Cliente *</label>
              <input v-model="form.cliente" class="form-control" list="cl-sdr" />
              <datalist id="cl-sdr">
                <option v-for="c in opcoes.clientes" :key="c.valor" :value="c.valor" />
              </datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo *</label>
              <select v-model="form.tipo" class="form-control">
                <option v-for="t in tipos" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Nome do lead</label>
              <input v-model="form.nomeLead" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Empresa</label>
              <input v-model="form.empresa" class="form-control" />
            </div>
          </div>
          <div class="form-row cols-3">
            <div class="form-group">
              <label class="form-label">Cargo</label>
              <input v-model="form.cargo" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Setor</label>
              <input v-model="form.segmento" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Porte</label>
              <select v-model="form.porte" class="form-control">
                <option value="">—</option>
                <option>Micro</option><option>Pequena</option>
                <option>Média</option><option>Grande</option>
              </select>
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Fonte</label>
              <input v-model="form.campanha" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">Responsável (SDR)</label>
              <select v-model="form.responsavel" class="form-control">
                <option value="">—</option>
                <option v-for="s in sdrs" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>
          <div class="form-row cols-2">
            <div class="form-group">
              <label class="form-label">Data do avanço *</label>
              <input v-model="form.dataAvanco" type="date" class="form-control" />
            </div>
            <div class="form-group">
              <label class="form-label">📅 Follow-up (data + hora)</label>
              <input v-model="form.dataFollowup" type="datetime-local" class="form-control" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tratativa</label>
            <textarea v-model="form.tratativa" class="form-control" rows="3"
                      placeholder="Anotações sobre a tratativa, combinados, próximos passos..." />
          </div>
          <div v-if="erro" class="alert alert-danger">{{ erro }}</div>
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
        <div class="modal-header"><h2>Excluir avanço</h2></div>
        <div class="modal-body">
          <p>Excluir o avanço de <strong>{{ excluindo.nomeLead || excluindo.cliente }}</strong>?</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="excluindo = null">Cancelar</button>
          <button class="btn btn-danger" @click="executarExcluir">Excluir</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import api, { avancosApi } from '@/services/api'

// ── Estado ────────────────────────────────────────────────────────────────────

const sdrs     = ref(['Leandro', 'Pedro', 'Ana Carolina', 'Henrique', 'Latifi', 'Nicolly', 'Victória'])
const tipos    = ['Interessado', 'Apresentação', 'Encaminhamento', 'Nutrição']
const LIMITE   = 100

const sdrAtivo = ref(localStorage.getItem('sdr_ativo') || '')
const dados    = ref([])
const total    = ref(0)
const pagina   = ref(1)
const carregando = ref(false)
const badge    = reactive({ vencidos: 0, hoje: 0, total: 0 })
const opcoes   = reactive({ clientes: [] })

const modalAberto = ref(false)
const editando    = ref(null)
const excluindo   = ref(null)
const salvando    = ref(false)
const erro        = ref('')

const filtros = reactive({
  busca: '', tipo: '', followupStatus: '',
  dataInicio: '', dataFim: '',
})

const form = reactive({
  cliente: '', tipo: 'Interessado', nomeLead: '', empresa: '',
  cargo: '', segmento: '', porte: '', campanha: '',
  responsavel: '', dataAvanco: new Date().toISOString().slice(0,10),
  dataFollowup: '', tratativa: '',
})

const totalPaginas = computed(() => Math.max(1, Math.ceil(total.value / LIMITE)))

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(() => {
  carregar()
  carregarBadge()
  avancosApi.opcoes().then(r => {
    opcoes.clientes = r.data.clientes || []
    const responsaveis = r.data.responsaveis || []
    sdrs.value = [...new Set([...sdrs.value, ...responsaveis])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  })
  // Atualiza badge a cada minuto
  const timer = setInterval(carregarBadge, 60000)
  onUnmounted(() => clearInterval(timer))
})

// ── Funções ───────────────────────────────────────────────────────────────────

function setSdr(s) {
  sdrAtivo.value = s
  localStorage.setItem('sdr_ativo', s)
  carregarBadge()
  pagina.value = 1
  carregar()
}

async function carregarBadge() {
  if (!sdrAtivo.value) { Object.assign(badge, { vencidos: 0, hoje: 0, total: 0 }); return }
  try {
    const r = await api.get('/avancos/followup-count', { params: { responsavel: sdrAtivo.value } })
    Object.assign(badge, r.data)
  } catch {}
}

function filtrarFollowups() {
  filtros.followupStatus = 'vencido'
  pagina.value = 1
  carregar()
}

let debounce = null
function onFiltro() {
  clearTimeout(debounce)
  debounce = setTimeout(() => { pagina.value = 1; carregar() }, 400)
}

function limparFiltros() {
  Object.assign(filtros, { busca: '', tipo: '', followupStatus: '', dataInicio: '', dataFim: '' })
  pagina.value = 1
  carregar()
}

async function carregar() {
  carregando.value = true
  try {
    const params = {
      page: pagina.value, limit: LIMITE,
      orderBy: 'dataAvanco', orderDir: 'DESC', // ordenação base — reordenação por followup é feita client-side
    }
    if (filtros.busca)           params.busca         = filtros.busca
    if (filtros.tipo)            params.tipo          = filtros.tipo
    if (filtros.dataInicio)      params.dataInicio    = filtros.dataInicio
    if (filtros.dataFim)         params.dataFim       = filtros.dataFim
    if (sdrAtivo.value)          params.sdrResponsavel = sdrAtivo.value
    if (filtros.followupStatus && filtros.followupStatus !== 'sem') {
      params.followupStatus = filtros.followupStatus
    }
    if (filtros.followupStatus === 'sem') {
      // Filtro especial: sem follow-up — handled client-side after load
    }

    const r = await api.get('/avancos', { params })
    let lista = r.data.dados || []

    // Filtra "sem follow-up" client-side
    if (filtros.followupStatus === 'sem') {
      lista = lista.filter(a => !a.dataFollowup)
    }

    // Ordena: vencidos primeiro, depois hoje, depois futuros, depois sem data
    dados.value = ordenarPorFollowup(lista)
    total.value = r.data.total || lista.length
  } finally {
    carregando.value = false
  }
}

function ordenarPorFollowup(lista) {
  const agora = new Date()
  const hoje_fim = new Date(); hoje_fim.setHours(23,59,59,999)

  return [...lista].sort((a, b) => {
    const prioA = followupPrio(a.dataFollowup, agora, hoje_fim)
    const prioB = followupPrio(b.dataFollowup, agora, hoje_fim)
    if (prioA !== prioB) return prioA - prioB
    // Dentro do mesmo grupo, mais antigo primeiro
    if (a.dataFollowup && b.dataFollowup) return new Date(a.dataFollowup) - new Date(b.dataFollowup)
    return 0
  })
}

function followupPrio(dt, agora, hoje_fim) {
  if (!dt) return 3
  const d = new Date(dt)
  if (d < agora) return 0        // vencido — primeiro
  if (d <= hoje_fim) return 1    // hoje
  return 2                       // futuro
}

function statusFollowup(dt) {
  if (!dt) return ''
  const agora = new Date()
  const hoje_fim = new Date(); hoje_fim.setHours(23,59,59,999)
  const d = new Date(dt)
  if (d < agora) return 'row-vencido'
  if (d <= hoje_fim) return 'row-hoje'
  return ''
}

function tipoClass(tipo) {
  const map = { 'Interessado': 'interessado', 'Apresentação': 'apresentacao',
                'Encaminhamento': 'encaminhamento', 'Nutrição': 'nutricao' }
  return map[tipo] || 'interessado'
}

// ── Edição inline ─────────────────────────────────────────────────────────────

async function salvarFollowup(avanco, valor) {
  try {
    await api.put(`/avancos/${avanco.id}`, {
      dataFollowup: valor || null,
    })
    avanco.dataFollowup = valor || null
    dados.value = ordenarPorFollowup(dados.value)
    carregarBadge()
  } catch {}
}

async function salvarTratativa(avanco, valor) {
  if (valor === (avanco.tratativa || '')) return
  try {
    await api.put(`/avancos/${avanco.id}`, { tratativa: valor })
    avanco.tratativa = valor
  } catch {}
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function abrirModal(a) {
  editando.value = a
  erro.value = ''
  if (a) {
    Object.assign(form, {
      cliente: a.cliente, tipo: a.tipo, nomeLead: a.nomeLead || '',
      empresa: a.empresa || '', cargo: a.cargo || '',
      segmento: a.segmento || '', porte: a.porte || '',
      campanha: a.campanha || '', responsavel: a.responsavel || sdrAtivo.value,
      dataAvanco: a.dataAvanco, dataFollowup: toDatetimeLocal(a.dataFollowup),
      tratativa: a.tratativa || '',
    })
  } else {
    Object.assign(form, {
      cliente: '', tipo: 'Interessado', nomeLead: '', empresa: '',
      cargo: '', segmento: '', porte: '', campanha: '',
      responsavel: sdrAtivo.value, dataAvanco: new Date().toISOString().slice(0,10),
      dataFollowup: '', tratativa: '',
    })
  }
  modalAberto.value = true
}

function fecharModal() { modalAberto.value = false }

async function salvar() {
  if (!form.cliente || !form.tipo || !form.dataAvanco) {
    erro.value = 'Cliente, tipo e data são obrigatórios'
    return
  }
  salvando.value = true
  try {
    const payload = { ...form }
    if (!payload.dataFollowup) payload.dataFollowup = null
    if (editando.value) {
      await api.put(`/avancos/${editando.value.id}`, payload)
    } else {
      await api.post('/avancos', payload)
    }
    fecharModal()
    carregar()
    carregarBadge()
  } catch (e) {
    erro.value = e.response?.data?.message || 'Erro ao salvar'
  } finally { salvando.value = false }
}

function confirmarExcluir(a) { excluindo.value = a }
async function executarExcluir() {
  await api.delete(`/avancos/${excluindo.value.id}`)
  excluindo.value = null
  carregar()
}

// ── Formatação ────────────────────────────────────────────────────────────────

function fdata(d) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function fdatetime(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function toDatetimeLocal(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  // Ajusta para horário local
  const offset = dt.getTimezoneOffset() * 60000
  return new Date(dt - offset).toISOString().slice(0, 16)
}
</script>

<style scoped>
.sdr-selector {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 4px 10px;
}
.sdr-btn {
  font-size: 12px; padding: 3px 10px; border-radius: 12px;
  border: 1px solid transparent; background: none;
  cursor: pointer; color: var(--muted); font-weight: 500;
  transition: all .15s;
}
.sdr-btn.ativo { background: var(--brand); color: white; border-color: var(--brand); }
.sdr-btn:not(.ativo):hover { background: var(--brand-light); color: var(--brand); }

.followup-badge {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 5px 10px;
  cursor: pointer; font-size: 12px;
}
.followup-badge:hover { border-color: var(--brand); }
.badge-vencido { background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.badge-hoje    { background: #fef9c3; color: #ca8a04; padding: 2px 8px; border-radius: 10px; font-weight: 600; }

/* Tabela */
.sdr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sdr-table thead th {
  padding: 10px 12px; background: var(--bg);
  border-bottom: 2px solid var(--border);
  text-align: left; font-size: 11px; font-weight: 600;
  color: var(--muted); text-transform: uppercase; letter-spacing: .04em;
  white-space: nowrap;
}
.sdr-table tbody tr { border-bottom: 1px solid var(--border); transition: background .1s; }
.sdr-table tbody tr:hover { background: #f8fafd; }
.sdr-table td { padding: 10px 12px; vertical-align: top; }

/* Status rows */
.row-vencido { background: #fff5f5 !important; }
.row-vencido:hover { background: #fee2e2 !important; }
.row-vencido td:first-child { border-left: 3px solid #dc2626; }
.row-hoje    { background: #fffdf0 !important; }
.row-hoje:hover { background: #fef9c3 !important; }
.row-hoje td:first-child { border-left: 3px solid #ca8a04; }

.td-main { font-weight: 500; color: var(--text); }
.td-sub  { font-size: 11px; color: var(--muted); margin-top: 2px; }

/* Follow-up cell */
.followup-cell { display: flex; align-items: center; gap: 4px; }
.followup-input {
  font-size: 11px; border: 1px solid var(--border); border-radius: 6px;
  padding: 4px 6px; background: var(--bg); color: var(--text);
  max-width: 150px; cursor: pointer;
}
.followup-input:focus { outline: none; border-color: var(--brand); }
.followup-input.row-vencido { border-color: #dc2626; color: #dc2626; background: #fff5f5; }
.followup-input.row-hoje    { border-color: #ca8a04; color: #ca8a04; background: #fffdf0; }
.clear-btn {
  background: none; border: none; cursor: pointer;
  color: var(--muted); font-size: 15px; padding: 0 2px;
}
.clear-btn:hover { color: #dc2626; }

/* Tratativa */
.tratativa-td { min-width: 200px; max-width: 280px; }
.tratativa-input {
  width: 100%; font-size: 12px; border: 1px solid transparent;
  border-radius: 6px; padding: 4px 8px; background: transparent;
  color: var(--text); font-family: inherit; resize: none;
  transition: border .15s, background .15s;
}
.tratativa-input:hover { background: var(--bg); border-color: var(--border); }
.tratativa-input:focus { outline: none; background: var(--surface); border-color: var(--brand); }

.responsavel-chip {
  font-size: 11px; background: var(--bg); border: 1px solid var(--border);
  padding: 2px 8px; border-radius: 10px; color: var(--muted);
  white-space: nowrap;
}
</style>
