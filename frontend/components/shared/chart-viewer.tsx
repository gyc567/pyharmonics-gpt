"use client";

import { useState } from "react";
import { ZoomIn, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartViewerProps {
  url?: string;
  alt?: string;
  className?: string;
}

export function ChartViewer({ url, alt = "分析图表", className }: ChartViewerProps) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-elevated text-sm text-muted-foreground",
          className
        )}
      >
        暂无图表
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border border-border-subtle bg-elevated cursor-zoom-in",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <img
          src={url}
          alt={alt}
          className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
        <div className="absolute right-3 top-3 rounded-full bg-card/80 p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn className="h-4 w-4" />
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-card/80 p-2 text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={url}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-soft-card"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
