import {
  Backpack,
  Headphones,
  MapPin,
  Palette,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import type { GoalCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export const categoryMeta: Record<
  GoalCategory,
  { icon: LucideIcon; gradient: string; label: string }
> = {
  Technology: {
    icon: Headphones,
    gradient: "from-[#0f766e] via-[#0d9488] to-[#5eead4]",
    label: "Technology",
  },
  Travel: {
    icon: MapPin,
    gradient: "from-[#0369a1] via-[#0ea5e9] to-[#7dd3fc]",
    label: "Travel",
  },
  Fashion: {
    icon: Palette,
    gradient: "from-[#9f1239] via-[#e11d48] to-[#fb7185]",
    label: "Fashion",
  },
  Experiences: {
    icon: Ticket,
    gradient: "from-[#b45309] via-[#f59e0b] to-[#fcd34d]",
    label: "Experiences",
  },
  School: {
    icon: Backpack,
    gradient: "from-[#1e3a5f] via-[#334155] to-[#94a3b8]",
    label: "School",
  },
  Other: {
    icon: Sparkles,
    gradient: "from-[#4c1d95] via-[#7c3aed] to-[#c4b5fd]",
    label: "Other",
  },
};

export function GoalArt({
  category,
  name,
  className,
}: {
  category: GoalCategory;
  name: string;
  className?: string;
}) {
  const meta = categoryMeta[category] ?? categoryMeta.Other;
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br shadow-inner",
        meta.gradient,
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
      <Icon className="relative h-9 w-9 text-white drop-shadow-sm" strokeWidth={1.5} />
      <span className="sr-only">{name}</span>
    </div>
  );
}
