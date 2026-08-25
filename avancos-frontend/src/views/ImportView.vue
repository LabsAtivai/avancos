<template>
  <div class="page">
    <div class="page-header">
      <div>
        <div class="page-title">Importar CSV</div>
        <div class="page-sub">Importa dados das planilhas de avanços (Ana Carolina, Latifi, Onboarding)</div>
      </div>
    </div>

    <!-- Steps -->
    <div class="steps">
      <div class="step" :class="{ active: step === 1, done: step > 1 }">
        <div class="step-num">{{ step > 1 ? '✓' : '1' }}</div>
        Enviar arquivo
      </div>
      <div class="step" :class="{ active: step === 2, done: step > 2 }">
        <div class="step-num">{{ step > 2 ? '✓' : '2' }}</div>
        Mapear colunas
      </div>
      <div class="step" :class="{ active: step === 3 }">
        <div class="step-num">3</div>
        Resultado
      </div>
    </div>

    <!-- Step 1: Upload -->
    <div v-if="step === 1" class="card card-body">
      <label class="upload-area" :class="{ drag: arrastando }"
        @dragover.prevent="arrastando = true"
        @dragleave="arrastando = false"
        @drop.prevent="onDrop"
      >
        <input type="file" accept=".csv" @change="onFileSelect" />
        <div style="font-size:32px;margin-bottom:12px">📂</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px">
          {{ arquivo ? arquivo.name : 'Clique ou arraste o arquivo CSV' }}
        </div>
        <div style="font-size:12px">Compatível com Ana Carolina, Latifi e Onboarding</div>
      </label>

      <div v-if="arquivo" style="margin-top:16px">
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Nome do arquivo (para salvar mapeamento)</label>
            <input v-model="nomeArquivo" class="form-control" placeholder="Ex: Ana Carolina" />
          </div>
          <div class="form-group">
            <label class="form-label">Tipo padrão (se não houver coluna tipo)</label>
            <select v-model="tipoDefault" class="form-control">
              <option value="">Sem padrão</option>
              <option value="Interessado">Interessado</option>
              <option value="Apresentação">Apresentação</option>
              <option value="Encaminhamento">Encaminhamento</option>
              <option value="Nutrição">Nutrição</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Cliente padrão (se não houver coluna cliente)</label>
          <input v-model="clienteDefault" class="form-control" placeholder="Deixe em branco se o CSV tem a coluna cliente" />
        </div>

        <div v-if="erro" class="alert alert-danger">{{ erro }}</div>

        <button class="btn btn-primary" :disabled="analisando" @click="analisar" style="margin-top:8px">
          {{ analisando ? 'Analisando...' : 'Analisar arquivo →' }}
        </button>
      </div>
    </div>

    <!-- Step 2: Mapeamento -->
    <div v-if="step === 2">
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          Mapeamento de colunas
          <span style="font-size:12px;font-weight:400;color:var(--muted);margin-left:8px">
            {{ analise.totalLinhas?.toLocaleString('pt-BR') }} linhas detectadas
          </span>
        </div>
        <div class="card-body">
          <div class="alert alert-info" style="margin-bottom:16px">
            Para cada coluna do CSV, selecione o campo correspondente no banco.
            Colunas marcadas como <strong>Ignorar</strong> não serão importadas.
          </div>
          <div class="table-wrap">
            <table class="map-table">
              <thead>
                <tr>
                  <th>Coluna no CSV</th>
                  <th>Prévia dos dados</th>
                  <th>Campo no banco</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, i) in mapeamento" :key="i">
                  <td><strong>{{ m.colunaCsv }}</strong></td>
                  <td class="preview-cell">{{ getPrevia(m.colunaCsv) }}</td>
                  <td>
                    <select v-model="m.campoBanco" class="form-control" style="width:200px">
                      <option v-for="c in campos" :key="c.valor" :value="c.valor">{{ c.label }}</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="erro" class="alert alert-danger">{{ erro }}</div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" @click="step = 1">← Voltar</button>
        <button class="btn btn-primary" :disabled="importando" @click="executar">
          {{ importando ? 'Importando...' : `Importar ${analise.totalLinhas?.toLocaleString('pt-BR')} registros →` }}
        </button>
      </div>
    </div>

    <!-- Step 3: Resultado -->
    <div v-if="step === 3" class="card card-body">
      <div v-if="resultado.inseridos > 0" class="alert alert-success" style="margin-bottom:16px">
        ✅ <strong>{{ resultado.inseridos.toLocaleString('pt-BR') }}</strong> registros importados com sucesso!
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
        <div class="metric success">
          <div class="metric-label">Inseridos</div>
          <div class="metric-value">{{ resultado.inseridos?.toLocaleString('pt-BR') }}</div>
        </div>
        <div class="metric warning">
          <div class="metric-label">Ignorados</div>
          <div class="metric-value">{{ resultado.ignorados?.toLocaleString('pt-BR') }}</div>
          <div class="metric-sub">linhas vazias ou inválidas</div>
        </div>
        <div class="metric" :class="resultado.erros?.length ? 'accent' : ''">
          <div class="metric-label">Erros</div>
          <div class="metric-value">{{ resultado.erros?.length || 0 }}</div>
        </div>
      </div>

      <div v-if="resultado.erros?.length" style="margin-bottom:16px">
        <h3 style="margin-bottom:8px;font-size:13px">Detalhes dos erros:</h3>
        <div style="background:var(--bg);border-radius:6px;padding:12px;font-size:12px;max-height:200px;overflow-y:auto">
          <div v-for="(e, i) in resultado.erros" :key="i" style="margin-bottom:4px;color:var(--danger)">{{ e }}</div>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" @click="reiniciar">Importar outro arquivo</button>
        <router-link to="/avancos" class="btn btn-outline">Ver avanços →</router-link>
      </div>
    </div>

    <!-- Histórico de mapeamentos salvos -->
    <div class="card" style="margin-top:24px" v-if="mapeamentosSalvos.length">
      <div class="card-header">Mapeamentos salvos</div>
      <div class="card-body" style="padding:0">
        <table>
          <thead>
            <tr><th>Arquivo</th><th>Colunas mapeadas</th><th style="width:80px"></th></tr>
          </thead>
          <tbody>
            <tr v-for="(grupo, nome) in mapeamentosAgrupados" :key="nome">
              <td><strong>{{ nome }}</strong></td>
              <td style="color:var(--muted);font-size:12px">{{ grupo.map(m => m.colunaCsv + ' → ' + m.campoBanco).join(', ') }}</td>
              <td>
                <button class="btn btn-ghost btn-sm" @click="deletarMapeamento(nome)">Remover</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { importApi } from '@/services/api'

