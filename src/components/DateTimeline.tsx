"use client";

import { CloserCalendar } from "./CloserCalendar";
import type { Recommendation } from "@/lib/types";

interface DateTimelineProps {
  originalDate: string;
  currentDate: string;
  isReady?: boolean;
  animateKey?: string;
  fundedAmount?: number;
  targetPrice?: number;
  dailyContributionRate?: number;
  desiredDate?: string;
  onDesiredDateChange?: (iso: string) => void;
  recommendations?: Recommendation[];
  onAcceptRecommendation?: (id: string) => void;
  demoToday?: string;
}

/** Goal detail — full interactive calendar (HUD only while dragging). */
export function DateTimeline(props: DateTimelineProps) {
  return (
    <CloserCalendar
      {...props}
      animateKey={props.animateKey ?? `${props.currentDate}-${props.isReady}`}
      demoToday={props.demoToday}
    />
  );
}
