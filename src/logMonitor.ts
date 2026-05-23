import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { LogParser } from "./logParser";
import { SessionMetrics } from "./types";

export class LogMonitor {
  private watchers: fs.FSWatcher[] = [];
  private currentMetrics: Map<string, SessionMetrics> = new Map();
  private onMetricsUpdated: ((metrics: SessionMetrics[]) => void) | null = null;

  // Cache dos diretórios de debug-logs (TTL de 60s para evitar rescan frequente)
  private logDirsCache: { dirs: string[]; expiresAt: number } | null = null;
  private static readonly LOG_DIRS_CACHE_TTL = 60_000;

  constructor() {}

  /**
   * Inicia o monitoramento dos logs
   */
  start(callback: (metrics: SessionMetrics[]) => void) {
    this.onMetricsUpdated = callback;

    const allLogDirs = this.getLogDirs();

    if (allLogDirs.length === 0) {
      console.warn("[X9] Nenhum diretório de debug-logs encontrado.");
      console.warn(
        "[X9] Certifique-se de que github.copilot.chat.agentDebugLog.fileLogging.enabled está habilitado",
      );
      return;
    }

    console.log(`[X9] Monitorando ${allLogDirs.length} workspace(s)...`);

    // Carregar logs existentes de todos os workspaces selecionados
    this.loadExistingLogs(allLogDirs);

    console.log(`[X9] ${this.currentMetrics.size} sessões carregadas`);

    // Notificar com os dados iniciais
    this.notifyUpdate();

    // Monitorar mudanças em todos os diretórios
    for (const logDir of allLogDirs) {
      try {
        const watcher = fs.watch(
          logDir,
          { recursive: true },
          (eventType: string, filename: string | null) => {
            if (filename && filename.includes("main.jsonl")) {
              console.log(`[X9] Arquivo modificado: ${filename}`);
              this.handleFileChange(path.join(logDir, filename));
            }
          },
        );

        this.watchers.push(watcher);
      } catch (error) {
        console.error(`[X9] Error watching ${logDir}:`, error);
      }
    }

    console.log("[X9] Watchers iniciados com sucesso");
  }

  /**
   * Para o monitoramento
   */
  stop() {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.onMetricsUpdated = null;
  }

  /**
   * Carrega logs existentes de todos os workspaces
   */
  private loadExistingLogs(logDirs: string[]) {
    for (const dir of logDirs) {
      const sessionDirs = LogParser.findSessionDirectories(dir);
      for (const sessionDir of sessionDirs) {
        const metrics = LogParser.parseSession(sessionDir);
        if (metrics) {
          this.currentMetrics.set(metrics.sessionId, metrics);
        }
      }
    }

    this.notifyUpdate();
  }

