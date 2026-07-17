"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getHistory } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { AnalysisHistoryItem, Market } from "@/types";

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading: authLoading, getToken } = useAuth();
  const [items, setItems] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMarket, setFilterMarket] = useState<"all" | Market>("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    getToken()
      .then((token) => (token ? getHistory(token) : null))
      .then((res) => {
        if (res && "data" in res) {
          setItems(res.data.items);
        }
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, router, getToken]);

  const filtered =
    filterMarket === "all"
      ? items
      : items.filter((i) => i.market === filterMarket);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">历史记录</h2>
            <p className="text-sm text-muted-foreground">
              查看和管理您的分析记录
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterMarket}
              onChange={(e) => setFilterMarket(e.target.value as "all" | Market)}
              className="input-surface w-auto py-2 text-sm"
            >
              <option value="all">全部市场</option>
              <option value="binance">Binance</option>
              <option value="yahoo">Yahoo</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 w-full shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            暂无符合条件的记录
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((item) => (
              <li
                key={item.analysis_id}
                className="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      item.status === "completed"
                        ? "bg-success"
                        : item.status === "no_result"
                        ? "bg-warning"
                        : "bg-danger"
                    )}
                  />
                  <div>
                    <p className="font-medium text-foreground">
                      {item.symbol} · {item.interval}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.created_at)} · {item.market.toUpperCase()} ·{" "}
                      {item.analysis_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "badge",
                      item.direction === "bullish"
                        ? "badge-success"
                        : item.direction === "bearish"
                        ? "badge-danger"
                        : "badge-subtle"
                    )}
                  >
                    {item.direction || "无方向"}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary py-2 px-3 text-xs"
                    onClick={() =>
                      router.push(`/analysis/${item.analysis_id}`)
                    }
                  >
                    详情
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
