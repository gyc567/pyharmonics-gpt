import type { Signal } from "@/types";

export interface VibeSession {
  id: string;
  user_id: string;
  title: string | null;
  status: "active" | "archived" | "deleted";
  context: Record<string, unknown>;
  summary: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VibeMessage {
  id: string;
  session_id: string;
  run_id?: string;
  role: "user" | "assistant" | "tool" | "system";
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output_summary?: Record<string, unknown>;
  cards?: VibeCard[];
  event_id?: string;
  created_at: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type VibeCard =
  | { type: "signal"; payload: Signal }
  | { type: "position_check"; payload: PositionCheckResult }
  | { type: "backtest"; payload: BacktestResult }
  | { type: "analysis_mini"; payload: AnalysisMiniCard };

export interface PositionCheckResult {
  schema_version: string;
  status: "completed" | "no_config" | "error";
  symbol: string;
  planned_trade_wu: number;
  risk_level?: number;
  risk_label?: string;
  trouble?: string;
  cooldown?: string;
  available_wu?: number;
  suggestion?: string;
}

export interface BacktestResult {
  schema_version: string;
  status: "completed" | "not_implemented" | "error";
  market?: string;
  symbol?: string;
  interval?: string;
  direction?: string;
  lookback_days?: number;
  start_date?: string;
  end_date?: string;
  total_signals?: number;
  win_count?: number;
  loss_count?: number;
  win_rate?: number;
  avg_rr?: number;
  profit_factor?: number;
  max_drawdown?: number;
  note?: string;
}

export interface AnalysisMiniCard {
  analysis_id: string;
  market: string;
  symbol: string;
  interval: string;
  direction?: string;
  chart_url?: string;
}

export interface VibeRun {
  id: string;
  session_id: string;
  user_id: string;
  status: "running" | "completed" | "failed" | "cancelled";
  tool_trace: Record<string, unknown>[];
  input_tokens?: number;
  output_tokens?: number;
  duration_ms?: number;
  user_prompt?: string;
  model?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface VibeEvent {
  event_id: string;
  run_id: string;
  type:
    | "run_started"
    | "tool_call_start"
    | "tool_call_end"
    | "delta"
    | "card"
    | "done"
    | "error";
  content?: string;
  call_id?: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  card_type?: string;
  payload?: Record<string, unknown>;
  status?: string;
  input_tokens?: number;
  output_tokens?: number;
  duration_ms?: number;
  code?: string;
  message?: string;
  retryable?: boolean;
}

export interface CreateSessionRequest {
  title?: string;
  context?: Record<string, unknown>;
}

export interface SendMessageRequest {
  content: string;
  attachments?: Record<string, unknown>[];
}

export interface SendMessageResponse {
  run_id: string;
  status: string;
}

export interface PollEventsResponse {
  run_id: string;
  status: string;
  events: VibeEvent[];
  has_more: boolean;
}
