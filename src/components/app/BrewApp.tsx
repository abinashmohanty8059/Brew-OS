"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useBrewStore } from "@/store/machine-store";
import { PosScreen } from "@/components/pos/PosScreen";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { MachineView } from "@/components/machine/MachineView";
import { MachineDriver } from "@/components/machine/MachineDriver";
import { OperatorDashboard } from "@/components/dashboard/OperatorDashboard";
import { RestockDialog } from "@/components/inventory/RestockDialog";
import { AssistantDrawer } from "@/components/assistant/AssistantDrawer";
import { RagExplorer } from "@/components/rag/RagExplorer";
import { Toaster } from "@/components/ui/Toaster";
import { BrandMark, Wordmark } from "./BrandMark";
import { StatusStrip } from "./StatusStrip";
import { SystemNotifier } from "./SystemNotifier";
import { TopBar } from "./TopBar";

function BootScreen() {
  return (
    <div className="ambient flex h-dvh flex-col items-center justify-center gap-5" role="status" aria-label="Loading BREW.OS">
      <BrandMark className="size-12" />
      <Wordmark className="text-[18px] text-ivory" />
      <div className="h-px w-40 overflow-hidden bg-white/[0.06]">
        <div className="anim-shimmer h-full w-full" />
      </div>
      <p className="eyebrow">Initialising machine</p>
    </div>
  );
}

const VIEW_MOTION = {
  pos: {
    initial: { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40, scale: 0.98, filter: "blur(4px)" },
  },
  machine: {
    initial: { opacity: 0, scale: 1.035, filter: "blur(6px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.98 },
  },
  operator: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
  },
} as const;

export function BrewApp() {
  const [ready, setReady] = useState(false);
  const view = useBrewStore((s) => s.view);

  // Hydrate persisted state on the client only, so the server render never
  // depends on localStorage or the clock.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(useBrewStore.persist.rehydrate()).finally(() => {
      if (cancelled) return;
      const store = useBrewStore.getState();
      // A payment can't survive a reload; void any that were mid-authorisation.
      store.orders.filter((o) => o.status === "awaiting_payment").forEach((o) => store.cancelPayment(o.id));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return <BootScreen />;

  const m = VIEW_MOTION[view];

  return (
    <MotionConfig reducedMotion="user">
      <div className="ambient flex h-dvh flex-col overflow-hidden">
        <TopBar />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="h-full"
              initial={m.initial}
              animate={m.animate}
              exit={m.exit}
              transition={{ duration: view === "machine" ? 0.6 : 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {view === "pos" && <PosScreen />}
              {view === "machine" && <MachineView />}
              {view === "operator" && <OperatorDashboard />}
            </motion.div>
          </AnimatePresence>
        </div>
        <StatusStrip />
      </div>
      <MachineDriver />
      <SystemNotifier />
      <ReceiptDialog />
      <RestockDialog />
      <AssistantDrawer />
      <RagExplorer />
      <Toaster />
    </MotionConfig>
  );
}
