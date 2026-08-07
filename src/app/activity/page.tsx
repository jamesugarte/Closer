"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — spending moved to /spending */
export default function ActivityRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/spending");
  }, [router]);
  return (
    <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
      Opening spending…
    </div>
  );
}
