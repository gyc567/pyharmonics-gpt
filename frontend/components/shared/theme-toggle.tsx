"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

type ThemeOption = {
  value: "light" | "dark" | "system";
  label: string;
  icon: React.ReactNode;
};

const OPTIONS: ThemeOption[] = [
  { value: "light", label: "浅色", icon: <Sun className="h-4 w-4" /> },
  { value: "dark", label: "深色", icon: <Moon className="h-4 w-4" /> },
  { value: "system", label: "跟随系统", icon: <Monitor className="h-4 w-4" /> },
];

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border-subtle bg-card p-1",
        className
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          title={option.label}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-all",
            theme === option.value &&
              "bg-cy/10 text-cy shadow-glow-sm"
          )}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
