import * as fs from "fs";
import * as path from "path";
import { SessionMetrics, ToolCall, LLMRequest } from "./types";

export class LogParser {
  // Cache: filePath -> { mtime em ms, métricas parseadas }
  private static fileCache = new Map<
    string,
    { mtime: number; metrics: SessionMetrics }
  >();

  /**
   * Parse um arquivo de log JSONL (main.jsonl de uma sessão).
   * Usa cache por mtime: evita releitura de disco quando o arquivo não mudou.
   */
  static parseLogFile(filePath: string): SessionMetrics | null {
    try {
      // Verificar mtime antes de ler o arquivo
      let mtime = 0;
      try {
        mtime = fs.statSync(filePath).mtimeMs;
        const cached = this.fileCache.get(filePath);
        if (cached && cached.mtime === mtime) {
          return cached.metrics;
        }
      } catch {
        // stat falhou, prosseguir com leitura normal
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");
      const events = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((e) => e !== null);

      const metrics = this.extractMetricsFromEvents(events, filePath);
      if (mtime > 0) {
        this.fileCache.set(filePath, { mtime, metrics });
      }
      return metrics;
    } catch (error) {
      console.error(`Error parsing log file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extrai métricas dos eventos JSONL
   */
  private static extractMetricsFromEvents(
    events: any[],
    filePath: string,
  ): SessionMetrics {
    const sessionId = path.basename(path.dirname(filePath));
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedTokens = 0;
    let requestCount = 0;
    let userMessages = 0;
    let toolCalls = 0;
    let errors = 0;
    const models = new Set<string>();
    const toolCallDetails: ToolCall[] = [];
    const llmRequests: LLMRequest[] = [];
    const userMessageSpanIds = new Set<string>();
    const llmSuccessParentSpanIds = new Map<string, string>(); // parentSpanId → model

    let minTimestamp = Number.MAX_SAFE_INTEGER;
    let maxTimestamp = 0;
    let sessionStartTs: number | null = null;

    for (const event of events) {
      const ts = event.ts || Date.now();
      const dur = event.dur || 0;
      const type = event.type || "";
      const attrs = event.attrs || {};

      minTimestamp = Math.min(minTimestamp, ts);
      maxTimestamp = Math.max(maxTimestamp, ts + dur);

      // Capturar o timestamp preciso de início da sessão
      if (type === "session_start") {
        sessionStartTs = ts;
      }

      // Registrar spanId das mensagens do usuário (contagem calculada após o loop)
      if (type === "user_message") {
        if (event.spanId) {
          userMessageSpanIds.add(event.spanId);
        }
      }

      // Detectar LLM requests
      if (
        type === "llm_request" ||
        type === "llm_response" ||
        type.includes("language_model")
      ) {
        requestCount++;

        const inputTok = parseInt(
          attrs.inputTokens || attrs.prompt_tokens || attrs.tokensIn || "0",
          10,
        );
        const outputTok = parseInt(
          attrs.outputTokens ||
            attrs.completion_tokens ||
            attrs.tokensOut ||
            "0",
          10,
        );
        const cachedTok = parseInt(attrs.cachedTokens || "0", 10);

        inputTokens += inputTok;
        outputTokens += outputTok;
        cachedTokens += cachedTok;
        totalTokens += inputTok + outputTok;

        if (attrs.model || attrs.modelName) {
          models.add(attrs.model || attrs.modelName);
        }

        llmRequests.push({
          model: attrs.model || attrs.modelName || "unknown",
          timestamp: ts,
          duration: dur,
          inputTokens: inputTok,
          outputTokens: outputTok,
          cachedTokens: cachedTok,
          success: event.status === "ok" || !attrs.error,
        });

        // Registrar parentSpanId e modelo de LLM calls bem-sucedidas (apenas a primeira por turno)
        if (
          event.status === "ok" &&
          event.parentSpanId &&
          !llmSuccessParentSpanIds.has(event.parentSpanId)
        ) {
          llmSuccessParentSpanIds.set(
            event.parentSpanId,
            attrs.model || attrs.modelName || "unknown",
          );
        }
      }

      // Detectar tool calls
      if (
        type === "tool_call" ||
        type === "tool_invoke" ||
        type.includes("tool")
      ) {
        toolCalls++;
        toolCallDetails.push({
          name: event.name || attrs.toolName || type,
          timestamp: ts,
          duration: dur,
          success: event.status === "ok",
        });
      }

      // Detectar erros
      if (event.status === "error" || attrs.error) {
        errors++;
      }
    }

    // Somar o multiplicador de billing de cada turno com LLM call bem-sucedida
    for (const spanId of userMessageSpanIds) {
      const model = llmSuccessParentSpanIds.get(spanId);
      if (model !== undefined) {
        userMessages += LogParser.getModelMultiplier(model);
      }
    }

    const timestamp =
      sessionStartTs ??
      (minTimestamp !== Number.MAX_SAFE_INTEGER ? minTimestamp : Date.now());
    const duration =
      maxTimestamp > minTimestamp ? maxTimestamp - minTimestamp : 0;

    return {
      sessionId,
      timestamp,
      duration,
      totalTokens,
      inputTokens,
      outputTokens,
      cachedTokens,
      requestCount,
      userMessages,
      toolCalls,
      errors,
      models: Array.from(models),
      toolCallDetails,
      llmRequests,
    };
  }

  /**
   * Retorna o multiplicador de premium request para um dado modelo,
   * com base na tabela pública de preços do GitHub Copilot.
   */
  private static getModelMultiplier(model: string): number {
    const m = model.toLowerCase();
    // 0× — modelos gratuitos / roteadores internos
    if (
      m.includes("router") || // vscode-agentic-search-router-a/b
      m.includes("raptor") || // raptor-mini (modelo de completions incluído)
      m.includes("gpt-4o-mini") || // gpt-4o-mini-2024-07-18 e variantes (antes de gpt-4o)
      m.includes("gpt-4.1") ||
      m.includes("gpt-4o") || // gpt-4o, gpt-4o-2024-05-13, etc. (mini já capturado acima)
      m.includes("gpt-5-mini") ||
      m.includes("gpt-5mini") ||
      m.includes("gpt5mini")
    )
      return 0;
    // 0.25×
    if (
      m.includes("gpt-5.4-nano") ||
      m.includes("gpt-5-4-nano") ||
      m.includes("gpt5.4nano")
    )
      return 0.25;
    // 0.33×
    if (
      m.includes("haiku") ||
      m.includes("gemini-3-flash") ||
      m.includes("gemini-3flash") ||
      m.includes("gpt-5.4-mini") ||
      m.includes("gpt-5-4-mini")
    )
      return 0.33;
    // 3× — Claude Opus 4.6 fast mode (30×) deve ser checado antes do Opus 4.6 geral (3×)
    if (
      m.includes("claude") &&
      (m.includes("opus-4.6") || m.includes("opus-4-6")) &&
      (m.includes("fast") || m.includes("turbo"))
    )
      return 30;
    // 3×
    if (
      m.includes("claude") &&
      (m.includes("opus-4.5") ||
        m.includes("opus-4-5") ||
        m.includes("opus-4.6") ||
        m.includes("opus-4-6"))
    )
      return 3;
    // 7.5×
    if (m.includes("gpt-5.5") || m.includes("gpt-5-5")) return 7.5;
    // 14×
    if (
      m.includes("gemini-3.5-flash") ||
      m.includes("gemini-3-5-flash") ||
      m.includes("gemini-35-flash")
    )
      return 14;
    // 15×
    if (
      m.includes("claude") &&
      (m.includes("opus-4.7") || m.includes("opus-4-7"))
    )
      return 15;
    // 1× (padrão: claude-sonnet-4.x, gpt-5.2, gpt-5.4, gemini-2.5-pro, etc.)
    return 1;
  }

  /**
   * Busca todas as sessões (diretórios) no diretório de debug logs
   */
  static findSessionDirectories(debugLogDir: string): string[] {
    if (!fs.existsSync(debugLogDir)) {
      return [];
    }

    try {
      const entries = fs.readdirSync(debugLogDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(debugLogDir, entry.name))
        .filter((dir) => {
          // Verificar se o diretório contém main.jsonl
          const mainLog = path.join(dir, "main.jsonl");
          return fs.existsSync(mainLog);
        })
        .sort((a, b) => {
          // Ordenar por data de modificação (mais recente primeiro)
          try {
            const statA = fs.statSync(path.join(a, "main.jsonl"));
            const statB = fs.statSync(path.join(b, "main.jsonl"));
            return statB.mtime.getTime() - statA.mtime.getTime();
          } catch {
            return 0;
          }
        });
    } catch (error) {
      console.error("Error finding session directories:", error);
      return [];
    }
  }

  /**
   * Parse uma sessão completa a partir do diretório
   */
  static parseSession(sessionDir: string): SessionMetrics | null {
    const mainLogPath = path.join(sessionDir, "main.jsonl");
    if (!fs.existsSync(mainLogPath)) {
      return null;
    }
    return this.parseLogFile(mainLogPath);
  }
}
