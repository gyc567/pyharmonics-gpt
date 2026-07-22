"use client";

import { useState } from "react";
import { Send, Square } from "lucide-react";

interface VibeComposerProps {
  loading: boolean;
  onSubmit: (content: string) => void;
  onStop?: () => void;
  placeholder?: string;
}

export function VibeComposer({
  loading,
  onSubmit,
  onStop,
  placeholder = "问我任何关于交易分析的问题...",
}: VibeComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="glass-card p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={loading}
          className="input-surface min-h-[48px] flex-1 resize-none py-3"
          style={{ maxHeight: "160px" }}
        />
        {loading ? (
          <button
            type="button"
            onClick={onStop}
            className="btn-danger flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            aria-label="停止"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-60"
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
