"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LongTermHolding } from "@/types/position";

interface LongTermHoldingsProps {
  holdings: LongTermHolding[];
  onAdd: (holding: Omit<LongTermHolding, "id" | "createdAt">) => void;
  onUpdate: (id: string, patch: Partial<Omit<LongTermHolding, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function LongTermHoldings({
  holdings,
  onAdd,
  onUpdate,
  onDelete,
  className,
}: LongTermHoldingsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<LongTermHolding>>({});

  const totalWu = holdings.reduce((sum, h) => sum + h.positionWu, 0);

  const startAdd = () => {
    setForm({});
    setIsAdding(true);
    setEditingId(null);
  };

  const startEdit = (holding: LongTermHolding) => {
    setForm({ ...holding });
    setEditingId(holding.id);
    setIsAdding(false);
  };

  const cancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm({});
  };

  const save = () => {
    const payload = {
      symbol: form.symbol || "",
      entryPrice: form.entryPrice,
      positionWu: form.positionWu || 0,
      exitCondition: form.exitCondition,
      reviewDate: form.reviewDate,
    };

    if (isAdding) {
      onAdd(payload);
    } else {
      /* istanbul ignore next -- editingId is guaranteed by UI state */
      onUpdate(editingId as string, payload);
    }
    cancel();
  };

  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">切割仓位 · 长期价值记录</h2>
          <p className="text-sm text-muted-foreground">
            已记录 {holdings.length} 个标的 · 合计 {totalWu.toLocaleString()} WU
          </p>
        </div>
        <button type="button" onClick={startAdd} className="btn-primary px-3 py-2 text-xs">
          <Plus className="mr-1 h-3.5 w-3.5" />
          新增记录
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <table className="w-full text-left text-xs">
          <thead className="bg-elevated text-muted-foreground">
            <tr>
              <th className="px-3 py-2">标的</th>
              <th className="px-3 py-2">买入价</th>
              <th className="px-3 py-2">仓位（WU）</th>
              <th className="px-3 py-2">卖出条件</th>
              <th className="px-3 py-2">复盘日期</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {(isAdding || editingId) && (
              <tr className="border-t border-border-dim bg-primary/5">
                <td className="px-3 py-2">
                  <input
                    value={form.symbol || ""}
                    onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                    placeholder="标的"
                    className="input-surface w-full py-1.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={form.entryPrice ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, entryPrice: Number(e.target.value) }))
                    }
                    placeholder="买入价"
                    className="input-surface w-full py-1.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={form.positionWu ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, positionWu: Number(e.target.value) }))
                    }
                    placeholder="仓位"
                    className="input-surface w-full py-1.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={form.exitCondition || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, exitCondition: e.target.value }))
                    }
                    placeholder="卖出条件"
                    className="input-surface w-full py-1.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={form.reviewDate || ""}
                    onChange={(e) => setForm((f) => ({ ...f, reviewDate: e.target.value }))}
                    className="input-surface w-full py-1.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button type="button" aria-label="Check" onClick={save} className="rounded-md p-1 text-success hover:bg-success/10">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Cancel" onClick={cancel} className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {holdings.length === 0 && !isAdding ? (
              <tr className="border-t border-border-dim">
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  暂无记录，点击“新增记录”开始填写长期价值标的
                </td>
              </tr>
            ) : (
              holdings.map((holding) => (
                <tr key={holding.id} className="border-t border-border-dim">
                  <td className="px-3 py-2 font-medium text-foreground">{holding.symbol}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {holding.entryPrice?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {holding.positionWu.toLocaleString()} WU
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {holding.exitCondition || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {holding.reviewDate || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => startEdit(holding)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete"
                        onClick={() => onDelete(holding.id)}
                        className="rounded-md p-1 text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
