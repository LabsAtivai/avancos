<template>
  <div class="page">
    <div class="page-header">
      <div>
        <div class="page-title">Avanços comerciais</div>
        <div class="page-sub">Registros de leads com resposta positiva às cadências</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" @click="exportarCSV">⬇ Exportar Excel</button>
        <button class="btn btn-primary" @click="abrirModal(null)">+ Novo avanço</button>
      </div>
    </div>

    <!-- Métricas rápidas -->
    <div class="metrics">
      <div class="metric brand">
        <div class="metric-label">Total filtrado</div>
        <div class="metric-value">{{ fnum(totalRegistros) }}</div>
      </div>
      <div class="metric success">
        <div class="metric-label">Interessados</div>
        <div class="metric-value">{{ fnum(meta.interessado) }}</div>
      </div>
      <div class="metric">
        <div class="metric-label" style="color:var(--success)">Apresentações</div>
        <div class="metric-value" style="color:var(--success)">{{ fnum(meta.apresentacao) }}</div>
      </div>
      <div class="metric warning">
        <div class="metric-label">Encaminhamentos</div>
        <div class="metric-value">{{ fnum(meta.encaminhamento) }}</div>
      </div>
      <div class="metric accent">
        <div class="metric-label">Nutrição</div>
        <div class="metric-value">{{ fnum(meta.nutricao) }}</div>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card">
      <!-- Filtros -->
      <div class="filters">
        <input
          v-model="filtros.busca"
          class="form-control"
          placeholder="Buscar lead, empresa, cliente..."
          @input="buscarDebounce"
          style="flex:1;min-width:180px"
        />

        <!-- Multi-seleção de clientes -->
        <MultiClienteSelect
          v-model="filtros.clientesExatos"
          :clientes="opcoes.clientes"
          placeholder="Todos os clientes"
          @update:modelValue="onFiltroChange"
          style="min-width:220px"
        />

        <select v-model="filtros.tipo" class="form-control" @change="onFiltroChange">
          <option value="">Todos os tipos</option>
          <option v-for="t in opcoes.tipos" :key="t" :value="t">{{ t }}</option>
        </select>

        <select v-model="filtros.campanhaExata" class="form-control" @change="onFiltroChange" style="min-width:160px">
          <option value="">Todas as fontes</option>
          <option v-for="c in opcoes.campanhas" :key="c" :value="c">{{ c }}</option>
        </select>

        <select v-model="filtros.ano" class="form-control" @change="onFiltroChange">
          <option value="">Todos os anos</option>
          <option v-for="a in opcoes.anos" :key="a" :value="a">{{ a }}</option>
        </select>

        <input v-model="filtros.dataInicio" type="date" class="form-control" @change="onFiltroChange" />
        <input v-model="filtros.dataFim"    type="date" class="form-control" @change="onFiltroChange" />

        <button class="btn btn-ghost btn-sm" @click="limparFiltros">Limpar</button>
      </div>

      <!-- Tabela -->
      <div class="table-wrap">
        <div v-if="carregando" class="loading">
          <div class="spinner"></div> Carregando...
        </div>

        <div v-else-if="!dados.length" class="empty">
          <div class="empty-icon">📋</div>
          <div class="empty-text">Nenhum avanço encontrado</div>
        </div>

        <table v-else>
          <thead>
            <tr>
              <th @click="ordenarPor('cliente')" style="cursor:pointer">
                Cliente {{ sortIcon('cliente') }}
              </th>
              <th>Tipo</th>
              <th>Lead</th>
              <th>Cargo</th>
              <th>Empresa</th>
              <th>Segmento</th>
              <th>Tamanho</th>
              <th>Fonte</th>
              <th @click="ordenarPor('dataAvanco')" style="cursor:pointer">
                Data {{ sortIcon('dataAvanco') }}
              </th>
              <th>Responsável</th>
              <th style="width:80px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in dados" :key="a.id">
              <td><strong>{{ a.cliente }}</strong></td>
              <td><span :class="badgeClass(a.tipo)" class="badge">{{ a.tipo }}</span></td>
              <td>{{ a.nomeLead || '—' }}</td>
              <td>{{ a.cargo    || '—' }}</td>
              <td>{{ a.empresa  || '—' }}</td>
              <td>{{ a.segmento || '—' }}</td>
              <td>{{ a.porte    || '—' }}</td>
              <td>{{ a.campanha || '—' }}</td>
              <td>{{ formatarData(a.dataAvanco) }}</td>
              <td>{{ a.responsavel || '—' }}</td>
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" @click="abrirModal(a)" title="Editar">✏️</button>
                  <button class="btn btn-ghost btn-sm" @click="confirmarExcluir(a)" title="Excluir">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginação -->
      <div class="pagination" v-if="totalPaginas > 1">
        <button class="btn btn-ghost btn-sm" :disabled="pagina <= 1" @click="irPara(pagina - 1)">← Anterior</button>
        <span>Página {{ pagina }} de {{ totalPaginas }} — {{ fnum(totalRegistros) }} registros</span>
        <button class="btn btn-ghost btn-sm" :disabled="pagina >= totalPaginas" @click="irPara(pagina + 1)">Próxima →</button>
      </div>
      <div class="pagination" v-else-if="totalRegistros > 0">
        <span>{{ fnum(totalRegistros) }} registros</span>
      </div>
    </div>

    <!-- Modal criar/editar -->
    <ModalAvanco
      v-if="modalAberto"
      :avanco="avancoeditando"
      :opcoes="opcoesModal"
      @close="modalAberto = false"
      @saved="onSaved"
    />

    <!-- Confirmar exclusão -->
    <div v-if="excluindo" class="modal-overlay" @click.self="excluindo = null">
      <div class="modal" style="max-width:400px">
        <div class="modal-header"><h2>Excluir avanço</h2></div>
        <div class="modal-body">
          <p>Excluir o avanço de <strong>{{ excluindo.nomeLead || excluindo.empresa || 'este lead' }}</strong>?</p>
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
import MultiClienteSelect from '@/components/MultiClienteSelect.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { avancosApi } from '@/services/api'
import ModalAvanco from '@/components/avancos/ModalAvanco.vue'

