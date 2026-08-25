<template>
  <div class="cliente-select" ref="wrapper">
    <div class="cs-input" @click="abrir" :class="{ open: isOpen }">
      <span class="cs-value">{{ valorExibido }}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>

    <div v-if="isOpen" class="cs-dropdown">
      <div class="cs-search-wrap">
        <input
          ref="inputRef"
          v-model="busca"
          class="cs-search"
          placeholder="Buscar cliente..."
          @keydown.escape="fechar"
          @keydown.enter="selecionarPrimeiro"
        />
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="cs-search-icon">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      <div class="cs-list">
        <div
          class="cs-option cs-option-todos"
          :class="{ selected: !modelValue }"
          @click="selecionar('')"
        >
          Todos os clientes
        </div>

        <div v-if="!filtrados.length" class="cs-empty">Nenhum resultado</div>

        <div
          v-for="c in filtrados"
          :key="c.valor"
          class="cs-option"
          :class="{ selected: modelValue === c.valor }"
          @click="selecionar(c.valor)"
        >
          <span class="cs-nome">{{ c.valor }}</span>
          <span class="cs-total">{{ c.total }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

const props = defineProps({
  modelValue: String,
  clientes: Array,   // [{valor, total}]
})
const emit = defineEmits(['update:modelValue'])

const isOpen   = ref(false)
const busca    = ref('')
const wrapper  = ref(null)
const inputRef = ref(null)

const valorExibido = computed(() => {
  if (!props.modelValue) return 'Todos os clientes'
  const c = props.clientes?.find(c => c.valor === props.modelValue)
  return c ? `${c.valor} (${c.total})` : props.modelValue
})

const filtrados = computed(() => {
  if (!props.clientes) return []
  const q = busca.value.toLowerCase().trim()
  if (!q) return props.clientes
  return props.clientes.filter(c => c.valor.toLowerCase().includes(q))
})

function abrir() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    busca.value = ''
    nextTick(() => inputRef.value?.focus())
  }
}

function fechar() {
  isOpen.value = false
  busca.value  = ''
}

function selecionar(valor) {
  emit('update:modelValue', valor)
  fechar()
}

function selecionarPrimeiro() {
  if (filtrados.value.length) selecionar(filtrados.value[0].valor)
  else if (!busca.value) selecionar('')
}

// Fecha ao clicar fora
function onClickOutside(e) {
  if (wrapper.value && !wrapper.value.contains(e.target)) fechar()
}
onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<style scoped>
.cliente-select { position: relative; min-width: 220px; }

.cs-input {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 10px; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--surface);
  font-size: 13px; cursor: pointer; gap: 6px;
  transition: border .15s;
  user-select: none;
}
.cs-input:hover { border-color: var(--brand); }
.cs-input.open  { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(15,91,166,.12); }
.cs-input svg   { flex-shrink: 0; color: var(--muted); transition: transform .15s; }
.cs-input.open svg { transform: rotate(180deg); }
.cs-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cs-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  z-index: 200; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
  min-width: 260px;
}

.cs-search-wrap {
  position: relative; padding: 8px;
  border-bottom: 1px solid var(--border);
}
.cs-search {
  width: 100%; padding: 7px 30px 7px 10px;
  border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; font-family: inherit; outline: none;
  background: var(--bg); color: var(--text);
}
.cs-search::placeholder { color: var(--muted); }
.cs-search:focus { border-color: var(--brand); }
.cs-search-icon {
  position: absolute; right: 18px; top: 50%; transform: translateY(-50%);
  color: var(--muted); pointer-events: none;
}

.cs-list { max-height: 280px; overflow-y: auto; }

.cs-option {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; font-size: 13px; cursor: pointer;
  gap: 8px; transition: background .1s;
}
.cs-option:hover    { background: var(--brand-light); }
.cs-option.selected { background: var(--brand-light); color: var(--brand); font-weight: 500; }
.cs-option-todos    { color: var(--muted); border-bottom: 1px solid var(--border); }
.cs-option-todos.selected { color: var(--brand); }

.cs-nome { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-total {
  flex-shrink: 0; font-size: 12px; color: var(--muted);
  background: var(--bg); border-radius: 10px;
  padding: 1px 7px; font-weight: 500;
}
</style>
