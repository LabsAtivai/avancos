<template>
  <div class="page">
    <div class="page-header">
      <div>
        <div class="page-title">Gráficos</div>
        <div class="page-sub">Análise visual dos avanços comerciais</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-body" style="padding:16px">
        <div class="form-row cols-4">
          <div class="form-group" style="margin:0">
            <label class="form-label">Cliente</label>
            <MultiClienteSelect
              v-model="filtros.clientes"
              :clientes="opcoes.clientes"
              placeholder="Todos os clientes"
              @update:modelValue="carregar"
            />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Fonte</label>
            <select v-model="filtros.campanha" class="form-control" @change="carregar">
              <option value="">Todas</option>
              <option v-for="c in opcoes.campanhas" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Tipo</label>
            <select v-model="filtros.tipo" class="form-control" @change="carregar">
              <option value="">Todos</option>
              <option v-for="t in opcoes.tipos" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Ano</label>
            <select v-model="filtros.ano" class="form-control" @change="carregar">
              <option value="">Todos</option>
              <option v-for="a in opcoes.anos" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
        </div>
        <div class="form-row cols-4" style="margin-top:10px">
          <div class="form-group" style="margin:0">
            <label class="form-label">De</label>
            <input v-model="filtros.dataInicio" type="date" class="form-control" @change="carregar" />
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Até</label>
            <input v-model="filtros.dataFim" type="date" class="form-control" @change="carregar" />
          </div>
            <div class="form-group" style="margin:0;display:flex;align-items:flex-end;gap:8px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--color-text-secondary)">
              <input type="checkbox" v-model="ocultarVazios" style="cursor:pointer" />
              Ocultar sem segmento/cargo
            </label>
            <button class="btn btn-ghost btn-sm" @click="limparFiltros">Limpar</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="carregando" class="loading"><div class="spinner"></div> Carregando...</div>

    <template v-else>
      <!-- Métricas -->
      <div class="metrics" style="margin-bottom:20px">
        <div class="metric brand">
          <div class="metric-label">Total</div>
          <div class="metric-value">{{ fnum(totalGeral) }}</div>
        </div>
        <div v-for="t in tiposMeta" :key="t.tipo" class="metric" :class="t.classe">
          <div class="metric-label">{{ t.tipo }}</div>
          <div class="metric-value">{{ fnum(t.total) }}</div>
          <div class="metric-sub">{{ totalGeral ? Math.round(t.total / totalGeral * 100) : 0 }}%</div>
        </div>
      </div>

      <!-- Gráficos linha 1 -->
      <div class="charts-grid" style="margin-bottom:20px">
        <div class="card">
          <div class="card-header">Por tipo</div>
          <div class="card-body" style="height:280px;display:flex;align-items:center;justify-content:center">
            <Pie v-if="chartTipo.labels?.length" :data="chartTipo" :options="pieOpts" style="max-height:240px" />
            <div v-else class="empty"><div class="empty-text">Sem dados</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Por segmento (top 12)</div>
          <div class="card-body" style="height:280px;display:flex;align-items:center;justify-content:center">
            <Pie v-if="chartSegmento.labels?.length" :data="chartSegmento" :options="pieOpts" style="max-height:240px" />
            <div v-else class="empty"><div class="empty-text">Sem dados</div></div>
          </div>
        </div>
      </div>

      <!-- Gráficos linha 2 -->
      <div class="charts-grid" style="margin-bottom:20px">
        <div class="card">
          <div class="card-header">Por cargo (top 10)</div>
          <div class="card-body" style="height:280px;display:flex;align-items:center;justify-content:center">
            <Pie v-if="chartCargo.labels?.length" :data="chartCargo" :options="pieOpts" style="max-height:240px" />
            <div v-else class="empty"><div class="empty-text">Sem dados</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Evolução mensal</div>
          <div class="card-body" style="height:280px;display:flex;align-items:center;justify-content:center">
            <Bar v-if="chartMensal.labels?.length" :data="chartMensal" :options="barOpts" style="max-height:240px;width:100%" />
            <div v-else class="empty"><div class="empty-text">Sem dados</div></div>
          </div>
        </div>
      </div>

      <!-- Ranking segmentos -->
      <div class="card">
        <div class="card-header">Ranking de segmentos</div>
        <div class="card-body" style="padding:0">
          <table>
            <thead>
              <tr><th>#</th><th>Segmento</th><th>Qtd</th><th>%</th></tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in topSegmentos" :key="s.segmento">
                <td style="color:var(--muted)">{{ i + 1 }}</td>
                <td>{{ s.segmento }}</td>
                <td><strong>{{ fnum(parseInt(s.total)) }}</strong></td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="flex:1;background:var(--bg);border-radius:4px;height:6px">
                      <div :style="`width:${s.pct}%;background:var(--brand);border-radius:4px;height:6px`"></div>
                    </div>
                    <span style="font-size:12px;color:var(--muted);min-width:36px">{{ s.pct }}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import MultiClienteSelect from '@/components/MultiClienteSelect.vue'
