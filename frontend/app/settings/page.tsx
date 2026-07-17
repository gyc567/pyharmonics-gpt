"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Mail, Shield, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const used = profile?.used_quota ?? 0;
  const total = profile?.daily_quota ?? 5;
  const percent = Math.min(100, Math.round((used / total) * 100));

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">账户设置</h2>
          <p className="text-sm text-muted-foreground">管理账户、额度与外观</p>
        </div>

        <section className="glass-card p-5 sm:p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground">账户信息</h3>
          <div className="space-y-3">
            <InfoRow icon={Mail} label="邮箱" value={profile?.email || user.email} />
            <InfoRow
              icon={Shield}
              label="角色"
              value={profile?.role === "admin" ? "管理员" : "普通用户"}
            />
            <InfoRow
              icon={User}
              label="状态"
              value={profile?.status === "active" ? "正常" : "已停用"}
            />
          </div>
        </section>

        <section className="glass-card p-5 sm:p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground">每日额度</h3>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">已用 / 总额</span>
              <span className="font-medium text-foreground">
                {used} / {total}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all bg-gradient-to-r from-cy to-purple",
                  percent >= 100 && "from-danger to-danger"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </section>

        <section className="glass-card p-5 sm:p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground">外观</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">主题</span>
            <ThemeToggle />
          </div>
        </section>

        <section className="glass-card p-5 sm:p-6">
          <button
            type="button"
            onClick={handleSignOut}
            className="btn-danger w-full"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </section>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-transparent bg-muted/60 px-4 py-3 transition-colors hover:border-border-subtle hover:bg-muted">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}
