"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { PhoneShell } from "@/components/PhoneShell";

/**
 * Login / diagnostic lives full-bleed; the phone chrome only wraps the product.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { hydrated, sessionEntered } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/login";

  useEffect(() => {
    if (!hydrated) return;
    if (!sessionEntered && !onLogin) {
      router.replace("/login");
    } else if (sessionEntered && onLogin) {
      router.replace("/");
    }
  }, [hydrated, sessionEntered, onLogin, router]);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted">
        Loading Closer…
      </div>
    );
  }

  // Unauthenticated: only the login route renders content
  if (!sessionEntered) {
    if (!onLogin) {
      return (
        <div className="flex h-dvh items-center justify-center text-sm text-muted">
          Opening intake…
        </div>
      );
    }
    return <>{children}</>;
  }

  if (onLogin) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted">
        Entering Closer…
      </div>
    );
  }

  return <PhoneShell>{children}</PhoneShell>;
}