const dados          = ref([])
const carregando     = ref(false)
const pagina         = ref(1)
const totalRegistros = ref(0)
const totalPaginas   = ref(1)
const modalAberto    = ref(false)
const avancoeditando = ref(null)
const excluindo      = ref(null)
const excluindoId    = ref(false)
let debounceTimer    = null

// opcoes.clientes = [{valor, total}], resto = string[]
const opcoes = reactive({
  clientes: [], tipos: [], segmentos: [],
  campanhas: [], responsaveis: [], anos: [],
})

const meta = reactive({
  total: 0, interessado: 0, apresentacao: 0,
  encaminhamento: 0, nutricao: 0,
})

// opcoesModal converte clientes para strings simples
const opcoesModal = computed(() => ({
  ...opcoes,
  clientes: opcoes.clientes.map(c => c.valor),
}))

const filtros = reactive({
  busca: '',
  clienteExato: '',
  clientesExatos: [], // multi-select
  tipo: '',
  campanhaExata: '',
  segmentoExato: '',
  ano: '',
  dataInicio: '',
  dataFim: '',
  orderBy: 'dataAvanco',
  orderDir: 'DESC',
})

onMounted(async () => {
  const r = await avancosApi.opcoes()
  Object.assign(opcoes, r.data)
  await Promise.all([buscar(), carregarMeta()])
})

async function buscar() {
  carregando.value = true
  try {
    // Monta params apenas com valores preenchidos
    const params = { page: pagina.value, limit: 50 }
    if (filtros.clientesExatos?.length) params.clientes = filtros.clientesExatos.join('|')
    else if (filtros.clienteExato) params.clienteExato = filtros.clienteExato
    if (filtros.tipo)         params.tipo          = filtros.tipo
    if (filtros.campanhaExata) params.campanhaExata = filtros.campanhaExata
    if (filtros.segmentoExato) params.segmentoExato = filtros.segmentoExato
    if (filtros.ano)          params.ano           = filtros.ano
    if (filtros.dataInicio)   params.dataInicio    = filtros.dataInicio
    if (filtros.dataFim)      params.dataFim       = filtros.dataFim
    if (filtros.busca)        params.busca         = filtros.busca
    if (filtros.orderBy)      params.orderBy       = filtros.orderBy
    if (filtros.orderDir)     params.orderDir      = filtros.orderDir

    const r = await avancosApi.listar(params)
    dados.value          = r.data.dados
    totalRegistros.value = r.data.total
    totalPaginas.value   = r.data.totalPaginas
  } finally {
    carregando.value = false
  }
}

