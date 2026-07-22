"use client";

import { useState } from "react";
import { InputSlider } from "./input-slider";
import { cn } from "@/lib/utils";
import type { PositionConfig, FundScale, RiskAppetite } from "@/types/position";
import { RECOMMENDATIONS } from "@/lib/position/defaults";
import { formatWuAsU, parseCapitalInput } from "@/lib/position/capital";

interface PositionConfigPanelProps {
  config: PositionConfig | null;
  onChange: (updater: (prev: PositionConfig) => PositionConfig) => void;
  className?: string;
}

export function PositionConfigPanel({
  config,
  onChange,
  className,
}: PositionConfigPanelProps) {
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [capitalWarning, setCapitalWarning] = useState<string | null>(null);

  if (!config) return null;

  const isLargeCapital = config.totalCapitalWu > config.largeCapitalThresholdWu;

  const applyPatch = (patch: Partial<PositionConfig>) => {
    onChange((prev) => ({ ...prev, ...patch }));
  };

  const applyRecommendation = (scale: FundScale, appetite: RiskAppetite) => {
    const key = `${scale}-${appetite}` as const;
    const recommendation = RECOMMENDATIONS[key];
    /* istanbul ignore else -- all scale/appetite combos are defined in tests */
    if (recommendation) {
      applyPatch(recommendation);
    }
  };

  const commitCapital = () => {
    const input = document.getElementById("totalCapital") as HTMLInputElement | null;
    /* istanbul ignore next -- defensive guard for detached input */
    if (!input) return;

    const result = parseCapitalInput(input.value);
    if (!result.ok) {
      setCapitalWarning(null);
      if (result.reason === "empty") {
        setCapitalError(null);
      } else {
        setCapitalError(result.reason);
      }
      input.value = formatWuAsU(config.totalCapitalWu);
      return;
    }

    setCapitalError(null);
    setCapitalWarning(result.warning ?? null);
    applyPatch({ totalCapitalWu: result.wu });
  };

  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">参数配置</h2>
          <p className="text-sm text-muted-foreground">修改后全表实时联动</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => applyRecommendation("small", "balanced")}
            className="btn-secondary px-3 py-2 text-xs"
          >
            小户平衡
          </button>
          <button
            type="button"
            onClick={() => applyRecommendation("large", "conservative")}
            className="btn-secondary px-3 py-2 text-xs"
          >
            大户保守
          </button>
        </div>
      </div>

      {isLargeCapital && (
        <div className="mb-4 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
          已进入大资金模式，山寨上限建议 ≤ {(config.largeCapitalAltcoinMaxRatio * 100).toFixed(0)}%
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="totalCapital" className="text-xs font-medium text-muted-foreground">
              总资金（U）
            </label>
            <input
              key={config.totalCapitalWu}
              id="totalCapital"
              type="text"
              inputMode="decimal"
              defaultValue={formatWuAsU(config.totalCapitalWu)}
              onBlur={commitCapital}
              onKeyDown={(e) => e.key === "Enter" && commitCapital()}
              className="input-surface"
            />
            <p className="text-xs text-muted-foreground">
              修改后将按当前配比重新分配各账户金额
            </p>
            {capitalError && (
              <p className="text-xs text-danger">{capitalError}</p>
            )}
            {capitalWarning && (
              <p className="text-xs text-warning">{capitalWarning}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cutPosition" className="text-xs font-medium text-muted-foreground">
              切割仓位金额（WU）
            </label>
            <input
              id="cutPosition"
              type="number"
              min={0}
              step={0.1}
              value={config.cutPositionWu}
              onChange={(e) => applyPatch({ cutPositionWu: Number(e.target.value) })}
              className="input-surface"
            />
          </div>
        </div>

        <InputSlider
          label="救命钱比例"
          value={config.emergencyRatio}
          min={0}
          max={0.5}
          onChange={(v) => applyPatch({ emergencyRatio: v })}
        />
        <InputSlider
          label="BTC 目标比例"
          value={config.btcRatio}
          min={0}
          max={0.8}
          onChange={(v) => applyPatch({ btcRatio: v })}
        />
        <InputSlider
          label="山寨币上限比例"
          value={config.altcoinMaxRatio}
          min={0}
          max={0.5}
          onChange={(v) => applyPatch({ altcoinMaxRatio: v })}
        />
        <InputSlider
          label="中账户比例"
          value={config.midAccountRatio}
          min={0}
          max={1}
          onChange={(v) => applyPatch({ midAccountRatio: v })}
        />
        <InputSlider
          label="小账户比例"
          value={config.smallAccountRatio}
          min={0}
          max={1}
          onChange={(v) => applyPatch({ smallAccountRatio: v })}
        />
        <InputSlider
          label="小账户可交易比例"
          value={config.smallTradableRatio}
          min={0}
          max={1}
          onChange={(v) => applyPatch({ smallTradableRatio: v })}
        />
      </div>
    </section>
  );
}
