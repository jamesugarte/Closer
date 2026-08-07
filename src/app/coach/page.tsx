"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy coach — tips live on Recommendations */
export default function CoachRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/recommendations");
  }, [router]);
  return (
    <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
      Opening recommendations…
    </div>
  );
}
