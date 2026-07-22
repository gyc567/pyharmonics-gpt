"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface VibeToolCallCardProps {
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export function VibeToolCallCard({
  toolName,
  input,
  output,
}: VibeToolCallCardProps) {
  const [open, setOpen] = useState(false);
  const status = output?.status || "running";
  const isRunning = status === "running";
  const isError = status === "error" || status === "invalid_input";

  return (
    <div className="mx-12 rounded-xl border border-border-subtle bg-elevated/50 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : isError ? (
            <XCircle className="h-3.5 w-3.5 text-danger" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {toolName ? `工具：${toolName}` : "工具调用"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-2 border-t border-border-dim pt-2">
          {input && Object.keys(input).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                输入
              </p>
              <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-surface-2 p-2 text-xs text-foreground">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output && Object.keys(output).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                输出
              </p>
              <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-surface-2 p-2 text-xs text-foreground">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
