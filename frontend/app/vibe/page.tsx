"use client";

import { Suspense } from "react";
import { VibePageInner } from "./vibe-page-inner";

export default function VibePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <VibePageInner />
    </Suspense>
  );
}
