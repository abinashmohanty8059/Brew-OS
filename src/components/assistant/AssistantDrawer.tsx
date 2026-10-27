"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useUi } from "@/store/ui-store";
import { BrewAssistant } from "./BrewAssistant";

/** Slide-over version of BREW AI, reachable from any view via the top bar. */
export function AssistantDrawer() {
  const open = useUi((s) => s.assistantOpen);
  const setOpen = useUi((s) => s.setAssistantOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="BREW AI assistant">
          <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div
            className="absolute bottom-3 right-3 top-3 flex w-[min(440px,calc(100vw-1.5rem))] flex-col"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <BrewAssistant className="h-full" autoFocus onClose={() => setOpen(false)} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
