"use client";

import Link from "next/link";
import { BottomNav } from "./BottomNav";
import { DemoMasterKey } from "./DemoMasterKey";

export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh min-h-0 items-stretch justify-center px-0 py-0 sm:px-4 sm:py-6">
      <DemoMasterKey />

      <div className="relative flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbf9_0%,#f3f1ec_100%)] shadow-none sm:h-[min(780px,calc(100dvh-3rem))] sm:rounded-[2rem] sm:border sm:border-black/5 sm:shadow-[0_30px_80px_-40px_rgba(10,30,25,0.55)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden h-7 items-center justify-center sm:flex">
          <div className="mt-2 h-1.5 w-24 rounded-full bg-black/10" />
        </div>
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-black/5 bg-white/70 px-4 py-2.5 backdrop-blur-xl sm:mt-6">
          <Link
            href="/"
            className="font-display text-lg font-semibold tracking-tight text-[var(--accent-deep)]"
          >
            Closer
          </Link>
          <Link
            href="/"
            className="text-[11px] font-medium text-[var(--muted)] hover:text-foreground"
          >
            Health
          </Link>
        </header>
        <main className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
