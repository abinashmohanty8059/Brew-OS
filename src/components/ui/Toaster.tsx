"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "info" | "warning" | "error";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const timers = new Map<number, number>();

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (toast) => {
    // Collapse identical toasts fired in quick succession.
    if (get().toasts.some((t) => t.title === toast.title && t.message === toast.message)) return;
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    const ttl = toast.tone === "error" ? 7000 : 4500;
    timers.set(id, window.setTimeout(() => get().dismiss(id), ttl));
  },
  dismiss: (id) => {
    window.clearTimeout(timers.get(id));
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = (tone: ToastTone, title: string, message?: string) =>
  useToasts.getState().push({ tone, title, message });

const ICONS = { success: CircleCheck, info: Info, warning: TriangleAlert, error: CircleAlert };
const TONES = {
  success: "text-lime",
  info: "text-aqua",
  warning: "text-amber",
  error: "text-danger",
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)]"
              role={t.tone === "error" ? "alert" : "status"}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONES[t.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ivory">{t.title}</p>
                {t.message && <p className="mt-0.5 text-[12px] leading-relaxed text-mute">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded p-0.5 text-faint hover:text-ivory"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
