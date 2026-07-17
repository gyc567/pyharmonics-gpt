"use client";

import { User } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { QuotaBadge } from "@/components/shared/quota-badge";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types";

interface TopbarProps {
  title: string;
  profile: UserProfile | null;
  className?: string;
}

export function Topbar({ title, profile, className }: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-subtle bg-card/80 backdrop-blur-xl px-4 sm:px-6",
        className
      )}
    >
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        {profile && (
          <QuotaBadge
            used={profile.used_quota}
            total={profile.daily_quota}
          />
        )}
        <ThemeToggle />
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-elevated border border-border-subtle text-muted-foreground">
          <User className="h-4 w-4" />
        </div>
      </div>
    </header>
  );
}
