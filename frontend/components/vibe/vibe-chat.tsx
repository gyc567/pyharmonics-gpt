"use client";

import { useEffect, useRef } from "react";
import { VibeMessageItem } from "./vibe-message";
import { VibeComposer } from "./vibe-composer";
import { VibeWelcome } from "./vibe-welcome";
import type { VibeMessage } from "@/types/vibe";
import { AlertCircle } from "lucide-react";

interface VibeChatProps {
  messages: VibeMessage[];
  loading: boolean;
  error?: { code: string; message: string; retryable: boolean };
  onSend: (content: string) => void;
  onStop?: () => void;
}

export function VibeChat({
  messages,
  loading,
  error,
  onSend,
  onStop,
}: VibeChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const showWelcome = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex-1 overflow-y-auto py-4">
        {showWelcome ? (
          <VibeWelcome onSuggestionClick={onSend} />
        ) : (
          <div className="space-y-2">
            {messages.map((message) => (
              <VibeMessageItem key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 p-4 text-danger">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">运行失败</p>
              <p className="mt-1 text-sm opacity-90">{error.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <VibeComposer
          loading={loading}
          onSubmit={onSend}
          onStop={onStop}
        />
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          AI 交易助手仅供技术研究，不构成投资建议。
        </p>
      </div>
    </div>
  );
}
