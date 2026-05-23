# X9 - AI Agent Monitor

Extensão para monitorar o consumo de recursos de agentes de IA do GitHub Copilot no VS Code.

## Funcionalidades

- 📊 **Métricas em tempo real**: token usage (input/output), LLM calls, tool calls e erros
- 🚀 **Cache Hit Rate**: percentual de tokens servidos da cache do provider (Claude, GPT-5.x) por sessão e no agregado — mostra quanto do seu contexto está sendo reutilizado
- ⏱️ **Duração**: tempo total de cada sessão
- 🔧 **Tool calls**: ferramentas invocadas pelos agentes
- ❌ **Erros**: monitoramento de falhas durante execução
- 📜 **Histórico**: sessões de todos os workspaces agregadas em uma única view
- 📅 **Filtros de período**: mês atual, últimos 7 dias ou todo o histórico
- 💡 **Interface na barra lateral**: painel fixo na Activity Bar do VS Code

## Como usar

1. Habilite o logging do Copilot:
   - Configure `github.copilot.chat.agentDebugLog.fileLogging.enabled` como `true`
2. Clique no ícone **X9** na barra de atividades (lateral esquerda do VS Code)
3. Visualize as métricas das suas sessões de IA em tempo real

## Métricas exibidas

| Métrica | Descrição |
|---|---|
| Total de Tokens | Soma de todos os tokens (input + output) de todas as sessões |
| Cache Hit Rate | % de tokens de input servidos da cache do provider LLM |
| Msgs (≈ Premium Req) | Mensagens enviadas pelo usuário (proxy de requisições premium) |
| LLM Calls Internas | Total de chamadas ao modelo (inclui chamadas agênticas internas) |
| Tool Calls | Invocações de ferramentas pelos agentes |
| Erros | Falhas detectadas nos eventos de log |

> **Cache Hit Rate** é lido diretamente do campo `cachedTokens` nos eventos de log do Copilot. Modelos que não expõem esse campo (ex: Gemini, GPT-4o) exibem `0%`.

## Requisitos

- Visual Studio Code >= 1.95.0
- GitHub Copilot instalado
- Agent Debug Log habilitado

## Configurações

| Configuração | Padrão | Descrição |
|---|---|---|
| `x9.autoRefresh` | `true` | Atualizar métricas automaticamente |
| `x9.refreshInterval` | `2000` | Intervalo de atualização em ms |

## Desenvolvimento

```bash
npm install
npm run compile
# F5 para debug no VS Code
```

**Observação**: A arquitetura e as funcionalidades do projeto foram elaboradas pelo autor e o código foi escrito com auxílio de IA.

## Licença

MIT
