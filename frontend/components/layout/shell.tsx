"use client";

import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types";

interface ShellProps {
  title: string;
  profile: UserProfile | null;
  children: React.ReactNode;
  className?: string;
}

export function Shell({ title, profile, children, className }: ShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      <Topbar title={title} profile={profile} />
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
