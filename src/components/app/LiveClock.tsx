"use client";

import { useEffect, useState } from "react";
import { formatTime } from "@/lib/currency";

export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time dateTime={new Date(now).toISOString()} className={className}>
      {formatTime(now)}
    </time>
  );
}

/** Re-renders on an interval; used for countdowns and progress bars. */
export function useNow(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
