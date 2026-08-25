<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ avanco ? 'Editar avanço' : 'Novo avanço' }}</h2>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Cliente *</label>
            <input v-model="form.cliente" class="form-control" placeholder="Nome do cliente" list="clientes-list" />
            <datalist id="clientes-list">
              <option v-for="c in opcoes.clientes" :key="c" :value="c" />
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Tipo *</label>
            <select v-model="form.tipo" class="form-control">
              <option value="">Selecione</option>
              <option v-for="t in opcoes.tipos" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Nome do lead</label>
            <input v-model="form.nomeLead" class="form-control" placeholder="Nome completo" />
          </div>
          <div class="form-group">
            <label class="form-label">Cargo</label>
            <input v-model="form.cargo" class="form-control" placeholder="Cargo" />
          </div>
        </div>

        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Empresa</label>
            <input v-model="form.empresa" class="form-control" placeholder="Empresa" />
          </div>
          <div class="form-group">
            <label class="form-label">Segmento</label>
            <input v-model="form.segmento" class="form-control" placeholder="Segmento" list="segmentos-list" />
            <datalist id="segmentos-list">
              <option v-for="s in opcoes.segmentos" :key="s" :value="s" />
            </datalist>
          </div>
        </div>

        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Fonte</label>
            <input v-model="form.campanha" class="form-control" placeholder="Fonte" list="campanhas-list" />
            <datalist id="campanhas-list">
              <option v-for="c in opcoes.campanhas" :key="c" :value="c" />
            </datalist>
          </div>
          <div class="form-group">
            <label class="form-label">Data do avanço *</label>
            <input v-model="form.dataAvanco" type="date" class="form-control" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Responsável</label>
          <input v-model="form.responsavel" class="form-control" placeholder="Quem identificou" list="resp-list" />
          <datalist id="resp-list">
            <option v-for="r in opcoes.responsaveis" :key="r" :value="r" />
          </datalist>
        </div>

        <div class="form-row cols-2">
          <div class="form-group">
            <label class="form-label">Tamanho</label>
            <input v-model="form.porte" class="form-control" placeholder="Ex: Micro, Pequena, Grande..." />
          </div>
          <div class="form-group">
            <label class="form-label">📅 Follow-up</label>
            <input v-model="form.dataFollowup" type="datetime-local" class="form-control" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Tratativa</label>
          <textarea v-model="form.tratativa" class="form-control" rows="2" placeholder="Anotações sobre a tratativa..."></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Observação</label>
          <textarea v-model="form.observacao" class="form-control" rows="2" placeholder="Observações adicionais"></textarea>
        </div>

        <div v-if="erro" class="alert alert-danger">{{ erro }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost" @click="$emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="salvando" @click="salvar">
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { avancosApi } from '@/services/api'

const props = defineProps({ avanco: Object, opcoes: Object })
const emit = defineEmits(['close', 'saved'])

const salvando = ref(false)
const erro = ref('')

function toDatetimeLocal(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  const offset = dt.getTimezoneOffset() * 60000
  return new Date(dt - offset).toISOString().slice(0, 16)
}

const form = reactive({
  cliente:     props.avanco?.cliente     || '',
  tipo:        props.avanco?.tipo        || '',
  nomeLead:    props.avanco?.nomeLead    || '',
  cargo:       props.avanco?.cargo       || '',
  empresa:     props.avanco?.empresa     || '',
  segmento:    props.avanco?.segmento    || '',
  campanha:    props.avanco?.campanha    || '',
  dataAvanco:  props.avanco?.dataAvanco  || new Date().toISOString().slice(0, 10),
  responsavel: props.avanco?.responsavel || '',
  observacao:  props.avanco?.observacao  || '',
  porte:       props.avanco?.porte       || '',
  dataFollowup: toDatetimeLocal(props.avanco?.dataFollowup),
  tratativa:   props.avanco?.tratativa   || '',
})

async function salvar() {
  erro.value = ''
  if (!form.cliente) return (erro.value = 'Cliente obrigatório')
  if (!form.tipo)    return (erro.value = 'Tipo obrigatório')
  if (!form.dataAvanco) return (erro.value = 'Data obrigatória')

  salvando.value = true
  try {
    const payload = { ...form }
    if (!payload.dataFollowup) payload.dataFollowup = null
    if (props.avanco) {
      await avancosApi.atualizar(props.avanco.id, payload)
    } else {
      await avancosApi.criar(payload)
    }
    emit('saved')
  } catch (e) {
    erro.value = e.response?.data?.message || 'Erro ao salvar'
  } finally {
    salvando.value = false
  }
}
</script>
