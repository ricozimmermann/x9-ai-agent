import * as vscode from "vscode";
import { WebviewProvider } from "./webviewProvider";
import { LogMonitor } from "./logMonitor";
import { SessionMetrics } from "./types";

let webviewProvider: WebviewProvider;
let logMonitor: LogMonitor;
let refreshInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("X9 AI Agent Monitor is now active!");

  // Inicializar componentes
  webviewProvider = new WebviewProvider(context);
  logMonitor = new LogMonitor();

  // Registrar WebviewViewProvider para a sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebviewProvider.viewType,
      webviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // Registrar comando para abrir o painel na barra lateral
  const toggleCommand = vscode.commands.registerCommand(
    "x9.togglePanel",
    () => {
      webviewProvider.show();
    },
  );

  // Registrar comando para refresh manual
  const refreshCommand = vscode.commands.registerCommand(
    "x9.refreshMetrics",
    () => {
      logMonitor.refresh();
      vscode.window.showInformationMessage("X9: Métricas atualizadas!");
    },
  );

  // Iniciar monitoramento
  startMonitoring();

  // Observar mudanças nas configurações
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("x9")) {
        handleConfigurationChange();
      }
    }),
  );

  // Adicionar à lista de disposables
  context.subscriptions.push(toggleCommand, refreshCommand, {
    dispose: () => stopMonitoring(),
  });

  // Mostrar mensagem de boas-vindas (apenas na primeira ativação)
  const hasShownWelcome = context.globalState.get("x9.hasShownWelcome", false);
  if (!hasShownWelcome) {
    showWelcomeMessage();
    context.globalState.update("x9.hasShownWelcome", true);
  }
}

/**
 * Inicia o monitoramento de logs
 */
function startMonitoring() {
  const config = vscode.workspace.getConfiguration("x9");
  const autoRefresh = config.get("autoRefresh", true);

  if (!autoRefresh) {
    return;
  }

  // Callback quando as métricas são atualizadas
  logMonitor.start((metrics: SessionMetrics[]) => {
    webviewProvider.updateMetrics(metrics);
  });

  // Configurar refresh automático
  const refreshIntervalMs = config.get("refreshInterval", 2000);
  refreshInterval = setInterval(() => {
    logMonitor.refresh();
  }, refreshIntervalMs);
}

/**
 * Para o monitoramento
 */
function stopMonitoring() {
  logMonitor.stop();

  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }
}

/**
 * Lida com mudanças na configuração
 */
function handleConfigurationChange() {
  const config = vscode.workspace.getConfiguration("x9");

  // Reiniciar monitoramento se configurações mudaram
  stopMonitoring();
  startMonitoring();
}

/**
 * Mostra mensagem de boas-vindas
 */
function showWelcomeMessage() {
  const config = vscode.workspace.getConfiguration(
    "github.copilot.chat.agentDebugLog",
  );
  const fileLoggingEnabled = config.get("fileLogging.enabled", false);

  if (!fileLoggingEnabled) {
    vscode.window
      .showWarningMessage(
        "X9: Para monitorar agentes de IA, habilite o logging: github.copilot.chat.agentDebugLog.fileLogging.enabled",
        "Abrir Configurações",
      )
      .then((selection) => {
        if (selection === "Abrir Configurações") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "github.copilot.chat.agentDebugLog.fileLogging.enabled",
          );
        }
      });
  } else {
    vscode.window
      .showInformationMessage(
        "🔍 X9 AI Agent Monitor está ativo! Clique no ícone X9 na barra lateral para ver as métricas.",
        "Abrir Monitor",
      )
      .then((selection) => {
        if (selection === "Abrir Monitor") {
          vscode.commands.executeCommand("x9.togglePanel");
        }
      });
  }
}

export function deactivate() {
  stopMonitoring();
  console.log("X9 AI Agent Monitor deactivated.");
}