const step          = ref(1)
const arquivo       = ref(null)
const nomeArquivo   = ref('')
const tipoDefault   = ref('Interessado')
const clienteDefault = ref('')
const analisando    = ref(false)
const importando    = ref(false)
const arrastando    = ref(false)
const erro          = ref('')
const analise       = ref({})
const mapeamento    = ref([])
const campos        = ref([])
const resultado     = ref({})
const mapeamentosSalvos = ref([])

onMounted(async () => {
  const [c, m] = await Promise.all([importApi.campos(), importApi.mapeamentos()])
  campos.value = c.data.campos
  mapeamentosSalvos.value = m.data
})

const mapeamentosAgrupados = computed(() => {
  const grupos = {}
  for (const m of mapeamentosSalvos.value) {
    if (!grupos[m.nomeArquivo]) grupos[m.nomeArquivo] = []
    grupos[m.nomeArquivo].push(m)
  }
  return grupos
})

function onFileSelect(e) {
  const f = e.target.files[0]
  if (f) setArquivo(f)
}

function onDrop(e) {
  arrastando.value = false
  const f = e.dataTransfer.files[0]
  if (f) setArquivo(f)
}

function setArquivo(f) {
  arquivo.value = f
  // Sugestão de nome baseada no nome do arquivo
  const nome = f.name
    .replace(/\.(csv|CSV)$/, '')
    .replace(/Avan[çc]os_Comerciais_-_Geral_-_/i, '')
    .replace(/Avan[çc]os_Comerciais_-__Onboarding__-_Squad_/i, '')
    .replace(/_/g, ' ')
    .trim()
  nomeArquivo.value = nome
}

async function analisar() {
  if (!arquivo.value) return
  erro.value = ''
  analisando.value = true
  try {
    const r = await importApi.analisar(arquivo.value)
    analise.value = r.data
    mapeamento.value = [...r.data.sugestao]
    step.value = 2
  } catch (e) {
    erro.value = e.response?.data?.message || 'Erro ao analisar o arquivo'
  } finally {
    analisando.value = false
  }
}

function getPrevia(colunaCsv) {
  if (!analise.value.previa?.length) return ''
  return analise.value.previa
    .map(linha => linha[colunaCsv] || '')
    .filter(v => v)
    .slice(0, 3)
    .join(' / ')
}

async function executar() {
  erro.value = ''
  importando.value = true
  try {
    const r = await importApi.executar(
      arquivo.value,
      nomeArquivo.value,
      mapeamento.value,
      tipoDefault.value,
      clienteDefault.value,
    )
    resultado.value = r.data
    step.value = 3
    // Atualiza mapeamentos salvos
    const m = await importApi.mapeamentos()
    mapeamentosSalvos.value = m.data
  } catch (e) {
    erro.value = e.response?.data?.message || 'Erro ao importar'
  } finally {
    importando.value = false
  }
}

async function deletarMapeamento(nome) {
  await importApi.deletarMapeamento(nome)
  const m = await importApi.mapeamentos()
  mapeamentosSalvos.value = m.data
}

function reiniciar() {
  step.value = 1
  arquivo.value = null
  nomeArquivo.value = ''
  tipoDefault.value = 'Interessado'
  clienteDefault.value = ''
  analise.value = {}
  mapeamento.value = []
  resultado.value = {}
  erro.value = ''
}
</script>
