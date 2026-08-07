import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (shadcn-style helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as USD without cents when whole dollars. */
export function formatMoney(amount: number): string {
  const hasCents = Math.abs(amount % 1) > 0.001;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}

/** Format an ISO date like "September 28". */
export function formatLongDate(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC shift bugs). */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format Date → YYYY-MM-DD in local time. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Advance a YYYY-MM-DD calendar date by N months (demo clock). */
export function addMonths(isoDate: string, months: number): string {
  const d = parseLocalDate(isoDate);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

/** Time-of-day greeting for the home screen. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
