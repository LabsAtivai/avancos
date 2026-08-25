<template>
  <div class="page">
    <div class="page-header">
      <div>
        <div class="page-title">Métricas de Campanhas</div>
        <div class="page-sub">Consulte as métricas do Snov.io por campanha e período</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:start">

      <!-- ── Filtros ──────────────────────────────────────────────── -->
      <div style="display:flex;flex-direction:column;gap:14px;position:sticky;top:24px">

        <!-- Cliente -->
        <div class="card card-body">
          <div class="form-group" style="margin:0">
            <label class="form-label">Cliente *</label>
            <MultiClienteSelect
              v-model="clientesSelecionados"
              :clientes="opcoes.clientes"
              placeholder="Selecione o cliente"
              @update:modelValue="onClientesChange"
            />
            <div v-if="clientesSelecionados.length > 1" class="hint" style="color:#d97706">
              ⚠️ Selecione apenas 1 cliente para gerar métricas
            </div>
          </div>
        </div>

        <!-- Períodos -->
        <div class="card card-body">
          <div class="form-label" style="font-weight:600;margin-bottom:12px">Períodos</div>

          <div style="margin-bottom:12px">
            <div class="periodo-label brand">Atual</div>
            <div class="form-row cols-2">
              <div class="form-group" style="margin:0">
                <label class="form-label">De</label>
                <input v-model="form.atual.inicio" type="date" class="form-control" @change="calcularAnterior" />
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Até</label>
                <input v-model="form.atual.fim" type="date" class="form-control" @change="calcularAnterior" />
              </div>
            </div>
          </div>

          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div class="periodo-label" style="margin:0">Anterior</div>
              <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);cursor:pointer">
                <input type="checkbox" v-model="anteriorAuto" @change="calcularAnterior" />
                Auto
              </label>
            </div>
            <div class="form-row cols-2">
              <div class="form-group" style="margin:0">
                <label class="form-label">De</label>
                <input v-model="form.anterior.inicio" type="date" class="form-control" :disabled="anteriorAuto" />
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Até</label>
                <input v-model="form.anterior.fim" type="date" class="form-control" :disabled="anteriorAuto" />
              </div>
            </div>
          </div>

          <div>
            <div class="periodo-label">Geral</div>
            <div class="form-row cols-2">
              <div class="form-group" style="margin:0">
                <label class="form-label">De</label>
                <input v-model="form.geral.inicio" type="date" class="form-control" />
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Até</label>
                <input v-model="form.geral.fim" type="date" class="form-control" />
              </div>
            </div>
          </div>
        </div>

        <!-- Credenciais -->
        <div class="card card-body">
          <div class="form-label" style="font-weight:600;margin-bottom:12px">Credenciais Snov.io</div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Client ID *</label>
            <input v-model="snovId" class="form-control" placeholder="seu_client_id" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Client Secret *</label>
            <input v-model="snovSecret" type="password" class="form-control" placeholder="••••••••" />
          </div>
        </div>

        <!-- Campanhas -->
        <div class="card card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div class="form-label" style="font-weight:600;margin:0">Fontes (Snov.io)</div>
            <button class="btn btn-ghost btn-sm" :disabled="!snovId || !snovSecret || carregandoCampanhas"
                    @click="buscarCampanhas">
              {{ carregandoCampanhas ? '...' : '↻ Carregar' }}
            </button>
          </div>

          <div v-if="erroCampanhas" class="alert alert-danger" style="margin-bottom:8px;font-size:12px">{{ erroCampanhas }}</div>

          <div v-if="!campanhas.length" style="font-size:12px;color:var(--muted)">
            {{ snovId && snovSecret ? 'Clique em Carregar para buscar as campanhas.' : 'Preencha as credenciais primeiro.' }}
          </div>

          <div v-else style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;max-height:280px;overflow-y:auto">
            <div v-for="c in campanhas" :key="c.id"
                 class="campanha-row" :class="{ arquivada: !c.ativa }">
              <input type="checkbox" :id="'c'+c.id" v-model="campanhaSelecionada[c.id]" />
              <label :for="'c'+c.id" style="flex:1;cursor:pointer;font-size:12px">{{ c.nome }}</label>
              <span :class="c.ativa ? 'badge-ativa' : 'badge-arquivada'">
                {{ c.ativa ? 'Ativa' : 'Arq.' }}
              </span>
            </div>
          </div>

          <div v-if="campanhasSelecionadasCount > 0" style="font-size:11px;color:var(--muted);margin-top:6px">
            {{ campanhasSelecionadasCount }} selecionada(s)
          </div>
        </div>

        <!-- Avanços do banco -->
        <div class="card card-body" v-if="form.cliente">
          <div class="form-label" style="font-weight:600;margin-bottom:10px">
            Avanços do banco
            <span style="font-size:10px;font-weight:400;color:var(--muted);margin-left:4px">período atual</span>
          </div>
          <div v-if="avancos.carregando" class="loading" style="padding:8px"><div class="spinner"></div></div>
          <div v-else class="avancos-mini">
            <div class="av-mini brand">
              <div class="av-num">{{ avancos.atual.interessado }}</div>
              <div class="av-lbl">Interessados</div>
            </div>
            <div class="av-mini success">
              <div class="av-num">{{ avancos.atual.apresentacao }}</div>
              <div class="av-lbl">Apresentação</div>
            </div>
            <div class="av-mini warning">
              <div class="av-num">{{ avancos.atual.encaminhamento }}</div>
              <div class="av-lbl">Encaminh.</div>
            </div>
            <div class="av-mini">
              <div class="av-num">{{ avancos.atual.nutricao }}</div>
              <div class="av-lbl">Nutrição</div>
            </div>
          </div>
        </div>

        <!-- Botão consultar -->
        <button class="btn btn-primary" style="height:42px"
                :disabled="consultando || !formValido" @click="consultar">
          <span v-if="consultando">
            <span class="spinner" style="width:13px;height:13px;border-width:2px"></span>
            Buscando...
          </span>
          <span v-else>🔍 Consultar métricas</span>
        </button>

        <div v-if="erro" class="alert alert-danger" style="font-size:12px">{{ erro }}</div>
      </div>

      <!-- ── Painel de métricas ───────────────────────────────────── -->
      <div>
        <!-- Placeholder -->
        <div v-if="!metricas && !consultando"
             style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;color:var(--muted);gap:12px">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".4">
            <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/>
          </svg>
          <div style="font-size:14px">Selecione um cliente, período e fontes para consultar</div>
        </div>

        <div v-else-if="consultando"
             style="display:flex;align-items:center;justify-content:center;min-height:400px">
          <div class="loading"><div class="spinner"></div></div>
        </div>

        <div v-else-if="metricas" style="display:flex;flex-direction:column;gap:20px">

          <!-- Cards de totais -->
          <div class="totais-grid">
            <div class="total-card">
              <div class="total-label">Contatos Atingidos (Atual)</div>
              <div class="total-val">{{ fnum(metricas.total.at.contatos) }}</div>
              <div class="total-diff" :class="diff(metricas.total.at.contatos, metricas.total.ant.contatos).cls">
                {{ diff(metricas.total.at.contatos, metricas.total.ant.contatos).txt }} vs anterior
              </div>
            </div>
            <div class="total-card">
              <div class="total-label">Disparos (Atual)</div>
              <div class="total-val">{{ fnum(metricas.total.at.disparos) }}</div>
              <div class="total-diff" :class="diff(metricas.total.at.disparos, metricas.total.ant.disparos).cls">
                {{ diff(metricas.total.at.disparos, metricas.total.ant.disparos).txt }} vs anterior
              </div>
            </div>
            <div class="total-card">
              <div class="total-label">Respostas (Atual)</div>
              <div class="total-val accent">{{ fnum(metricas.total.at.respostas) }}</div>
              <div class="total-diff" :class="diff(metricas.total.at.respostas, metricas.total.ant.respostas).cls">
                {{ diff(metricas.total.at.respostas, metricas.total.ant.respostas).txt }} vs anterior
              </div>
            </div>
            <div class="total-card">
              <div class="total-label">Taxa Resposta (Atual)</div>
              <div class="total-val accent">{{ metricas.total.at.resp_pct }}%</div>
              <div class="total-diff" :class="diff(metricas.total.at.resp_pct, metricas.total.ant.resp_pct).cls">
                {{ diff(metricas.total.at.resp_pct, metricas.total.ant.resp_pct).txt }} vs anterior
              </div>
            </div>
          </div>

          <!-- Métricas no formato da imagem: uma tabela para cada campanha selecionada -->
          <div class="metricas-stack">
            <div class="metricas-card total-metricas-card">
              <div class="metricas-card-head">
                <div>
                  <div class="metricas-card-title">Resumo geral das fontes selecionadas</div>
                  <div class="metricas-card-sub">Consolidado de todas as fontes marcadas no filtro</div>
                </div>
                <span v-if="copiado" class="copy-ok">✓ Copiado!</span>
              </div>
              <table class="metricas-resumo-table">
                <thead>
                  <tr>
                    <th class="col-metrica">Métricas</th>
                    <th class="period-col anterior">Anterior<br><span>{{ fdata(form.anterior.inicio) }} até {{ fdata(form.anterior.fim) }}</span></th>
                    <th class="period-col atual">Atual<br><span>{{ fdata(form.atual.inicio) }} até {{ fdata(form.atual.fim) }}</span></th>
                    <th class="period-col geral">Geral<br><span>Desde {{ fdata(form.geral.inicio) }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in linhasGeral" :key="'total_'+r.key">
                    <td class="metrica-label">
                      <span class="metric-icon">{{ r.icon }}</span>
                      <div><strong>{{ r.label }}</strong></div>
                    </td>
                    <td class="metric-value anterior" @click="copiar(r.ant)">{{ r.ant }}</td>
                    <td class="metric-value atual" @click="copiar(r.at)">
                      {{ r.at }}
                      <span v-if="r.diff" class="diff-pill" :class="r.diff.cls">{{ r.diff.txt }}</span>
                    </td>
                    <td class="metric-value geral" @click="copiar(r.ger)">{{ r.ger }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-for="c in metricas.campanhas" :key="c.id" class="metricas-card">
              <div class="metricas-card-head">
                <div>
                  <div class="metricas-card-title">{{ c.nome }}</div>
                  <div class="metricas-card-sub">Métricas individuais da fonte selecionada</div>
                </div>
                <span class="campaign-chip">Fonte</span>
              </div>
              <table class="metricas-resumo-table">
                <thead>
                  <tr>
                    <th class="col-metrica">Métricas</th>
                    <th class="period-col anterior">Anterior<br><span>{{ fdata(form.anterior.inicio) }} até {{ fdata(form.anterior.fim) }}</span></th>
                    <th class="period-col atual">Atual<br><span>{{ fdata(form.atual.inicio) }} até {{ fdata(form.atual.fim) }}</span></th>
                    <th class="period-col geral">Geral<br><span>Desde {{ fdata(form.geral.inicio) }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in linhasMetricas(c, false)" :key="c.id+'_'+r.key">
                    <td class="metrica-label">
                      <span class="metric-icon">{{ r.icon }}</span>
                      <div><strong>{{ r.label }}</strong><small>{{ r.desc }}</small></div>
                    </td>
                    <td class="metric-value anterior">
                      <input v-if="r.editavel"
                        :value="editValue(c.id, r.key, 'ant', r.ant)"
                        @input="setEdit(c.id, r.key, 'ant', $event.target.value); recalcular()"
                        @click.stop type="number" min="0" class="edit-input" placeholder="0" />
                      <span v-else @click="copiar(r.ant)">{{ r.ant }}</span>
                    </td>
                    <td class="metric-value atual">
                      <input v-if="r.editavel"
                        :value="editValue(c.id, r.key, 'at', r.at)"
                        @input="setEdit(c.id, r.key, 'at', $event.target.value); recalcular()"
                        @click.stop type="number" min="0" class="edit-input" placeholder="0" />
                      <template v-else>
                        <span @click="copiar(r.at)">{{ r.at }}</span>
                        <span v-if="r.diff" class="diff-pill" :class="r.diff.cls">{{ r.diff.txt }}</span>
                      </template>
                    </td>
                    <td class="metric-value geral">
                      <input v-if="r.editavel"
                        :value="editValue(c.id, r.key, 'ger', r.ger)"
                        @input="setEdit(c.id, r.key, 'ger', $event.target.value); recalcular()"
                        @click.stop type="number" min="0" class="edit-input" placeholder="0" />
                      <span v-else @click="copiar(r.ger)">{{ r.ger }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import api, { avancosApi } from '@/services/api'
import MultiClienteSelect from '@/components/MultiClienteSelect.vue'
import { useCredenciais } from '@/composables/useCredenciais'

// ── Estado ────────────────────────────────────────────────────────────────────

const clientesSelecionados = ref([])

function onClientesChange(vals) {
  form.cliente = vals[0] || ''
  if (form.cliente) {
    buscarAvancos()
    carregarCredenciais(form.cliente)
  }
}

const { snovId, snovSecret, encontrado: credEncontrado, carregarCredenciais } = useCredenciais()

const form = reactive({
  cliente: '',
  atual:    { inicio: '', fim: '' },
  anterior: { inicio: '', fim: '' },
  geral:    { inicio: '', fim: '' },
})

const opcoes              = reactive({ clientes: [] })
const anteriorAuto        = ref(true)
const consultando         = ref(false)
const erro                = ref('')
const campanhas           = ref([])
const campanhaSelecionada = reactive({})
const carregandoCampanhas = ref(false)
const erroCampanhas       = ref('')
const metricas            = ref(null)
const copiado             = ref(false)
const manualMetricas      = reactive({}) // legado
const editOverrides       = reactive({}) // novo: sobrescreve qualquer campo

const avancos = reactive({
  carregando: false,
  atual: { interessado: 0, apresentacao: 0, encaminhamento: 0, nutricao: 0 },
})

// Sub-cabeçalhos: 5 colunas por período (adicionou Aberturas)
const subHeaders = [
  ...['Cont.','Disp.','Abert.','Resp.','Resp.%'].map(l => ({ key:`ant_${l}`, label:l, per:'ant' })),
  ...['Cont.','Disp.','Abert.','Resp.','Resp.%'].map(l => ({ key:`at_${l}`,  label:l, per:'at'  })),
  ...['Cont.','Disp.','Abert.','Resp.','Resp.%'].map(l => ({ key:`ger_${l}`, label:l, per:'ger' })),
]

// ── Init ──────────────────────────────────────────────────────────────────────

const hoje = new Date().toISOString().slice(0, 10)
form.atual.inicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
form.atual.fim    = hoje
form.geral.inicio = '2020-01-01'
form.geral.fim    = hoje
calcularAnterior()

avancosApi.opcoes().then(r => { opcoes.clientes = r.data.clientes || [] })

// ── Computed ──────────────────────────────────────────────────────────────────

const campanhasSelecionadasCount = computed(() =>
  Object.values(campanhaSelecionada).filter(Boolean).length
)

const campanhasSelecionadasLista = computed(() =>
  campanhas.value.filter(c => campanhaSelecionada[c.id]).map(c => ({ id: c.id, nome: c.nome }))
)

// ── Geral computado — soma os valores editados das campanhas individuais ─────
const linhasGeral = computed(() => {
  if (!metricas.value) return []

  const campanhas = metricas.value.campanhas || []

  // Campos numéricos simples — soma das campanhas com overrides
  const somaNum = (campo, per) => {
    return campanhas.reduce((acc, c) => {
      const k = editKey(c.id, campo, per)
      const val = k in editOverrides
        ? editOverrides[k]
        : (c[per]?.[campo] ?? 0)
      return acc + Number(val || 0)
    }, 0)
  }

  // Campos de avanços — sempre soma apenas os overrides manuais (sem dados do banco)
  const somaAvanco = (campo, per) => somaNum(campo, per)

  const pct = (a, b) => b ? parseFloat((a / b * 100).toFixed(2)) : 0

  const row = (per) => {
    const cont  = somaNum('contatos',  per)
    const disp  = somaNum('disparos',  per)
    const abert = somaNum('aberturas', per)
    const resp  = somaNum('respostas', per)
    const ench  = somaAvanco('encaminhamento', per)
    const apres = somaAvanco('apresentacao',   per)
    const inter = somaAvanco('interessados',   per)
    return { cont, disp, abert, resp, ench, apres, inter,
             abert_pct: pct(abert, disp), resp_pct: pct(resp, abert) }
  }

  const ant = row('ant')
  const at  = row('at')
  // Geral já é o intervalo completo (geralInicio..geralFim), que engloba
  // Anterior e Atual — somar os três de novo contava esses períodos 2x.
  const ger = row('ger')

  return [
    { key:'contatos',       icon:'🎯', label:'Contatos Atingidos', ant: fnum(ant.cont),      at: fnum(at.cont),      ger: fnum(ger.cont),      diff: diffBadge(at.cont, ant.cont) },
    { key:'disparos',       icon:'➤',  label:'Disparos',           ant: fnum(ant.disp),      at: fnum(at.disp),      ger: fnum(ger.disp),      diff: diffBadge(at.disp, ant.disp) },
    { key:'aberturas',      icon:'✉️', label:'Aberturas',           ant: fnum(ant.abert),     at: fnum(at.abert),     ger: fnum(ger.abert),     diff: diffBadge(at.abert, ant.abert) },
    { key:'abert_pct',      icon:'%',  label:'Aberturas %',         ant: fpct(ant.abert_pct), at: fpct(at.abert_pct), ger: fpct(ger.abert_pct), diff: null },
    { key:'respostas',      icon:'↩',  label:'Respostas',           ant: fnum(ant.resp),      at: fnum(at.resp),      ger: fnum(ger.resp),      diff: diffBadge(at.resp, ant.resp) },
    { key:'resp_pct',       icon:'%',  label:'Respostas %',         ant: fpct(ant.resp_pct),  at: fpct(at.resp_pct),  ger: fpct(ger.resp_pct),  diff: null },
    { key:'encaminhamento', icon:'↗',  label:'Encaminhamento',      ant: fnum(ant.ench),      at: fnum(at.ench),      ger: fnum(ger.ench),      diff: diffBadge(at.ench, ant.ench) },
    { key:'apresentacao',   icon:'▣',  label:'Apresentação',        ant: fnum(ant.apres),     at: fnum(at.apres),     ger: fnum(ger.apres),     diff: diffBadge(at.apres, ant.apres) },
    { key:'interessados',   icon:'☆',  label:'Interessados',        ant: fnum(ant.inter),     at: fnum(at.inter),     ger: fnum(ger.inter),     diff: diffBadge(at.inter, ant.inter) },
    { key:'periodo', icon:'📅', label:'Período',
      ant: `${fdata(form.anterior.inicio)} até ${fdata(form.anterior.fim)}`,
      at:  `${fdata(form.atual.inicio)} até ${fdata(form.atual.fim)}`,
      ger: `Desde ${fdata(form.geral.inicio)}`, diff: null },
  ]
})

const formValido = computed(() =>
  form.cliente && form.atual.inicio && form.atual.fim &&
  snovId.value && snovSecret.value && campanhasSelecionadasCount.value > 0
)

// ── Funções ───────────────────────────────────────────────────────────────────

function calcularAnterior() {
  if (!anteriorAuto.value || !form.atual.inicio || !form.atual.fim) return
  const dIni  = new Date(form.atual.inicio)
  const dFim  = new Date(form.atual.fim)
  const delta = Math.floor((dFim - dIni) / 86400000)
  const antFim = new Date(dIni); antFim.setDate(antFim.getDate() - 1)
  const antIni = new Date(antFim); antIni.setDate(antIni.getDate() - delta)
  form.anterior.fim    = antFim.toISOString().slice(0, 10)
  form.anterior.inicio = antIni.toISOString().slice(0, 10)
}

// onClienteChange handled by onClientesChange above



async function buscarAvancos() {
  const cliente = form.cliente.trim()
  if (!cliente || !form.atual.inicio || !form.atual.fim) return
  avancos.carregando = true
  try {
    const r = await avancosApi.pptx({ cliente, dataInicio: form.atual.inicio, dataFim: form.atual.fim })
    Object.assign(avancos.atual, r.data)
  } catch {} finally { avancos.carregando = false }
}

watch([() => form.atual.inicio, () => form.atual.fim], () => {
  if (form.cliente) buscarAvancos()
})

async function buscarCampanhas() {
  if (!snovId.value || !snovSecret.value) return
  carregandoCampanhas.value = true
  erroCampanhas.value = ''
  try {
    const r = await api.get('/relatorio/campanhas', {
      params: { snovId: snovId.value, snovSecret: snovSecret.value }
    })
    campanhas.value = r.data.campanhas || []
    campanhas.value.forEach(c => { if (c.ativa) campanhaSelecionada[c.id] = true })
  } catch (e) {
    erroCampanhas.value = e.response?.data?.message || 'Erro ao buscar campanhas'
  } finally { carregandoCampanhas.value = false }
}

async function consultar() {
  erro.value = ''
  consultando.value = true
  metricas.value = null
  // Limpa edições manuais ao consultar novamente
  Object.keys(editOverrides).forEach(k => delete editOverrides[k])
  try {
    const r = await api.post('/relatorio/metricas', {
      snovId:         snovId.value,
      snovSecret:     snovSecret.value,
      atualInicio:    form.atual.inicio,
      atualFim:       form.atual.fim,
      anteriorInicio: form.anterior.inicio || form.atual.inicio,
      anteriorFim:    form.anterior.fim    || form.atual.inicio,
      geralInicio:    form.geral.inicio    || '2020-01-01',
      geralFim:       form.geral.fim       || hoje,
      campanhas:      campanhasSelecionadasLista.value,
    })
    metricas.value = r.data
  } catch (e) {
    erro.value = e.response?.data?.message || 'Erro ao consultar métricas'
  } finally { consultando.value = false }
}

function copiar(valor) {
  navigator.clipboard.writeText(String(valor)).then(() => {
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 1500)
  })
}

// ── Edição inline de qualquer campo ──────────────────────────────────────────

function editKey(id, campo, periodo) {
  return `${id}__${campo}__${periodo}`
}

// Retorna o valor sobrescrito se existir, senão converte o valor original para número
function editValue(id, campo, periodo, valorOriginal) {
  const k = editKey(id, campo, periodo)
  if (k in editOverrides) return editOverrides[k]
  // converte "1.234" ou "1.234,56" para número limpo
  const n = Number(String(valorOriginal).replace(/\./g, '').replace(',', '.'))
  return Number.isNaN(n) ? '' : n
}

function setEdit(id, campo, periodo, value) {
  const k = editKey(id, campo, periodo)
  const v = String(value ?? '').replace(/[^0-9]/g, '')
  if (v === '') delete editOverrides[k]
  else editOverrides[k] = Number(v)
}

// Recalcula percentuais nas campanhas individuais após edição
// O geral é computed automaticamente via linhasGeral
function recalcular() {
  if (!metricas.value) return
  const pct = (a, b) => b ? parseFloat((a / b * 100).toFixed(2)) : 0

  for (const c of (metricas.value.campanhas || [])) {
    for (const per of ['ant', 'at', 'ger']) {
      const get = (campo) => {
        const k = editKey(c.id, campo, per)
        return k in editOverrides ? editOverrides[k] : (c[per]?.[campo] ?? 0)
      }
      const disp  = get('disparos')
      const abert = get('aberturas')
      const resp  = get('respostas')
      // Só recalcula % se o usuário não editou diretamente
      const kAb = editKey(c.id, 'abert_pct', per)
      const kRp = editKey(c.id, 'resp_pct',  per)
      if (!(kAb in editOverrides) && disp  > 0) editOverrides[kAb] = pct(abert, disp)
      if (!(kRp in editOverrides) && abert > 0) editOverrides[kRp] = pct(resp,  abert)
    }
  }
}

// Legado — mantido para compatibilidade
function manualMetricKey(campanhaId, metrica, periodo) {
  return `${campanhaId}_${metrica}_${periodo}`
}
function manualMetricValue(campanhaId, metrica, periodo) {
  return manualMetricas[manualMetricKey(campanhaId, metrica, periodo)] ?? ''
}
function updateManualMetric(campanhaId, metrica, periodo, value) {
  const key = manualMetricKey(campanhaId, metrica, periodo)
  const v = String(value ?? '').replace(/[^0-9]/g, '')
  if (v === '') delete manualMetricas[key]
  else manualMetricas[key] = Number(v)
}

function diff(atual, anterior) {
  if (!anterior || anterior === 0) return { txt: '—', cls: '' }
  const pct = Number(((atual - anterior) / anterior * 100).toFixed(1))
  if (pct > 0)  return { txt: `▲ ${pct}%`, cls: 'diff-up' }
  if (pct < 0)  return { txt: `▼ ${Math.abs(pct)}%`, cls: 'diff-down' }
  return { txt: '= 0%', cls: '' }
}

function fnum(n) {
  if (n === undefined || n === null) return '—'
  return Number(n).toLocaleString('pt-BR')
}

function fdata(d) {
  if (!d) return '—'
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}
function fpct(v) {
  if (v === undefined || v === null || v === '') return '—'
  const n = Number(String(v).replace(',', '.'))
  if (Number.isNaN(n)) return String(v).includes('%') ? String(v) : `${v}%`
  return `${n.toFixed(2).replace('.', ',')}%`
}

function diffBadge(atual, anterior, isPct = false) {
  const a = Number(String(atual ?? 0).replace(',', '.'))
  const b = Number(String(anterior ?? 0).replace(',', '.'))
  if (!b || Number.isNaN(a) || Number.isNaN(b)) return null
  const valor = isPct ? (a - b) : ((a - b) / b * 100)
  const txt = `${valor > 0 ? '+' : ''}${valor.toFixed(2).replace('.', ',')}%`
  if (valor > 0) return { txt, cls: 'up' }
  if (valor < 0) return { txt, cls: 'down' }
  return { txt: '0,00%', cls: 'neutral' }
}

function linhasMetricas(item, incluirAvancos = false) {
  const ant = item.ant || {}
  const at  = item.at  || {}
  const ger = item.ger || {}

  // pct exibido: usa override se existir, senão usa o valor do backend
  const getPct = (id, campo, per, val) => {
    const k = editKey(id ?? 'total', campo, per)
    return k in editOverrides ? editOverrides[k] : (val ?? 0)
  }

  const id = item.id ?? 'total'

  const base = [
    { key: 'contatos',  label: 'Contatos Atingidos', desc: 'Total de contatos alcançados',   icon: '🎯', editavel: true,  ant: fnum(ant.contatos),  at: fnum(at.contatos),  ger: fnum(ger.contatos),  diff: diffBadge(at.contatos, ant.contatos) },
    { key: 'disparos',  label: 'Disparos',            desc: 'Total de disparos realizados',   icon: '➤',  editavel: true,  ant: fnum(ant.disparos),  at: fnum(at.disparos),  ger: fnum(ger.disparos),  diff: diffBadge(at.disparos, ant.disparos) },
    { key: 'aberturas', label: 'Aberturas',            desc: 'Total de aberturas',             icon: '✉️', editavel: true,  ant: fnum(ant.aberturas), at: fnum(at.aberturas), ger: fnum(ger.aberturas), diff: diffBadge(at.aberturas, ant.aberturas) },
    { key: 'abert_pct', label: 'Aberturas %',          desc: 'Calculado: Aberturas / Disparos',icon: '%',  editavel: false, ant: fpct(getPct(id,'abert_pct','ant',ant.abert_pct)), at: fpct(getPct(id,'abert_pct','at',at.abert_pct)), ger: fpct(getPct(id,'abert_pct','ger',ger.abert_pct)), diff: null },
    { key: 'respostas', label: 'Respostas',            desc: 'Total de respostas recebidas',   icon: '↩',  editavel: true,  ant: fnum(ant.respostas), at: fnum(at.respostas), ger: fnum(ger.respostas), diff: diffBadge(at.respostas, ant.respostas) },
    { key: 'resp_pct',  label: 'Respostas %',          desc: 'Calculado: Respostas / Aberturas',icon: '%', editavel: false, ant: fpct(getPct(id,'resp_pct','ant',ant.resp_pct)),  at: fpct(getPct(id,'resp_pct','at',at.resp_pct)),  ger: fpct(getPct(id,'resp_pct','ger',ger.resp_pct)),  diff: null },
  ]

  // Avanços — sempre inputs manuais, nunca preenchidos automaticamente pelo banco
  base.push(
    { key: 'encaminhamento', label: 'Encaminhamento', desc: 'Preencha manualmente', icon: '↗', editavel: true, ant: '—', at: '—', ger: '—', diff: null },
    { key: 'apresentacao',   label: 'Apresentação',   desc: 'Preencha manualmente', icon: '▣', editavel: true, ant: '—', at: '—', ger: '—', diff: null },
    { key: 'interessados',   label: 'Interessados',   desc: 'Preencha manualmente', icon: '☆', editavel: true, ant: '—', at: '—', ger: '—', diff: null },
  )

  base.push({ key: 'periodo', label: 'Período', desc: 'Período dos dados', icon: '📅', editavel: false,
    ant: `${fdata(form.anterior.inicio)} até ${fdata(form.anterior.fim)}`,
    at:  `${fdata(form.atual.inicio)} até ${fdata(form.atual.fim)}`,
    ger: `Desde ${fdata(form.geral.inicio)}`, diff: null })
  return base
}

</script>

<style scoped>
.periodo-label {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .05em; color: var(--muted); margin-bottom: 6px;
}
.periodo-label.brand { color: var(--brand); }

.campanha-row {
  padding: 8px 12px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px; font-size: 12px;
}
.campanha-row:last-child { border-bottom: none; }
.campanha-row.arquivada { opacity: 0.55; }
.badge-ativa     { font-size: 12px; color: var(--success); background: rgba(76,175,114,.15); padding: 1px 6px; border-radius: 10px; }
.badge-arquivada { font-size: 12px; color: var(--muted);   background: var(--bg);  padding: 1px 6px; border-radius: 10px; }

/* Cards de totais */
.totais-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
.total-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px; display: flex; flex-direction: column; gap: 4px;
}
.total-label { font-size: 12px; color: var(--muted); font-weight: 500; }
.total-val   { font-size: 26px; font-weight: 700; color: var(--text); }
.total-val.accent { color: var(--brand); }
.total-diff  { font-size: 12px; color: var(--muted); }
.diff-up   { color: #16a34a; }
.diff-down { color: #dc2626; }

/* Avanços mini */
.avancos-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.av-mini { background: var(--bg); border-radius: 6px; padding: 8px; text-align: center; }
.av-mini.brand   { background: var(--brand-light); }
.av-mini.success { background: rgba(76,175,114,.12); }
.av-mini.warning { background: rgba(255,167,38,.12); }
.av-num { font-size: 20px; font-weight: 700; color: var(--text); }
.av-mini.brand .av-num   { color: var(--brand); }
.av-mini.success .av-num { color: var(--success); }
.av-mini.warning .av-num { color: var(--warning); }
.av-lbl { font-size: 12px; color: var(--muted); margin-top: 2px; }

/* Tabela */
.metricas-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 900px; }
.metricas-table thead th { border-bottom: 1px solid var(--border); white-space: nowrap; }
.th-periodo {
  padding: 10px 8px; text-align: center; font-size: 12px; font-weight: 600;
  border-left: 2px solid var(--border);
}
.th-ant   { background: #1E1E1E; color: #999; }
.th-atual { background: rgba(255,107,0,.12) !important; color: #FF8C00 !important; }
.th-total { background: rgba(255,107,0,.22) !important; color: #FF6B00 !important; font-weight: 700; }
.sub-th-ant   { background: #1A1A1A !important; color: #777; }
.sub-th-atual { background: rgba(255,107,0,.08) !important; color: #FF8C00; }
.sub-th-total { background: rgba(255,107,0,.16) !important; color: #FF6B00; font-weight: 600; }
.periodo-badge {
  font-size: 12px; font-weight: 400; color: var(--muted);
}
.sub-th {
  padding: 5px 8px; text-align: right; font-size: 12px; color: var(--muted);
  font-weight: 500; border-bottom: 2px solid var(--border);
  border-left: 1px solid var(--border);
}
.nome-cell {
  padding: 9px 14px; font-weight: 500;
  max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: flex; align-items: center; gap: 6px;
}
.status-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.dot-ok   { background: #16a34a; }
.dot-zero { background: #d1d5db; }
.num-cell {
  padding: 9px 12px; text-align: right; cursor: pointer;
  font-variant-numeric: tabular-nums; border-left: 1px solid var(--border);
  white-space: nowrap;
}
.num-cell:hover { background: rgba(255,107,0,.18) !important; color: #FF6B00; }
.num-cell.pct   { color: var(--muted); font-size: 11px; }
.num-cell.total { font-weight: 700; }
.resp-ok   { color: #16a34a; font-weight: 600; }
.resp-zero { color: var(--muted); }
.metric-row { border-bottom: 1px solid var(--border); }
.metric-row:hover td, .metric-row:hover .nome-cell { background: #f8fafd; }
.row-zero .nome-cell { color: var(--muted); }
.total-row { background: rgba(255,107,0,.16); border-top: 2px solid #FF6B00; }
.total-row .nome-cell { color: #FF6B00; background: rgba(255,107,0,.16); }
.total-row .nome-cell { background: var(--brand-light); }
/* Visual novo das métricas - formato semelhante à tabela enviada */
.metricas-stack {
  display: flex;
  flex-direction: column;
  gap: 22px;
}
.metricas-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}
.total-metricas-card {
  border-color: var(--brand);
}
.metricas-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid #eef2f7;
  background: var(--color-background-secondary, var(--bg));
}
.metricas-card-title {
  color: var(--text);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.2;
}
.metricas-card-sub {
  color: var(--muted);
  font-size: 12px;
  margin-top: 3px;
}
.campaign-chip,
.copy-ok {
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.campaign-chip {
  color: var(--accent);
  background: var(--brand-light);
}
.copy-ok {
  color: var(--success);
  background: #dcfce7;
}
.metricas-resumo-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.metricas-resumo-table th {
  background: var(--brand);
  color: var(--on-accent);
  font-size: 15px;
  font-weight: 800;
  text-align: center;
  padding: 12px 10px;
  border-right: 1px solid rgba(255,255,255,.25);
}
.metricas-resumo-table th:first-child {
  border-top-left-radius: 10px;
}
.metricas-resumo-table th:last-child {
  border-top-right-radius: 10px;
  border-right: none;
}
.metricas-resumo-table th span {
  display: inline-block;
  margin-top: 3px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(26,18,16,.75);
}
.col-metrica { width: 32%; }
.period-col { width: 22.66%; }
.metricas-resumo-table td {
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.metricas-resumo-table tr:nth-child(even) td {
  background: var(--surface);
}
.metricas-resumo-table tr:hover td {
  background: var(--brand-light);
}
.metricas-resumo-table td:last-child { border-right: none; }
.metrica-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: var(--text);
}
.metrica-label strong {
  display: block;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}
.metrica-label small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.2;
}
.metric-icon {
  width: 34px;
  height: 34px;
  min-width: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--bg);
  color: var(--text);
  font-weight: 900;
  font-size: 15px;
}
.metric-value {
  padding: 12px 14px;
  text-align: center;
  font-size: 19px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  white-space: normal;
}
.metric-value.anterior { color: var(--brand); }
.metric-value.atual {
  color: var(--success);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 100%;
}
.metric-value.geral { color: #7c3aed; }
.metric-value:hover { background: var(--brand-light) !important; }
.diff-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}
.diff-pill.up {
  color: #166534;
  background: #dcfce7;
}
.diff-pill.down {
  color: #b91c1c;
  background: #fee2e2;
}
.diff-pill.neutral {
  color: #475569;
  background: var(--bg);
}

.edit-input {
  width: 72px; padding: 3px 6px; border: 1px solid var(--border);
  border-radius: 5px; font-size: 13px; font-weight: 600;
  text-align: right; background: var(--surface); color: var(--text);
  font-family: var(--font-mono, monospace);
  font-variant-numeric: tabular-nums;
  transition: border .15s;
  -moz-appearance: textfield;
}
.edit-input:hover { border-color: var(--brand); }
.edit-input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 2px rgba(15,91,166,.12); }
.edit-input::-webkit-outer-spin-button,
.edit-input::-webkit-inner-spin-button { -webkit-appearance: none; }

.manual-metric-input {
  width: 58px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  text-align: center;
  font-size: 16px;
  font-weight: 800;
  color: inherit;
  font-variant-numeric: tabular-nums;
}
.manual-metric-input:focus {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(15,91,166,.12);
}
.manual-metric-input::-webkit-outer-spin-button,
.manual-metric-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.manual-metric-input[type=number] {
  -moz-appearance: textfield;
}

@media (max-width: 980px) {
  .metricas-card { overflow-x: auto; }
  .metricas-resumo-table { min-width: 760px; }
  .totais-grid { grid-template-columns: 1fr 1fr; }
}

</style>
