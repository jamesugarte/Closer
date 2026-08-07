"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, KeyRound, RotateCcw, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatLongDate, formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Interview / demo master key — lives outside the phone chrome.
 * Not part of Maya’s product UI.
 */
export function DemoMasterKey() {
  const {
    state,
    hydrated,
    sessionEntered,
    simulateMonths,
    simulateQuietMonth,
    resetDemo,
    exitToLogin,
  } = useApp();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (!hydrated || !sessionEntered) return null;

  const yearLabel = (
    ["", "Frosh", "Soph", "Junior", "Senior"] as const
  )[state.user.collegeYear ?? 1];

  return (
    <div
      ref={panelRef}
      className="pointer-events-auto fixed right-3 top-3 z-[100] sm:right-5 sm:top-5"
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-amber-500/40 bg-[#12141a] text-amber-200 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/10 transition hover:border-amber-400/70 hover:bg-[#1a1d26]"
          aria-label="Open demo master key"
          title="Demo master key — interview controls"
        >
          <KeyRound className="h-5 w-5 text-amber-300" />
          <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-200/70">
            Key
          </span>
        </button>
      ) : (
        <div className="w-[min(18.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-amber-500/35 bg-[#12141a] text-zinc-100 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.75)] ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-2 border-b border-white/10 bg-amber-500/10 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-300">
                Master key · demo only
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-zinc-400">
                Outside the product — interviewer controls
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Close master key"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 px-3 py-3">
            <div className="rounded-xl bg-black/35 px-3 py-2.5">
              <div className="flex items-center gap-2 text-amber-200">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <p className="text-[9px] font-semibold uppercase tracking-wider">
                  Demo clock
                </p>
              </div>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
                {formatLongDate(state.demoToday)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {yearLabel} · Y{state.user.collegeYear ?? 1}/4 ·{" "}
                {state.monthsAdvanced} mo from frosh start
              </p>
              <p className="mt-1 text-[10px] text-zinc-500">
                Checking {formatMoney(state.user.checkingBalance)} · Goals{" "}
                {formatMoney(state.user.goalReserveBalance)} · Wallet{" "}
                {formatMoney(
                  state.user.checkingBalance +
                    state.user.goalReserveBalance +
                    state.user.riskReserveBalance
                )}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                Advance time · watch the calendar
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <HudButton onClick={() => simulateMonths(1)}>+1 mo</HudButton>
                <HudButton onClick={() => simulateMonths(3)}>+3 mo</HudButton>
                <HudButton onClick={() => simulateMonths(12)}>+1 yr</HudButton>
              </div>
              <p className="mt-1.5 text-[9px] leading-snug text-zinc-500">
                After tips: +1 yr paints health green/red on Home · Cashflow
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                Scenarios
              </p>
              <HudButton
                className="w-full"
                onClick={() => {
                  simulateQuietMonth();
                }}
              >
                Quiet month · risk rollover tip
              </HudButton>
            </div>

            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm("Reset this profile to its opening state?")
                ) {
                  resetDemo();
                  setOpen(false);
                }
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset profile
            </button>

            <button
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm("Leave this profile and return to login?")
                ) {
                  exitToLogin();
                  setOpen(false);
                  if (typeof window !== "undefined") {
                    window.location.assign("/login");
                  }
                }
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 py-2 text-[11px] font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Switch profile / login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HudButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-semibold text-zinc-100 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-50",
        className
      )}
    >
      {children}
    </button>
  );
}
