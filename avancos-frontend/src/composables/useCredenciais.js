import { ref } from 'vue'
import api from '@/services/api'

/**
 * Composable reutilizável para auto-fill de credenciais Snov.io
 * Uso: const { snovId, snovSecret, carregarCredenciais, carregando } = useCredenciais()
 */
export function useCredenciais() {
  const snovId     = ref('')
  const snovSecret = ref('')
  const carregando = ref(false)
  const encontrado = ref(false)

  async function carregarCredenciais(cliente) {
    if (!cliente?.trim()) return

    carregando.value = true
    encontrado.value = false

    try {
      const r = await api.get('/credenciais/buscar', {
        params: { cliente: cliente.trim() }
      })

      // client_id e client_secret do banco são do Snov.io API
      const snId  = r.data?.clientId
      const snSec = r.data?.clientSecret
      if (snId) {
        if (!snovId.value)     snovId.value     = snId
        if (!snovSecret.value) snovSecret.value = snSec || ''
        encontrado.value = true
      }
    } catch {
      // Silencioso — credenciais não cadastradas é situação normal
    } finally {
      carregando.value = false
    }
  }

  function limparCredenciais() {
    snovId.value     = ''
    snovSecret.value = ''
    encontrado.value = false
  }

  return { snovId, snovSecret, carregando, encontrado, carregarCredenciais, limparCredenciais }
}
