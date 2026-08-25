<template>
  <div class="mcs" ref="wrapper">
    <!-- Input trigger -->
    <div class="mcs-trigger" @click="toggle" :class="{ open: isOpen, 'has-value': selected.length }">
      <div class="mcs-tags" v-if="selected.length">
        <span v-for="s in selected.slice(0,2)" :key="s" class="mcs-tag">
          {{ s }}
          <button @click.stop="remover(s)" class="mcs-tag-x">×</button>
        </span>
        <span v-if="selected.length > 2" class="mcs-tag mcs-tag-more">
          +{{ selected.length - 2 }}
        </span>
      </div>
      <span v-else class="mcs-placeholder">{{ placeholder }}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" class="mcs-arrow" :class="{ rotated: isOpen }">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>

    <!-- Dropdown -->
    <div v-if="isOpen" class="mcs-dropdown">
      <!-- Busca -->
      <div class="mcs-search-wrap">
        <input ref="searchRef" v-model="busca" class="mcs-search"
               placeholder="Buscar..." @keydown.escape="fechar" />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" class="mcs-search-icon">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      <!-- Ações rápidas -->
      <div class="mcs-actions">
        <button @click="selecionarTodos" class="mcs-action-btn">Todos</button>
        <button @click="limparLocal"      class="mcs-action-btn">Limpar</button>
        <button @click="aplicar"          class="mcs-action-btn mcs-apply">Aplicar</button>
        <span class="mcs-count">{{ selected.length }} selecionado(s)</span>
      </div>

      <!-- Lista -->
      <div class="mcs-list">
        <div v-if="!filtrados.length" class="mcs-empty">Nenhum resultado</div>
        <label v-for="c in filtrados" :key="c.valor" class="mcs-item">
          <input type="checkbox" :value="c.valor" v-model="selected" />
          <span class="mcs-nome">{{ c.valor }}</span>
          <span class="mcs-total">{{ c.total }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  clientes:   { type: Array, default: () => [] },
  placeholder:{ type: String, default: 'Todos os clientes' },
})
const emit = defineEmits(['update:modelValue'])

const isOpen    = ref(false)
const busca     = ref('')
const wrapper   = ref(null)
const searchRef = ref(null)
const selected  = ref([...props.modelValue])

watch(() => props.modelValue, v => { selected.value = [...v] })

const filtrados = computed(() => {
  const q = busca.value.toLowerCase().trim()
  if (!q) return props.clientes
  return props.clientes.filter(c => c.valor.toLowerCase().includes(q))
})

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    busca.value = ''
    nextTick(() => searchRef.value?.focus())
  }
}

function fechar() { isOpen.value = false }

function aplicar() {
  emit('update:modelValue', [...selected.value])
  fechar()
}

function remover(val) {
  selected.value = selected.value.filter(s => s !== val)
  emit('update:modelValue', [...selected.value])
}

function selecionarTodos() {
  selected.value = filtrados.value.map(c => c.valor)
}

function limparLocal() { selected.value = [] }

function onClickOutside(e) {
  if (wrapper.value && !wrapper.value.contains(e.target)) fechar()
}
onMounted(()  => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<style scoped>
.mcs { position: relative; }

.mcs-trigger {
  min-height: 36px; padding: 5px 32px 5px 10px;
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--surface); cursor: pointer; position: relative;
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  transition: border .15s;
}
.mcs-trigger:hover, .mcs-trigger.open { border-color: var(--brand); }
.mcs-trigger.open { box-shadow: 0 0 0 3px rgba(15,91,166,.1); }

.mcs-arrow {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  color: var(--muted); transition: transform .15s; flex-shrink: 0;
}
.mcs-arrow.rotated { transform: translateY(-50%) rotate(180deg); }

.mcs-tags { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
.mcs-tag {
  display: inline-flex; align-items: center; gap: 3px;
  background: var(--brand); color: var(--on-accent);
  font-size: 12px; padding: 2px 6px; border-radius: 10px; font-weight: 500;
  max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mcs-tag-more { background: var(--muted); }
.mcs-tag-x {
  background: none; border: none; color: var(--on-accent); cursor: pointer;
  padding: 0; font-size: 13px; line-height: 1; opacity: .8;
}
.mcs-tag-x:hover { opacity: 1; }
.mcs-placeholder { font-size: 13px; color: var(--muted); }

.mcs-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; min-width: 260px;
  z-index: 300; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
}

.mcs-search-wrap { position: relative; padding: 8px; border-bottom: 1px solid var(--border); }
.mcs-search {
  width: 100%; padding: 6px 28px 6px 10px;
  border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; font-family: inherit; outline: none;
  background: var(--bg); color: var(--text);
}
.mcs-search::placeholder { color: var(--muted); }
.mcs-search:focus { border-color: var(--brand); }
.mcs-search-icon {
  position: absolute; right: 18px; top: 50%; transform: translateY(-50%);
  color: var(--muted); pointer-events: none;
}

.mcs-actions {
  display: flex; align-items: center; gap: 6px; padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.mcs-action-btn {
  font-size: 12px; padding: 2px 8px; border: 1px solid var(--border);
  border-radius: 4px; background: var(--bg); cursor: pointer; color: var(--muted);
}
.mcs-action-btn:hover { border-color: var(--brand); color: var(--brand); }
.mcs-apply { background: var(--brand); color: var(--on-accent); border-color: var(--brand); }
.mcs-apply:hover { color: var(--on-accent); }
.mcs-count { font-size: 12px; color: var(--muted); margin-left: auto; }

.mcs-list { max-height: 260px; overflow-y: auto; }
.mcs-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; cursor: pointer; font-size: 13px;
}
.mcs-item:hover { background: var(--brand-light); }
.mcs-item input { cursor: pointer; flex-shrink: 0; }
.mcs-nome { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mcs-total {
  font-size: 12px; color: var(--muted); background: var(--bg);
  padding: 1px 6px; border-radius: 10px; flex-shrink: 0;
}
.mcs-empty { padding: 16px; text-align: center; color: var(--muted); font-size: 13px; }
</style>
