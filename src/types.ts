// Tipos baseados no formato OTLP (Open Telemetry Protocol) usado pelos logs do Agent Debug

export interface SessionMetrics {
  sessionId: string;
  timestamp: number;
  duration: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  requestCount: number;
  userMessages: number;
  toolCalls: number;
  errors: number;
  models: string[];
  toolCallDetails: ToolCall[];
  llmRequests: LLMRequest[];
}

export interface ToolCall {
  name: string;
  timestamp: number;
  duration: number;
  success: boolean;
}

export interface LLMRequest {
  model: string;
  timestamp: number;
  duration: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  success: boolean;
}

export interface OTLPEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
  duration?: number;
  events?: OTLPEvent[];
}

export interface OTLPLog {
  resourceSpans?: Array<{
    scopeSpans?: Array<{
      spans?: Array<{
        name: string;
        startTimeUnixNano: string;
        endTimeUnixNano: string;
        attributes?: Array<{
          key: string;
          value: any;
        }>;
        events?: Array<{
          name: string;
          timeUnixNano: string;
          attributes?: Array<{
            key: string;
            value: any;
          }>;
        }>;
      }>;
    }>;
  }>;
}

export interface SessionSummary {
  id: string;
  startTime: Date;
  duration: string;
  tokens: string;
  requests: number;
  models: string;
  errors: number;
}