async function carregarMeta() {
  try {
    const params = {}
    if (filtros.clientesExatos?.length) params.clientes = filtros.clientesExatos.join('|')
    else if (filtros.clienteExato) params.cliente    = filtros.clienteExato
    if (filtros.tipo)         params.tipo        = filtros.tipo
    if (filtros.campanhaExata) params.campanha   = filtros.campanhaExata
    if (filtros.ano)          params.ano         = filtros.ano
    if (filtros.dataInicio)   params.dataInicio  = filtros.dataInicio
    if (filtros.dataFim)      params.dataFim     = filtros.dataFim

    const r = await avancosApi.estatisticas(params)
    meta.total = meta.interessado = meta.apresentacao = meta.encaminhamento = meta.nutricao = 0
    for (const row of (r.data.porTipo || [])) {
      const n = parseInt(row.total)
      meta.total += n
      if (row.tipo === 'Interessado')    meta.interessado    = n
      if (row.tipo === 'Apresentação')   meta.apresentacao   = n
      if (row.tipo === 'Encaminhamento') meta.encaminhamento = n
      if (row.tipo === 'Nutrição')       meta.nutricao       = n
    }
  } catch {}
}

function onFiltroChange() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pagina.value = 1
    buscar()
    carregarMeta()
  }, 350)
}

function buscarDebounce() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { pagina.value = 1; buscar(); carregarMeta() }, 500)
}

function ordenarPor(col) {
  if (filtros.orderBy === col) {
    filtros.orderDir = filtros.orderDir === 'ASC' ? 'DESC' : 'ASC'
  } else {
    filtros.orderBy  = col
    filtros.orderDir = 'DESC'
  }
  buscar()
}

function sortIcon(col) {
  if (filtros.orderBy !== col) return '↕'
  return filtros.orderDir === 'ASC' ? '↑' : '↓'
}

function irPara(p) { pagina.value = p; buscar() }

function limparFiltros() {
  Object.assign(filtros, {
    busca: '', clienteExato: '', clientesExatos: [], tipo: '', campanhaExata: '',
    segmentoExato: '', ano: '', dataInicio: '', dataFim: '',
    orderBy: 'dataAvanco', orderDir: 'DESC',
  })
  pagina.value = 1
  buscar()
  carregarMeta()
}

function abrirModal(a) { avancoeditando.value = a; modalAberto.value = true }

function onSaved() {
  modalAberto.value = false
  buscar()
  carregarMeta()
  avancosApi.opcoes().then(r => Object.assign(opcoes, r.data))
}

function confirmarExcluir(a) { excluindo.value = a }

async function executarExcluir() {
  excluindoId.value = true
  try {
    await avancosApi.excluir(excluindo.value.id)
    excluindo.value = null
    buscar()
    carregarMeta()
  } finally {
    excluindoId.value = false
  }
}

async function exportarCSV() {
  const params = new URLSearchParams()
  if (filtros.clientesExatos?.length) params.set('clientes', filtros.clientesExatos.join('|'))
  else if (filtros.clienteExato)  params.set('clienteExato',  filtros.clienteExato)
  if (filtros.tipo)          params.set('tipo',           filtros.tipo)
  if (filtros.campanhaExata) params.set('campanhaExata',  filtros.campanhaExata)
  if (filtros.ano)           params.set('ano',            filtros.ano)
  if (filtros.dataInicio)    params.set('dataInicio',     filtros.dataInicio)
  if (filtros.dataFim)       params.set('dataFim',        filtros.dataFim)
  if (filtros.busca)         params.set('busca',          filtros.busca)
  window.open(`/api/avancos/exportar?${params.toString()}`, '_blank')
}

function badgeClass(tipo) {
  return {
    'Interessado':    'badge-interessado',
    'Apresentação':   'badge-apresentacao',
    'Encaminhamento': 'badge-encaminhamento',
    'Nutrição':       'badge-nutricao',
  }[tipo] || ''
}

function formatarData(d) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function fnum(n) {
  return (n || 0).toLocaleString('pt-BR')
}
</script>
