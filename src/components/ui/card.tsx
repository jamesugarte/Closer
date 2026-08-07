import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/60 bg-[var(--card)] p-4 shadow-[0_10px_40px_-24px_rgba(15,40,35,0.45)] backdrop-blur-md",
        className
      )}
      {...props}
    />
  );
}
