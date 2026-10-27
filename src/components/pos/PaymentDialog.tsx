"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, CircleCheck, CircleX, CreditCard, LoaderCircle, Nfc, QrCode, ShieldCheck } from "lucide-react";
import type { PaymentMethod, PaymentOutcome } from "@/types";
import { useBrewStore } from "@/store/machine-store";
import { buildOrderLines, orderTotals } from "@/lib/order-engine";
import { formatINR } from "@/lib/currency";
import { SUGAR_LABELS } from "@/data/config";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { playSound } from "@/lib/sound";
import { cn } from "@/lib/cn";

type Phase = "select" | "processing" | "approved" | "failed";

const METHODS: Array<{ id: PaymentMethod; label: string; hint: string; icon: typeof QrCode }> = [
  { id: "upi", label: "UPI", hint: "Scan with any UPI app", icon: QrCode },
  { id: "card", label: "Card", hint: "Tap or insert on reader", icon: CreditCard },
  { id: "cash", label: "Cash", hint: "Insert notes, change returned", icon: Banknote },
];

const AUTH_MS = 1900;
const HANDOFF_MS = 1100;

/** Deterministic decorative QR-like pattern. Not a real or payable code. */
function DemoQr({ seed }: { seed: number }) {
  const cells: Array<[number, number]> = [];
  let x = seed * 9301 + 49297;
  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      x = (x * 9301 + 49297) % 233280;
      const finder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
      if (!finder && x / 233280 > 0.52) cells.push([r, c]);
    }
  }
  const finder = (x0: number, y0: number) => (
    <g key={`${x0}-${y0}`}>
      <rect x={x0} y={y0} width="7" height="7" fill="#f2ebdd" />
      <rect x={x0 + 1} y={y0 + 1} width="5" height="5" fill="#111114" />
      <rect x={x0 + 2} y={y0 + 2} width="3" height="3" fill="#f2ebdd" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" className="size-28" aria-label="Decorative demo QR pattern, not payable" role="img">
      {cells.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#f2ebdd" />
      ))}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
    </svg>
  );
}

