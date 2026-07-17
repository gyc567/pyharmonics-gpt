"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { usePosition } from "@/hooks/use-position";
import { PositionHeader } from "@/components/position/position-header";
import { PositionConfigPanel } from "@/components/position/position-config-panel";
import { AccountStructure } from "@/components/position/account-structure";
import { RiskLevelPanel } from "@/components/position/risk-level-panel";
import { ColdChecklist } from "@/components/position/cold-checklist";
import { WhatIfSimulator } from "@/components/position/what-if-simulator";
import { ValidationPanel } from "@/components/position/validation-panel";
import { DiagnosisPanel } from "@/components/position/diagnosis-panel";
import { LongTermHoldings } from "@/components/position/long-term-holdings";
import { cn } from "@/lib/utils";

export default function PositionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <PositionPageContent />
    </Suspense>
  );
}

function PositionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const sizeParam = searchParams?.get("size");
  const initialPlanned = sizeParam ? Number(sizeParam) : 0.5;

  const {
    config,
    balance,
    buckets,
    plannedTrade,
    actualTrade,
    checklist,
    allChecked,
    riskLevel,
    validation,
    diagnostics,
    whatIf,
    holdings,
    saving,
    setPlannedTrade,
    setActualTrade,
    updateConfig,
    toggleChecklist,
    archiveWhatIf,
    addHolding,
    updateHolding,
    deleteHolding,
  } = usePosition({
    userId: user?.id,
    initialPlannedTrade: initialPlanned,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gradient">仓位管理</h1>
            <p className="text-sm text-muted-foreground">按规则执行，降低冲动交易</p>
          </div>
          {saving && (
            <span className="text-xs text-muted-foreground">保存中...</span>
          )}
        </div>

        <PositionHeader config={config} balance={balance} riskLevel={riskLevel} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <PositionConfigPanel config={config} onChange={updateConfig} />
            <ValidationPanel results={validation} />
            <DiagnosisPanel items={diagnostics} />
          </div>

          <div className="space-y-6 lg:col-span-7">
            <AccountStructure config={config} buckets={buckets} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <RiskLevelPanel
                config={config}
                balance={balance}
                plannedTrade={plannedTrade}
                riskLevel={riskLevel}
                onPlannedTradeChange={setPlannedTrade}
              />
              <ColdChecklist items={checklist} onToggle={toggleChecklist} />
            </div>

            <WhatIfSimulator
              actualTrade={actualTrade}
              whatIf={whatIf}
              touchesEmergency={whatIf.touchesEmergency}
              onActualTradeChange={setActualTrade}
              onArchive={archiveWhatIf}
            />

            <div
              className={cn(
                "rounded-xl border p-4 text-center text-sm",
                allChecked && !whatIf.touchesEmergency
                  ? "border border-success/20 bg-success/10 text-success"
                  : "border border-border-subtle bg-elevated/50 text-muted-foreground"
              )}
            >
              {allChecked && !whatIf.touchesEmergency
                ? "风控与清单检查通过，可前往分析或下单"
                : "请完成冷静检查清单并确保不动用救命钱"}
            </div>

            <LongTermHoldings
              holdings={holdings}
              onAdd={addHolding}
              onUpdate={updateHolding}
              onDelete={deleteHolding}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
