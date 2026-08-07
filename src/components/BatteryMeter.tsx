"use client";

import { cn } from "@/lib/utils";

interface BatteryMeterProps {
  percent: number;
  className?: string;
  animate?: boolean;
  size?: "md" | "lg";
}

/**
 * Charging-style progress meter — visual metaphor for “funding the goal.”
 * Width animates via CSS transition when percent changes.
 */
export function BatteryMeter({
  percent,
  className,
  animate = true,
  size = "md",
}: BatteryMeterProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const complete = clamped >= 100;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">Funding</span>
        <span className="font-display text-sm font-semibold tabular-nums text-[var(--accent-deep)]">
          {clamped}%
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "relative flex-1 overflow-hidden rounded-full border border-black/8 bg-black/[0.04]",
            size === "lg" ? "h-5" : "h-3.5"
          )}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Goal funded ${clamped} percent`}
        >
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r from-[var(--accent)] via-[var(--highlight)] to-[#5eead4] transition-all duration-700 ease-out",
              animate && !complete && "animate-charge",
              complete && "from-[var(--success)] via-emerald-400 to-teal-300"
            )}
            style={{ width: `${clamped}%` }}
          />
        </div>
        {/* Battery tip */}
        <div
          className={cn(
            "rounded-r-sm border border-black/10 bg-black/10",
            size === "lg" ? "h-3 w-1.5" : "h-2.5 w-1"
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}