  /**
   * Lida com mudanças em arquivos
   */
  private handleFileChange(filePath: string) {
    // Aguardar um pouco para garantir que o arquivo foi completamente escrito
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        // Se for main.jsonl, parsear a sessão inteira
        if (filePath.endsWith("main.jsonl")) {
          const sessionDir = path.dirname(filePath);
          const metrics = LogParser.parseSession(sessionDir);
          if (metrics) {
            this.currentMetrics.set(metrics.sessionId, metrics);
            this.notifyUpdate();
          }
        }
      }
    }, 100);
  }

  /**
   * Notifica sobre atualizações
   */
  private notifyUpdate() {
    if (this.onMetricsUpdated) {
      const metricsArray = Array.from(this.currentMetrics.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      this.onMetricsUpdated(metricsArray);
    }
  }

  /**
   * Retorna todos os diretórios de debug-logs encontrados em todos os workspaces.
   * Resultado é cacheado por 60s para evitar rescan frequente do workspaceStorage.
   */
  private getAllDebugLogDirs(): string[] {
    const now = Date.now();
    if (this.logDirsCache && now < this.logDirsCache.expiresAt) {
      return this.logDirsCache.dirs;
    }

    const appDataDir =
      process.env.APPDATA ||
      (process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Application Support")
        : path.join(os.homedir(), ".config"));

    const codeDir = path.join(appDataDir, "Code", "User", "workspaceStorage");

    if (!fs.existsSync(codeDir)) {
      return [];
    }

    try {
      const dirs: string[] = [];
      const workspaceDirs = fs.readdirSync(codeDir);

      for (const wsDir of workspaceDirs) {
        const copilotLogDir = path.join(
          codeDir,
          wsDir,
          "GitHub.copilot-chat",
          "debug-logs",
        );
        if (fs.existsSync(copilotLogDir)) {
          const entries = fs.readdirSync(copilotLogDir, {
            withFileTypes: true,
          });
          if (entries.some((e: fs.Dirent) => e.isDirectory())) {
            dirs.push(copilotLogDir);
          }
        }
      }

      this.logDirsCache = {
        dirs,
        expiresAt: Date.now() + LogMonitor.LOG_DIRS_CACHE_TTL,
      };
      return dirs;
    } catch (error) {
      console.error("[X9] Erro ao listar todos os diretórios de logs:", error);
      return [];
    }
  }

  /**
   * Obtém o diretório dos debug logs
   */
  private getDebugLogDir(): string | null {
    // O diretório de logs pode estar em diferentes locais dependendo da configuração
    // Geralmente está em: ~/Library/Application Support/Code/User/workspaceStorage/{id}/GitHub.copilot-chat/debug-logs

    const appDataDir =
      process.env.APPDATA ||
      (process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Application Support")
        : path.join(os.homedir(), ".config"));

    const codeDir = path.join(appDataDir, "Code", "User", "workspaceStorage");

    if (!fs.existsSync(codeDir)) {
      console.log("[X9] Workspace storage não encontrado:", codeDir);
      return null;
    }

    // Procurar por diretórios de workspace que contenham logs do copilot
    try {
      const workspaceDirs = fs.readdirSync(codeDir);
      console.log(`[X9] Buscando em ${workspaceDirs.length} workspaces...`);

      // Buscar o workspace mais recentemente modificado com logs
      let mostRecentDir: string | null = null;
      let mostRecentTime = 0;

      for (const wsDir of workspaceDirs) {
        const copilotLogDir = path.join(
          codeDir,
          wsDir,
          "GitHub.copilot-chat",
          "debug-logs",
        );
        if (fs.existsSync(copilotLogDir)) {
          // Verificar se há sessões neste diretório
          const entries = fs.readdirSync(copilotLogDir, {
            withFileTypes: true,
          });
          const hasSession = entries.some((e) => e.isDirectory());

          if (hasSession) {
            const stats = fs.statSync(copilotLogDir);
            if (stats.mtime.getTime() > mostRecentTime) {
              mostRecentTime = stats.mtime.getTime();
              mostRecentDir = copilotLogDir;
            }
          }
        }
      }

      if (mostRecentDir) {
        console.log("[X9] Usando diretório de logs:", mostRecentDir);
        return mostRecentDir;
      }

      console.log("[X9] Nenhum diretório de logs com sessões encontrado");
      return null;
    } catch (error) {
      console.error("[X9] Erro ao buscar diretório de logs:", error);
      return null;
    }
  }

  /**
   * Obtém as métricas atuais
   */
  getMetrics(): SessionMetrics[] {
    return Array.from(this.currentMetrics.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }

  /**
   * Força uma atualização manual
   */
  refresh() {
    const allDirs = this.getLogDirs();
    if (allDirs.length === 0) {
      return;
    }

    // Rastrear sessões ativas para remover as que sumiram do disco
    const activeSessionIds = new Set<string>();

    for (const dir of allDirs) {
      const sessionDirs = LogParser.findSessionDirectories(dir);
      for (const sessionDir of sessionDirs) {
        const sessionId = path.basename(sessionDir);
        activeSessionIds.add(sessionId);
        // parseSession usa cache interno por mtime: só relê se o arquivo mudou
        const metrics = LogParser.parseSession(sessionDir);
        if (metrics) {
          this.currentMetrics.set(metrics.sessionId, metrics);
        }
      }
    }

    // Remover sessões que não existem mais no disco
    for (const sessionId of this.currentMetrics.keys()) {
      if (!activeSessionIds.has(sessionId)) {
        this.currentMetrics.delete(sessionId);
      }
    }

    this.notifyUpdate();
  }

  /**
   * Retorna os diretórios de logs de acordo com a configuração.
   */
  private getLogDirs(): string[] {
    const config = vscode.workspace.getConfiguration("x9");
    const scanAll = config.get("scanAllWorkspaces", true);

    if (scanAll) {
      return this.getAllDebugLogDirs();
    }

    const singleDir = this.getDebugLogDir();
    return singleDir ? [singleDir] : [];
  }
}
