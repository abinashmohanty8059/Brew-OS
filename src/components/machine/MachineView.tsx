"use client";

import { motion } from "motion/react";
import { MACHINE } from "@/data/config";
import { VendingMachine } from "./VendingMachine";
import { PreparationPanel } from "./PreparationPanel";
import { CleaningMode } from "./CleaningMode";

export function MachineView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(340px,440px)_minmax(0,1fr)] lg:gap-12 lg:px-10 lg:py-8">
        <motion.div
          className="lg:sticky lg:top-6 lg:self-start"
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <VendingMachine className="max-w-[440px]" />
          <p className="mt-4 text-center font-mono text-[10.5px] tracking-[0.14em] text-faint">
            {MACHINE.id} · {MACHINE.firmware}
          </p>
        </motion.div>

        <motion.div
          className="flex min-w-0 flex-col gap-4"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <PreparationPanel />
          <CleaningMode />
        </motion.div>
      </div>
    </div>
  );
}
