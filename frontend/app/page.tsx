"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAnalyze } from "@/hooks/use-analyze";
import { AnalyzeForm } from "@/components/dashboard/analyze-form";
import { ResultPanel } from "@/components/dashboard/result-panel";
import { HistoryRail } from "@/components/dashboard/history-rail";
import type { AnalysisHistoryItem } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, getToken } = useAuth();
  const {
    form,
    markets,
    symbols,
    result,
    loading,
    error,
    updateField,
    loadMarkets,
    submit,
    reset,
  } = useAnalyze(getToken);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      loadMarkets();
    }
  }, [user, loadMarkets]);

  const handleRerun = (item: AnalysisHistoryItem) => {
    reset();
    updateField("market", item.market);
    updateField("symbol", item.symbol);
    updateField("interval", item.interval);
    updateField("analysis_type", item.analysis_type);
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <AnalyzeForm
            form={form}
            markets={markets}
            symbols={symbols}
            loading={loading}
            disabled={profile ? profile.used_quota >= profile.daily_quota : false}
            onChange={updateField}
            onSubmit={submit}
          />
          <ResultPanel result={result} loading={loading} error={error} />
        </div>
        <div className="space-y-6">
          <HistoryRail getToken={getToken} onRerun={handleRerun} />
        </div>
      </div>
    </div>
  );
}