export function PaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useBrewStore((s) => s.cart);
  const soundOn = useBrewStore((s) => s.settings.soundEnabled);
  const beginPayment = useBrewStore((s) => s.beginPayment);
  const settlePayment = useBrewStore((s) => s.settlePayment);
  const cancelPayment = useBrewStore((s) => s.cancelPayment);
  const acknowledgeError = useBrewStore((s) => s.acknowledgeError);
  const setView = useBrewStore((s) => s.setView);

  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [outcome, setOutcome] = useState<PaymentOutcome>("approve");
  const [phase, setPhase] = useState<Phase>("select");
  const [result, setResult] = useState<{ title: string; details: string[] } | null>(null);
  const [paidTotal, setPaidTotal] = useState(0);

  const timers = useRef<number[]>([]);
  const pendingOrder = useRef<string | null>(null);
  const phaseRef = useRef<Phase>("select");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const lines = buildOrderLines(cart);
  const totals = orderTotals(lines);

  // If the dialog unmounts mid-authorisation, void the pending payment so it never dangles.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      if (phaseRef.current === "processing" && pendingOrder.current) {
        useBrewStore.getState().cancelPayment(pendingOrder.current);
      }
    };
  }, []);

  const pay = () => {
    if (phase !== "select") return;
    const started = beginPayment(method);
    if (!started.ok || !started.orderId) {
      setResult({ title: started.message, details: started.details ?? [] });
      setPhase("failed");
      return;
    }
    const orderId = started.orderId;
    pendingOrder.current = orderId;
    setPaidTotal(totals.total);
    setPhase("processing");
    timers.current.push(
      window.setTimeout(() => {
        const settled = settlePayment(orderId, outcome);
        pendingOrder.current = null;
        if (settled.ok) {
          setPhase("approved");
          if (soundOn) playSound("complete");
          timers.current.push(
            window.setTimeout(() => {
              onClose();
              setView("machine");
            }, HANDOFF_MS),
          );
        } else {
          if (soundOn) playSound("error");
          setResult({ title: settled.message, details: settled.details ?? [] });
          setPhase("failed");
        }
      }, AUTH_MS),
    );
  };

  const close = () => {
    if (phase === "processing" || phase === "approved") return;
    if (phase === "failed") acknowledgeError();
    if (pendingOrder.current) cancelPayment(pendingOrder.current);
    onClose();
  };

  const retry = () => {
    acknowledgeError();
    setResult(null);
    setPhase("select");
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={phase === "select" || phase === "failed"}
      size="lg"
      eyebrow="Simulated checkout · demo only"
      title={phase === "approved" ? "Payment approved" : phase === "failed" ? "Payment not completed" : "Complete payment"}
      description={
        phase === "select" ? "No real payment is processed. Choose a method and a demo gateway outcome." : undefined
      }
      footer={
        phase === "select" ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={pay} data-autofocus disabled={cart.length === 0} icon={<ShieldCheck className="size-4" />}>
              Pay {formatINR(totals.total)}
            </Button>
          </>
        ) : phase === "failed" ? (
          <>
            <Button variant="ghost" onClick={close}>
              Back to order
            </Button>
            <Button variant="primary" onClick={retry} data-autofocus disabled={cart.length === 0}>
              Try again
            </Button>
          </>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {phase === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-5 p-5 sm:grid-cols-[1fr_1.15fr] sm:p-6"
          >
            <section aria-label="Order summary" className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <p className="eyebrow mb-3">Order summary</p>
              <ul className="flex flex-col gap-2.5">
                {lines.map((l) => (
                  <li key={`${l.productId}-${l.sugar}`} className="flex justify-between gap-3 text-[13px]">
                    <span className="min-w-0">
                      <span className="text-ivory">
                        {l.quantity} × {l.name}
                      </span>
                      {l.sugar && <span className="block text-[11px] text-faint">{SUGAR_LABELS[l.sugar]}</span>}
                    </span>
                    <span className="tabular text-ivory-dim">{formatINR(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-baseline justify-between border-t border-white/[0.06] pt-3">
                <span className="text-[13px] text-mute">Total (GST incl.)</span>
                <span className="text-[24px] font-semibold tracking-[-0.02em]">{formatINR(totals.total)}</span>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                        active ? "border-lime/50 bg-lime/[0.06]" : "border-white/[0.07] hover:border-white/15",
                      )}
                    >
                      <Icon className={cn("size-4", active ? "text-lime" : "text-mute")} aria-hidden />
                      <span className="text-[13px] font-medium">{m.label}</span>
                      <span className="text-[10.5px] leading-tight text-faint">{m.hint}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex min-h-[132px] items-center justify-center rounded-xl border border-white/[0.06] bg-black/25 p-4">
                {method === "upi" && (
                  <div className="flex items-center gap-4">
                    <DemoQr seed={totals.total + cart.length} />
                    <div className="text-[12px] leading-relaxed text-mute">
                      <p className="font-mono text-ivory-dim">brewos@demo</p>
                      <p>Demo pattern only.</p>
                      <p>Not a payable QR code.</p>
                    </div>
                  </div>
                )}
                {method === "card" && (
                  <div className="flex items-center gap-4 text-[12px] text-mute">
                    <div className="relative flex h-20 w-32 flex-col justify-between rounded-lg border border-white/10 bg-gradient-to-br from-ink-600 to-ink-800 p-2.5">
                      <Nfc className="size-4 text-ivory-dim" aria-hidden />
                      <span className="font-mono text-[10px] tracking-[0.2em] text-ivory-dim">•••• 4242</span>
                    </div>
                    <p className="max-w-[150px] leading-relaxed">Simulated contactless reader. No card data is collected.</p>
                  </div>
                )}
                {method === "cash" && (
                  <p className="max-w-[260px] text-center text-[12px] leading-relaxed text-mute">
                    Simulated note acceptor. Pretend to insert {formatINR(Math.ceil(totals.total / 100) * 100)}; change of{" "}
                    {formatINR(Math.ceil(totals.total / 100) * 100 - totals.total)} would be returned.
                  </p>
                )}
              </div>

              <div>
                <p className="eyebrow mb-2">Demo gateway outcome</p>
                <div role="radiogroup" aria-label="Demo gateway outcome" className="flex rounded-lg bg-black/30 p-1">
                  {(["approve", "decline"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={outcome === o}
                      onClick={() => setOutcome(o)}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-[12.5px] transition-colors",
                        outcome === o ? (o === "approve" ? "bg-lime/15 text-lime" : "bg-danger/15 text-[#ff8a7f]") : "text-faint hover:text-ivory-dim",
                      )}
                    >
                      {o === "approve" ? "Approve" : "Decline"}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-faint">Use Decline to test a failed payment — stock is never touched.</p>
              </div>
            </section>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5 px-6 py-12 text-center"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle className="size-10 text-lime anim-spin" aria-hidden />
            <div>
              <p className="text-[16px] font-medium">Authorising {formatINR(paidTotal)}</p>
              <p className="mt-1 text-[12.5px] text-mute">Contacting the simulated {method.toUpperCase()} gateway…</p>
            </div>
            <div className="h-1 w-56 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full bg-lime"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: AUTH_MS / 1000, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}

        {phase === "approved" && (
          <motion.div
            key="approved"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 px-6 py-12 text-center"
            role="status"
          >
            <svg viewBox="0 0 52 52" className="size-16" aria-hidden>
              <circle cx="26" cy="26" r="24" fill="none" stroke="rgba(200,243,60,0.2)" strokeWidth="2" />
              <motion.path
                d="M15 27 l7 7 l15 -16"
                fill="none"
                stroke="#c8f33c"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </svg>
            <div>
              <p className="text-[17px] font-medium">{formatINR(paidTotal)} approved</p>
              <p className="mt-1 text-[12.5px] text-mute">Stock committed · sending order to the machine…</p>
            </div>
          </motion.div>
        )}

        {phase === "failed" && result && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 px-6 py-10 text-center"
            role="alert"
          >
            <CircleX className="size-12 text-danger" strokeWidth={1.5} aria-hidden />
            <p className="text-[16px] font-medium">{result.title}</p>
            {result.details.length > 0 && (
              <ul className="flex max-w-md flex-col gap-1.5 text-left">
                {result.details.map((d) => (
                  <li key={d} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-[12.5px] leading-relaxed text-ivory-dim">
                    {d}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11.5px] text-faint">
              <CircleCheck className="mr-1 inline size-3 text-lime" aria-hidden />
              No inventory was deducted. Your order is still in the cart.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
