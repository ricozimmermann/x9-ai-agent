# Changelog

## [0.2.0] - 2026-05-19

### Adicionado
- **Cache Hit Rate**: nova métrica lida do campo `cachedTokens` dos eventos `llm_request` (suportado pelo Claude e GPT-5.x)
- **Cache Hit por sessão**: percentual e quantidade de tokens servidos da cache do provider em cada sessão
- **Timestamp preciso de sessão**: usa o evento `session_start` como origem da duração, eliminando dependência do `min(ts)` de todos os eventos

### Performance interna
- **Cache de parsing por mtime**: `LogParser` evita releitura de disco quando `main.jsonl` não foi modificado (hit = apenas 1 `stat` por arquivo a cada refresh)
- **Cache TTL dos diretórios**: `getAllDebugLogDirs()` cacheia resultado por 60s para evitar rescan do `workspaceStorage` a cada 2s
- **`refresh()` sem `clear()`**: atualiza apenas sessões modificadas e remove as excluídas, sem descartar cache válido
- **`loadExistingLogs` corrigido**: eliminada chamada redundante a `getAllDebugLogDirs()` na inicialização

### Removido
- Métrica "Turnos Agênticos" (redundante com LLM Calls)

## [0.0.1] - 2026-05-16

### Adicionado
- Monitoramento em tempo real de métricas de agentes de IA
- Parser para logs OTLP JSON do Agent Debug Log
- Visualização de token usage (input/output)
- Contagem de requests e tool calls
- Rastreamento de modelos utilizados
- Indicador de duração de sessões
- Detecção de erros
- Painel webview com lista de sessões
- Botão toggle na status bar
- Configurações personalizáveis (auto-refresh, intervalo, etc)
- Histórico de sessões anteriores

### Recursos
- 📊 Estatísticas agregadas de todas as sessões
- 🔄 Atualização automática em tempo real
- 📋 Lista detalhada de sessões com métricas
- ⚙️ Configurações flexíveis
- 🎨 Interface adaptativa ao tema do VS Code
