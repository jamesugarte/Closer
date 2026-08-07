"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Lightbulb,
  Receipt,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/cashflow", label: "Cashflow", icon: ArrowLeftRight },
  { href: "/spending", label: "Spending", icon: Receipt },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/recommendations", label: "Recs", icon: Lightbulb },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="z-20 shrink-0 border-t border-black/5 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl"
      aria-label="Main"
    >
      <ul className="grid grid-cols-4 gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-deep)]"
                    : "text-[var(--muted)] hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("h-5 w-5", active && "stroke-[2.25]")}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
