import * as vscode from "vscode";
import { SessionMetrics } from "./types";

export class WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "x9.sidebarView";

  private view: vscode.WebviewView | undefined;
  private currentMetrics: SessionMetrics[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Chamado pelo VS Code ao resolver a sidebar view
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

        const nonce = getNonce();

    webviewView.webview.options = {
      enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
    };

        webviewView.webview.html = this.getHtmlContent(
            webviewView.webview,
            nonce,
        );

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });

    // Enviar métricas atuais assim que a view for resolvida
    if (this.currentMetrics.length > 0) {
      this.sendMetrics(this.currentMetrics);
    }
  }

  /**
   * Foca/revela a sidebar view
   */
  show() {
    if (this.view) {
      this.view.show(true);
    } else {
      vscode.commands.executeCommand("x9.sidebarView.focus");
    }
  }

  /**
   * Verifica se a view está visível
   */
  isVisible(): boolean {
    return this.view?.visible ?? false;
  }

  /**
   * Atualiza as métricas na sidebar
   */
  updateMetrics(metrics: SessionMetrics[]) {
    this.currentMetrics = metrics;
    this.sendMetrics(metrics);
  }

  private sendMetrics(metrics: SessionMetrics[]) {
    if (this.view) {
      this.view.webview.postMessage({
        type: "updateMetrics",
        metrics: metrics,
      });
    }
  }

  /**
   * Gera o HTML do painel
   */
    private getHtmlContent(webview: vscode.Webview, nonce: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>X9 AI Agent Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }

        h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: var(--vscode-foreground);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .stats-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .stat-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
        }

        .stat-label {
            font-size: 12px;
            opacity: 0.7;
            margin-bottom: 5px;
        }

        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .sessions-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .session-item {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .session-item:hover {
            border-color: var(--vscode-textLink-foreground);
            background-color: var(--vscode-list-hoverBackground);
        }

        .session-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 10px;
        }

        .session-id {
            font-weight: normal;
            font-size: 10px;
            font-family: var(--vscode-editor-font-family, monospace);
            opacity: 0.9;
            word-break: break-all;
        }

        .session-time {
            font-size: 11px;
            opacity: 0.7;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .session-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
            gap: 8px;
            font-size: 12px;
        }

        .metric {
            display: flex;
            flex-direction: column;
        }

        .metric-label {
            opacity: 0.7;
            margin-bottom: 2px;
        }

        .metric-value {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .error {
            color: var(--vscode-errorForeground);
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            opacity: 0.6;
        }

        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }

        .refresh-indicator {
            display: inline-block;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .models-list {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .model-badge {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
        }

        .model-breakdown {
            margin-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 10px;
            overflow-x: auto;
        }

        .model-breakdown-title {
            font-size: 11px;
            opacity: 0.7;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .model-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }

        .model-table th {
            text-align: left;
            padding: 3px 10px 3px 0;
            opacity: 0.6;
            font-weight: normal;
            white-space: nowrap;
        }

        .model-table td {
            padding: 3px 10px 3px 0;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            white-space: nowrap;
        }

        .model-table td:first-child {
            color: var(--vscode-foreground);
            font-weight: normal;
            max-width: 160px;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .model-table th:last-child,
        .model-table td:last-child {
            padding-right: 0;
        }

        .model-table tr:not(:last-child) td,
        .model-table tr:not(:last-child) th {
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .context-growth {
            margin-top: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 10px;
        }

        .section-header {
            font-size: 18px;
            font-weight: bold;
            margin: 25px 0 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .insight-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px 15px;
            margin-bottom: 20px;
        }

        .tool-row {
            display: grid;
            grid-template-columns: minmax(0, 150px) 1fr 36px 52px;
            gap: 8px;
            align-items: center;
            padding: 5px 0;
            font-size: 11px;
        }

        .tool-row:not(:last-child) {
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .tool-name {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .tool-bar-wrap {
            height: 6px;
            background-color: var(--vscode-panel-border);
            border-radius: 3px;
            overflow: hidden;
        }

        .tool-bar {
            height: 100%;
            background-color: var(--vscode-textLink-foreground);
            border-radius: 3px;
        }

        .tool-count {
            text-align: right;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }

        .tool-error {
            font-size: 10px;
            opacity: 0.6;
            text-align: right;
        }

        .tool-error.has-error {
            color: var(--vscode-errorForeground);
            opacity: 1;
        }

        .hist-chart {
            display: flex;
            align-items: flex-end;
            gap: 5px;
            height: 64px;
            margin-bottom: 4px;
        }

        .hist-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            height: 100%;
            min-width: 0;
        }

        .hist-bar-wrap {
            flex: 1;
            width: 100%;
            display: flex;
            align-items: flex-end;
        }

        .hist-bar {
            width: 100%;
            background-color: var(--vscode-textLink-foreground);
            border-radius: 2px 2px 0 0;
            min-height: 2px;
            opacity: 0.75;
            cursor: help;
        }

        .hist-label {
            font-size: 9px;
            opacity: 0.55;
            margin-top: 3px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            width: 100%;
            text-overflow: ellipsis;
        }

        .period-tabs {
            display: flex;
            gap: 6px;
            align-items: center;
        }

        .period-btn {
            background: none;
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-foreground);
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: var(--vscode-font-family);
            opacity: 0.7;
            transition: all 0.15s;
        }

        .period-btn:hover {
            opacity: 1;
            border-color: var(--vscode-textLink-foreground);
        }

        .period-btn.active {
            background-color: var(--vscode-textLink-foreground);
            border-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
            opacity: 1;
            font-weight: bold;
        }

        .period-label {
            font-size: 11px;
            opacity: 0.55;
            margin-left: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 X9 AI Agent Monitor</h1>
        <div style="display:flex;align-items:center;gap:12px">
            <div class="period-tabs">
                <button class="period-btn active" data-period="month">Mês Atual</button>
                <button class="period-btn" data-period="week">7 dias</button>
                <button class="period-btn" data-period="all">Tudo</button>
            </div>
            <span class="refresh-indicator">●</span>
        </div>
    </div>

    <div id="periodInfo" style="font-size:12px;opacity:0.55;margin-bottom:16px;margin-top:-10px"></div>

    <div class="stats-summary" id="statsSummary">
        <!-- Stats will be populated here -->
    </div>

    <div class="section-header">Histórico de Uso</div>
    <div id="usageHistory"></div>

    <div class="section-header">Top Ferramentas</div>
    <div id="topTools"></div>

    <div class="section-header">Sessões Recentes</div>

    <div class="sessions-list" id="sessionsList">
        <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <p>Nenhuma sessão encontrada</p>
            <p style="font-size: 12px; margin-top: 10px;">
                Certifique-se de que o logging está habilitado:<br>
                <code>github.copilot.chat.agentDebugLog.fileLogging.enabled</code>
            </p>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        let allMetrics = [];
        let currentPeriod = 'month';

        function escapeHtml(value) {
            if (value === null || value === undefined) return '';
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // Botões de período
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentPeriod = btn.dataset.period;
                if (allMetrics.length > 0) updateUI(allMetrics);
            });
        });

        window.addEventListener('message', event => {
            const message = event.data;

            if (message.type === 'updateMetrics') {
                allMetrics = message.metrics || [];
                updateUI(allMetrics);
            }
        });

        function getPeriodStart(period) {
            const now = new Date();
            if (period === 'month') {
                return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            }
            if (period === 'week') {
                return now.getTime() - 7 * 24 * 60 * 60 * 1000;
            }
            return 0; // all
        }

        function filterMetrics(metrics) {
            const start = getPeriodStart(currentPeriod);
            if (start === 0) return metrics;
            return metrics.filter(m => m.timestamp >= start);
        }

        function updatePeriodInfo() {
            const el = document.getElementById('periodInfo');
            const now = new Date();
            if (currentPeriod === 'month') {
                const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                const day = now.getDate();
                el.textContent = \`Período: 01/\${String(now.getMonth()+1).padStart(2,'0')}/\${now.getFullYear()} – hoje (dia \${day}) · cota renova dia 1º\`;
            } else if (currentPeriod === 'week') {
                el.textContent = 'Período: últimos 7 dias';
            } else {
                el.textContent = 'Período: todo o histórico disponível';
            }
        }

        function updateUI(metrics) {
            const filtered = filterMetrics(metrics);
            updatePeriodInfo();

            if (!metrics || metrics.length === 0) {
                return;
            }

            updateStatsSummary(filtered);
            renderUsageHistory(filtered);
            renderTopTools(filtered);
            updateSessionsList(filtered);
        }

        function renderUsageHistory(metrics) {
            const now = new Date();
            const dayMap = {};

            // Pré-popular todos os dias do período para o modo mensal
            if (currentPeriod === 'month') {
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                for (let d = 1; d <= now.getDate(); d++) {
                    const date = new Date(now.getFullYear(), now.getMonth(), d);
                    const key = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    dayMap[key] = { sessions: 0, tokens: 0, ts: date.getTime() };
                }
            }

            for (const s of metrics) {
                const d = new Date(s.timestamp);
                const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                if (!dayMap[key]) dayMap[key] = { sessions: 0, tokens: 0, ts: s.timestamp };
                dayMap[key].sessions++;
                dayMap[key].tokens += s.totalTokens;
            }
            const days = Object.entries(dayMap)
                .sort((a, b) => a[1].ts - b[1].ts)
                .slice(currentPeriod === 'month' ? 0 : -14);
            if (days.length === 0) return;
            const maxSessions = Math.max(...days.map(d => d[1].sessions), 1);
            const bars = days.map(([day, data]) => \`
                <div class="hist-col">
                    <div class="hist-bar-wrap">
                        <div class="hist-bar"
                             style="height:\${(data.sessions / maxSessions * 100).toFixed(0)}%"
                             title="\${data.sessions} sessão(ões) · \${formatNumber(data.tokens)} tokens"></div>
                    </div>
                    <div class="hist-label">\${escapeHtml(day)}</div>
                </div>
            \`).join('');
            document.getElementById('usageHistory').innerHTML =
                \`<div class="insight-card"><div class="hist-chart">\${bars}</div></div>\`;
        }

        function renderTopTools(metrics) {
            const toolMap = {};
            for (const session of metrics) {
                for (const tool of (session.toolCallDetails || [])) {
                    if (!toolMap[tool.name]) toolMap[tool.name] = { calls: 0, errors: 0 };
                    toolMap[tool.name].calls++;
                    if (!tool.success) toolMap[tool.name].errors++;
                }
            }
            const sorted = Object.entries(toolMap)
                .map(([name, stats]) => ({ name, ...stats }))
                .sort((a, b) => b.calls - a.calls)
                .slice(0, 5);
            if (sorted.length === 0) {
                document.getElementById('topTools').innerHTML =
                    '<p style="opacity:0.5;font-size:12px;margin-bottom:20px">Nenhuma tool call registrada</p>';
                return;
            }
            const maxCalls = sorted[0].calls;
            const rows = sorted.map(t => \`
                <div class="tool-row">
                    <div class="tool-name" title="\${escapeHtml(t.name)}">\${escapeHtml(t.name)}</div>
                    <div class="tool-bar-wrap">
                        <div class="tool-bar" style="width:\${(t.calls / maxCalls * 100).toFixed(0)}%"></div>
                    </div>
                    <div class="tool-count">\${t.calls}</div>
                    <div class="tool-error \${t.errors > 0 ? 'has-error' : ''}">
                        \${t.errors > 0 ? t.errors + ' err' : '✓'}
                    </div>
                </div>
            \`).join('');
            document.getElementById('topTools').innerHTML =
                \`<div class="insight-card">\${rows}</div>\`;
        }

        function renderContextGrowth(llmRequests) {
            if (!llmRequests || llmRequests.length < 2) return '';
            const values = llmRequests.map(r => r.inputTokens || 0);
            const max = Math.max(...values);
            if (max === 0) return '';
            const W = 240, H = 36, pad = 2;
            const pts = values.map((v, i) => {
                const x = pad + (i / (values.length - 1)) * (W - 2 * pad);
                const y = H - pad - (v / max) * (H - 2 * pad);
                return x.toFixed(1) + ',' + y.toFixed(1);
            }).join(' ');
            const lastY = (H - pad - (values[values.length - 1] / max) * (H - 2 * pad)).toFixed(1);
            return \`
                <div class="context-growth">
                    <div class="model-breakdown-title">Crescimento do Contexto (tokens in por turno)</div>
                    <svg width="\${W}" height="\${H}" style="display:block;overflow:visible;margin-top:6px">
                        <polyline points="\${pts}" fill="none"
                            stroke="var(--vscode-textLink-foreground)"
                            stroke-width="1.5" stroke-linejoin="round"/>
                        <circle cx="\${W - pad}" cy="\${lastY}" r="2.5"
                            fill="var(--vscode-textLink-foreground)"/>
                    </svg>
                    <div style="font-size:10px;opacity:0.6;margin-top:4px">
                        \${formatNumber(values[0])} → \${formatNumber(values[values.length - 1])} tokens in
                    </div>
                </div>
            \`;
        }

        function updateStatsSummary(metrics) {
            const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);
            const totalInputTokens = metrics.reduce((sum, m) => sum + m.inputTokens, 0);
            const totalCachedTokens = metrics.reduce((sum, m) => sum + (m.cachedTokens || 0), 0);
            // Usar como denominador apenas sessões que já tinham cache ativo
            // (exclui sessões cold-start que nunca tiveram tokens cacheados)
            const totalRequests = metrics.reduce((sum, m) => sum + m.requestCount, 0);
            const totalToolCalls = metrics.reduce((sum, m) => sum + m.toolCalls, 0);
            const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);
            const inputTokensWithCache = metrics.reduce((sum, m) => sum + ((m.cachedTokens || 0) > 0 ? (m.inputTokens || 0) : 0), 0);
            const cacheDenominator = inputTokensWithCache > 0 ? inputTokensWithCache : totalInputTokens;
            const cacheHitRate = cacheDenominator > 0 ? (totalCachedTokens / cacheDenominator * 100).toFixed(1) : '0.0';

            const html = \`
                <div class="stat-card">
                    <div class="stat-label">Total de Tokens</div>
                    <div class="stat-value">\${formatNumber(totalTokens)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Cache Hit Rate</div>
                    <div class="stat-value">\${cacheHitRate}%</div>
                    <div style="font-size:10px;opacity:0.6">\${formatNumber(totalCachedTokens)} tokens cacheados</div>
                </div>
                <div class="stat-card">

                    <div class="stat-label">LLM Calls Internas</div>
                    <div class="stat-value">\${totalRequests}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Tool Calls</div>
                    <div class="stat-value">\${totalToolCalls}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Erros</div>
                    <div class="stat-value \${totalErrors > 0 ? 'error' : ''}">\${totalErrors}</div>
                </div>
            \`;

            document.getElementById('statsSummary').innerHTML = html;
        }

        function aggregateByModel(llmRequests) {
            const map = {};
            for (const req of (llmRequests || [])) {
                const key = req.model || 'unknown';
                if (!map[key]) {
                    map[key] = { model: key, requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
                }
                map[key].requests++;
                map[key].inputTokens += req.inputTokens || 0;
                map[key].outputTokens += req.outputTokens || 0;
                map[key].totalTokens += (req.inputTokens || 0) + (req.outputTokens || 0);
            }
            return Object.values(map).sort((a, b) => b.totalTokens - a.totalTokens);
        }

        function renderModelBreakdown(llmRequests) {
            const stats = aggregateByModel(llmRequests);
            if (stats.length === 0) return '';
            const rows = stats.map(s => \`
                <tr>
                    <td title="\${escapeHtml(s.model)}">\${escapeHtml(s.model)}</td>
                    <td>\${s.requests}</td>
                    <td>\${formatNumber(s.inputTokens)}</td>
                    <td>\${formatNumber(s.outputTokens)}</td>
                    <td>\${formatNumber(s.totalTokens)}</td>
                </tr>
            \`).join('');
            return \`
                <div class="model-breakdown">
                    <div class="model-breakdown-title">Tokens &amp; Requests por Modelo</div>
                    <table class="model-table">
                        <thead>
                            <tr>
                                <th>Modelo</th>
                                <th>Requests</th>
                                <th>Tokens In</th>
                                <th>Tokens Out</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>\${rows}</tbody>
                    </table>
                </div>
            \`;
        }

        function updateSessionsList(metrics) {
            const html = metrics.map(session => \`
                <div class="session-item">
                    <div class="session-header">
                        <div class="session-id">📋 \${escapeHtml(session.sessionId)}</div>
                        <div class="session-time">\${formatDate(session.timestamp)}</div>
                    </div>
                    <div class="session-metrics">
                        <div class="metric">
                            <div class="metric-label">Tokens</div>
                            <div class="metric-value">\${formatNumber(session.totalTokens)}</div>
                            <div style="font-size: 10px; opacity: 0.6;">
                                ↓\${formatNumber(session.inputTokens)} ↑\${formatNumber(session.outputTokens)}
                            </div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Cache Hit</div>
                            <div class="metric-value">\${session.inputTokens > 0 ? (((session.cachedTokens || 0) / session.inputTokens) * 100).toFixed(1) + '%' : 'N/A'}</div>
                            <div style="font-size:10px;opacity:0.6">\${formatNumber(session.cachedTokens || 0)} tk</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Duração</div>
                            <div class="metric-value">\${formatDuration(session.duration)}</div>
                        </div>
                        <div class="metric">

                            <div class="metric-label">LLM Calls</div>
                            <div class="metric-value">\${session.requestCount}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Tool Calls</div>
                            <div class="metric-value">\${session.toolCalls}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Eficiência</div>
                            <div class="metric-value">\${session.inputTokens > 0 ? (session.outputTokens / session.inputTokens * 100).toFixed(1) + '%' : 'N/A'}</div>
                            <div style="font-size:10px;opacity:0.6">out/in</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Erros</div>
                            <div class="metric-value \${session.errors > 0 ? 'error' : ''}">\${session.errors}</div>
                        </div>
                    </div>
                    \${renderModelBreakdown(session.llmRequests)}
                    \${renderContextGrowth(session.llmRequests)}
                </div>
            \`).join('');

            document.getElementById('sessionsList').innerHTML = html;
        }

        function formatNumber(num) {
            return num.toLocaleString('pt-BR');
        }

        function formatDuration(ms) {
            if (ms < 1000) return \`\${ms}ms\`;
            const seconds = Math.floor(ms / 1000);
            if (seconds < 60) return \`\${seconds}s\`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return \`\${minutes}m \${remainingSeconds}s\`;
        }

        function formatDate(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) return 'agora';
            if (diffMins < 60) return \`\${diffMins}min atrás\`;

            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return \`\${diffHours}h atrás\`;

            return date.toLocaleString('pt-BR');
        }
    </script>
</body>
</html>`;
  }
}

function getNonce(): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";
    for (let i = 0; i < 32; i++) {
        value += chars[Math.floor(Math.random() * chars.length)];
    }
    return value;
}