import { ref, reactive, computed, onMounted } from 'vue'
import { Pie, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
} from 'chart.js'
import { avancosApi } from '@/services/api'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const carregando   = ref(false)
const ocultarVazios = ref(true)
const stats        = ref({ porTipo: [], porSegmento: [], porCargo: [], porMes: [] })
const opcoes     = reactive({ clientes: [], campanhas: [], tipos: [], anos: [] })

const filtros = reactive({
  clientes: [], // array — suporta múltiplos
  campanha: '', tipo: '',
  ano: '', dataInicio: '', dataFim: '',
})

const CORES = [
  '#1e40af','#15803d','#d97706','#9d174d','#0f766e',
  '#7c3aed','#b91c1c','#0369a1','#4d7c0f','#92400e',
  '#5b21b6','#065f46',
]

onMounted(async () => {
  const r = await avancosApi.opcoes()
  Object.assign(opcoes, r.data)
  await carregar()
})

async function carregar() {
  carregando.value = true
  try {
    const params = {}
    if (filtros.clientes?.length) params.clientes = filtros.clientes.join('|')
    if (filtros.campanha)   params.campanha   = filtros.campanha
    if (filtros.tipo)       params.tipo       = filtros.tipo
    if (filtros.ano)        params.ano        = filtros.ano
    if (filtros.dataInicio) params.dataInicio = filtros.dataInicio
    if (filtros.dataFim)    params.dataFim    = filtros.dataFim

    const r = await avancosApi.estatisticas(params)
    stats.value = r.data
  } finally {
    carregando.value = false
  }
}

function limparFiltros() {
  Object.assign(filtros, { clientes: [], campanha: '', tipo: '', ano: '', dataInicio: '', dataFim: '' })
  carregar()
}

const totalGeral = computed(() =>
  (stats.value.porTipo || []).reduce((s, r) => s + parseInt(r.total), 0)
)

const tiposMeta = computed(() => {
  const cls = { 'Interessado':'success', 'Apresentação':'', 'Encaminhamento':'warning', 'Nutrição':'accent' }
  return (stats.value.porTipo || []).map(t => ({
    tipo: t.tipo, total: parseInt(t.total), classe: cls[t.tipo] || '',
  }))
})

const topSegmentos = computed(() => {
  let rows = stats.value.porSegmento || []
  if (ocultarVazios.value) {
    rows = rows.filter(r => {
      const v = (r.segmento || '').trim()
      return v !== '' && v !== '-' && v !== '--'
    })
  }
  const total = rows.reduce((s, r) => s + parseInt(r.total), 0)
  return rows.slice(0, 15).map(r => ({
    segmento: r.segmento,
    total: r.total,
    pct: total ? Math.round(parseInt(r.total) / total * 100) : 0,
  }))
})

function buildPie(rows, labelKey) {
  if (!rows?.length) return { labels: [], datasets: [] }
  let filtered = rows
  if (ocultarVazios.value) {
    filtered = rows.filter(r => {
      const v = (r[labelKey] || '').trim()
      return v !== '' && v !== '-' && v !== '--' && v.toLowerCase() !== 'null'
    })
  }
  const top = filtered.slice(0, 12)
  return {
    labels: top.map(r => r[labelKey] || 'Sem info'),
    datasets: [{
      data: top.map(r => parseInt(r.total)),
      backgroundColor: CORES,
      borderWidth: 1,
      borderColor: '#fff',
    }],
  }
}

const chartTipo     = computed(() => buildPie(stats.value.porTipo, 'tipo'))
const chartSegmento = computed(() => buildPie(stats.value.porSegmento, 'segmento'))
const chartCargo    = computed(() => buildPie(stats.value.porCargo, 'cargo'))

const chartMensal = computed(() => {
  const rows = stats.value.porMes || []
  if (!rows.length) return { labels: [], datasets: [] }

  const meses = [...new Set(rows.map(r => r.mes))].sort()
  const tipos = ['Interessado', 'Apresentação', 'Encaminhamento', 'Nutrição']
  const coresTipo = {
    'Interessado':    '#1e40af',
    'Apresentação':   '#15803d',
    'Encaminhamento': '#d97706',
    'Nutrição':       '#9d174d',
  }

  return {
    labels: meses.map(m => {
      const [y, mo] = m.split('-')
      return new Date(y, mo - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    }),
    datasets: tipos.map(tipo => ({
      label: tipo,
      data: meses.map(mes => {
        const r = rows.find(r => r.mes === mes && r.tipo === tipo)
        return r ? parseInt(r.total) : 0
      }),
      backgroundColor: coresTipo[tipo] + 'cc',
      borderColor: coresTipo[tipo],
      borderWidth: 1,
    })),
  }
})

const pieOpts = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { position: 'right', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${ctx.label}: ${ctx.raw.toLocaleString('pt-BR')}`,
      },
    },
  },
}

const barOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { stacked: true, ticks: { font: { size: 10 } } },
  },
}

function fnum(n) {
  return (n || 0).toLocaleString('pt-BR')
}
</script>
