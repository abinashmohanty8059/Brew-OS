"use client";

import { create } from "zustand";
import type { MenuCategory } from "@/types";
import type { RestockTarget } from "./machine-store";

/** Transient, non-persisted UI state (open dialogs, filters). */
interface UiState {
  category: MenuCategory | "all";
  receiptOrderId: string | null;
  restock: { open: boolean; target: RestockTarget | null };
  ragOpen: boolean;
  /** Trace to show in the RAG Explorer; null means "latest". */
  ragTraceId: string | null;
  assistantOpen: boolean;
  orderSheetOpen: boolean;
  setCategory: (c: MenuCategory | "all") => void;
  openReceipt: (orderId: string) => void;
  closeReceipt: () => void;
  openRestock: (target?: RestockTarget | null) => void;
  closeRestock: () => void;
  setRagOpen: (open: boolean) => void;
  openRag: (traceId?: string | null) => void;
  setAssistantOpen: (open: boolean) => void;
  setOrderSheetOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  category: "all",
  receiptOrderId: null,
  restock: { open: false, target: null },
  ragOpen: false,
  ragTraceId: null,
  assistantOpen: false,
  orderSheetOpen: false,
  setCategory: (category) => set({ category }),
  openReceipt: (receiptOrderId) => set({ receiptOrderId }),
  closeReceipt: () => set({ receiptOrderId: null }),
  openRestock: (target = null) => set({ restock: { open: true, target } }),
  closeRestock: () => set((s) => ({ restock: { ...s.restock, open: false } })),
  setRagOpen: (ragOpen) => set(ragOpen ? { ragOpen, ragTraceId: null } : { ragOpen }),
  openRag: (ragTraceId = null) => set({ ragOpen: true, ragTraceId }),
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
  setOrderSheetOpen: (orderSheetOpen) => set({ orderSheetOpen }),
}));
