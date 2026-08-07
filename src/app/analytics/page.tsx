"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — cashflow lives under Cashflow; health on Home */
export default function AnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cashflow");
  }, [router]);
  return (
    <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
      Opening cashflow…
    </div>
  );
}
