import type { Unit } from "@/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

/** Formats whole rupees, e.g. ₹1,23,456. The only currency formatter in the app. */
export function formatINR(amount: number): string {
  return inr.format(Math.round(amount));
}

export function formatNumber(n: number): string {
  return number.format(n);
}

export function formatQty(n: number, unit: Unit | "units"): string {
  const label = unit === "cups" ? (n === 1 ? "cup" : "cups") : unit === "units" ? (n === 1 ? "unit" : "units") : unit;
  return `${number.format(n)} ${label}`;
}

const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
const timeSec = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export const formatTime = (ts: number) => time.format(ts);
export const formatTimeSeconds = (ts: number) => timeSec.format(ts);
export const formatDateTime = (ts: number) => dateTime.format(ts);

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
