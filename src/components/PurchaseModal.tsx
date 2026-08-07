"use client";

import { X } from "lucide-react";
import { Button } from "./ui/button";
import { formatMoney } from "@/lib/utils";
import type { Goal } from "@/lib/types";

interface PurchaseModalProps {
  goal: Goal;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Extra $ pulled from checking to finish the reserve */
  surplusTopUp?: number;
  /** Current checking balance — shown so the debit is obvious */
  checkingBalance?: number;
  /** Current goal-reserve pot */
  goalReserveBalance?: number;
  error?: string | null;
}

export function PurchaseModal({
  goal,
  open,
  onClose,
  onConfirm,
  surplusTopUp = 0,
  checkingBalance,
  goalReserveBalance,
  error,
}: PurchaseModalProps) {
  if (!open) return null;

  const price = goal.targetPrice;
  const topUp = Math.max(0, surplusTopUp);
  const checkingAfter =
    checkingBalance != null
      ? Math.max(0, checkingBalance - topUp)
      : null;
  const reserveAfter =
    goalReserveBalance != null
      ? Math.max(0, goalReserveBalance + topUp - price)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-title"
    >
      <div className="animate-soft-in w-full max-w-[400px] rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Pay from wallet
            </p>
            <h2 id="purchase-title" className="font-display text-2xl font-semibold">
              {goal.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--muted)] hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="space-y-3 rounded-2xl bg-[var(--background)] p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Charge</dt>
            <dd className="font-semibold tabular-nums text-rose-700">
              −{formatMoney(price)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">From goal pot</dt>
            <dd className="font-medium tabular-nums">
              {formatMoney(Math.min(goal.fundedAmount, price))}
            </dd>
          </div>
          {topUp > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">From Student Checking</dt>
              <dd className="font-medium tabular-nums text-[var(--accent-deep)]">
                −{formatMoney(topUp)}
              </dd>
            </div>
          )}
          {checkingBalance != null && checkingAfter != null && (
            <div className="flex justify-between border-t border-black/5 pt-3">
              <dt className="text-[var(--muted)]">Checking after</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(checkingBalance)} → {formatMoney(checkingAfter)}
              </dd>
            </div>
          )}
          {goalReserveBalance != null && reserveAfter != null && (
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Goal reserves after</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(goalReserveBalance)} → {formatMoney(reserveAfter)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-black/5 pt-3">
            <dt className="font-medium">Leaves your wallet</dt>
            <dd className="font-semibold tabular-nums text-rose-700">
              −{formatMoney(price)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-[var(--muted)]">
          Confirming posts a spend on your statement, lowers free-to-spend by{" "}
          {formatMoney(price)}, updates Home / Activity / Analytics, and archives
          this goal.
        </p>

        {error && (
          <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <Button size="full" onClick={onConfirm}>
            Confirm · spend {formatMoney(price)}
          </Button>
          <Button size="full" variant="ghost" onClick={onClose}>
            Not yet
          </Button>
        </div>
      </div>
    </div>
  );
}
