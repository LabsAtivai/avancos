import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// ── Avanços ──────────────────────────────────────────────────────────────────

export const avancosApi = {
  listar:       (params) => api.get('/avancos', { params }),
  criar:        (data)   => api.post('/avancos', data),
  atualizar:    (id, data) => api.put(`/avancos/${id}`, data),
  excluir:      (id)     => api.delete(`/avancos/${id}`),
  opcoes:       ()       => api.get('/avancos/opcoes'),
  // estatisticas agora aceita: cliente, campanha, tipo, ano, dataInicio, dataFim
  estatisticas: (params) => api.get('/avancos/estatisticas', { params }),
  pptx:         (params) => api.get('/avancos/pptx', { params }),
}

// ── Import ────────────────────────────────────────────────────────────────────

export const importApi = {
  campos:            ()     => api.get('/import/campos'),
  mapeamentos:       ()     => api.get('/import/mapeamentos'),
  deletarMapeamento: (nome) => api.delete(`/import/mapeamentos/${encodeURIComponent(nome)}`),

  analisar: (file) => {
    const fd = new FormData()
    fd.append('arquivo', file)
    return api.post('/import/analisar', fd)
  },

  executar: (file, nomeArquivo, mapeamento, tipoDefault, clienteDefault) => {
    const fd = new FormData()
    fd.append('arquivo', file)
    fd.append('nomeArquivo', nomeArquivo)
    fd.append('mapeamento', JSON.stringify(mapeamento))
    if (tipoDefault)    fd.append('tipoDefault', tipoDefault)
    if (clienteDefault) fd.append('clienteDefault', clienteDefault)
    return api.post('/import/executar', fd, { timeout: 120000 })
  },
}

export default api
