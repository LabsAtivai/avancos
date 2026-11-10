# Avanços Comerciais — Backend API

Sistema de avanços comerciais da Ativa.ai. NestJS + MySQL.

## Pré-requisitos

- Node.js 20+
- MySQL rodando no VPS (banco criado via HeidiSQL com o arquivo `avancos_comerciais.sql`)
- Docker + Portainer (para deploy)

## Setup local / desenvolvimento

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais do MySQL

# 3. Rodar em modo dev
npm run start:dev
```

API disponível em `http://localhost:3001/api`

## Deploy no VPS via Portainer

```bash
# 1. Subir o arquivo .env com as credenciais reais

# 2. Build e subir
docker compose up -d --build
```

## Endpoints principais

### Avanços
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/avancos | Lista com filtros e paginação |
| POST | /api/avancos | Cria um avanço |
| PUT | /api/avancos/:id | Edita |
| DELETE | /api/avancos/:id | Remove |
| GET | /api/avancos/opcoes | Valores únicos para dropdowns |
| GET | /api/avancos/estatisticas | Dados para gráficos |
| GET | /api/avancos/pptx | Dados para gerador de PPTX |

### Import de CSV
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/import/analisar | Envia CSV, recebe colunas + sugestão de mapeamento |
| POST | /api/import/executar | Confirma mapeamento e importa os dados |
| GET | /api/import/mapeamentos | Lista mapeamentos salvos |
| DELETE | /api/import/mapeamentos/:nome | Remove mapeamento salvo |
| GET | /api/import/campos | Lista campos disponíveis no banco |

### Integração do Painel de Campanhas (somente leitura)
Autenticação exclusiva de serviço: header `X-API-Key: <chave>` (nome configurável por `PAINEL_API_KEY_HEADER`). A chave vem de `PAINEL_API_KEY`; sem ela a integração responde `503`. Chave nunca vai em query string. Rate limit por IP: `PAINEL_RATE_LIMIT_POR_MIN` (padrão 120) → `429` com `Retry-After`.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/integracoes/painel/v1/resumo | `dataInicio`, `dataFim` (YYYY-MM-DD, inclusivo, máx. 366 dias), `cliente` repetível (exato), `cursor` opcional. Retorna `dias[]` com `{cliente, data, total, porTipo}` |
| GET | /api/integracoes/painel/v1/status | `dias` (1–30, padrão 3), `excluirHoje` (padrão true, fuso America/Sao_Paulo). Conta só `Interessado`. Retorna `registros[]` com `{cliente, interessados, status}`; `status` = `verde` (≥2) / `amarelo` (1) / `vermelho` (0) / `sem_vinculo` |
| GET | /api/integracoes/painel/v1/clientes | Lista somente `{cliente, snovEmail}` ativos para mapear contas sem transferir segredos |
| GET | /api/integracoes/painel/v1/health | `{status, versao, geradoEm}`; `503` sem detalhes se o banco cair |

Clientes "vinculados" são os de `credenciais_clientes` (somente nome e e-mail Snov ativos são lidos). Falha de consulta responde `503`, nunca vermelho/zero.

CORS: `CORS_ORIGINS` (lista separada por vírgula). Sem a variável, nenhum cabeçalho CORS é emitido.

## Fluxo de import de CSV

### Passo 1 — Analisar
```
POST /api/import/analisar
Content-Type: multipart/form-data
arquivo: <arquivo.csv>
```

Retorno:
```json
{
  "nomeArquivo": "Ana Carolina",
  "cabecalho": ["Cliente", "Fonte", "Nome", ...],
  "sugestao": [
    { "colunaCsv": "Cliente", "campoBanco": "cliente" },
    { "colunaCsv": "Fonte",   "campoBanco": "campanha" },
    { "colunaCsv": "Nome",    "campoBanco": "nomeLead" },
    ...
  ],
  "previa": [...],
  "totalLinhas": 37093
}
```

### Passo 2 — Executar
```
POST /api/import/executar
Content-Type: multipart/form-data
arquivo: <arquivo.csv>
nomeArquivo: "Ana Carolina"
tipoDefault: "Interessado"
mapeamento: '[{"colunaCsv":"Cliente","campoBanco":"cliente"}, ...]'
```

Retorno:
```json
{
  "inseridos": 35529,
  "ignorados": 1564,
  "erros": ["Linha 5: data inválida..."]
}
```

## Integração com gerador de PPTX

Adicionar em `gerar_relatorios.py`:

```python
import requests

def get_avancos_pptx(cliente, date_from, date_to, api_url="http://localhost:3001"):
    r = requests.get(f"{api_url}/api/avancos/pptx", params={
        "cliente": cliente,
        "dataInicio": date_from,
        "dataFim": date_to,
    })
    return r.json()
    # Retorna: { interessado, apresentacao, encaminhamento, nutricao, total }
```
