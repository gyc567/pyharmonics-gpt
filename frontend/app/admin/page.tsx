"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Users, Activity, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [authLoading, user, profile, router]);

  if (authLoading || !user || profile?.role !== "admin") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">管理员面板</h2>
          <p className="text-sm text-muted-foreground">邀请用户、监控用量与成功率</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="邀请用户" value="0" />
          <StatCard icon={Activity} label="今日分析" value="0" />
          <StatCard icon={DollarSign} label="估算费用" value="$0.00" />
          <StatCard icon={Shield} label="成功率" value="—" />
        </div>

        <section className="glass-card p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground">邀请管理</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            此页面需要后端管理接口支持。当前为占位界面。
          </p>
          <div className="mt-4 flex gap-3">
            <button type="button" className="btn-primary">
              邀请用户
            </button>
            <button type="button" className="btn-secondary">
              查看审计日志
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
