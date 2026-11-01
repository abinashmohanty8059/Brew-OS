/* ──────────────────────────────────────────────────────────────
   BREW.OS domain types — shared by data, engines, store and UI.
   ────────────────────────────────────────────────────────────── */

// ── Inventory ────────────────────────────────────────────────────
export type IngredientId = "coffee" | "water" | "milk" | "sugar" | "chocolate" | "tea" | "spice" | "ice";
export type ConsumableId = "cups" | "cleaningAgent";
export type ResourceId = IngredientId | ConsumableId;
export type Unit = "g" | "ml" | "cups";
export type StockStatus = "normal" | "low" | "critical" | "empty";

export interface ResourceLevel {
  id: ResourceId;
  label: string;
  unit: Unit;
  quantity: number;
  capacity: number;
  /** At or below this quantity the resource is "low". */
  lowThreshold: number;
  /** At or below this quantity the resource is "critical". */
  criticalThreshold: number;
}

export type Inventory = Record<ResourceId, ResourceLevel>;

export interface PackagedStock {
  productId: string;
  quantity: number;
  capacity: number;
  lowThreshold: number;
}

export type PackagedInventory = Record<string, PackagedStock>;

/** What an order (or a cleaning cycle) takes out of the machine. */
export interface Consumption {
  resources: Partial<Record<ResourceId, number>>;
  packaged: Record<string, number>;
}

export interface Shortage {
  id: string;
  label: string;
  unit: Unit | "units";
  required: number;
  available: number;
}

// ── Catalogue ────────────────────────────────────────────────────
export type MenuCategory = "espresso" | "black" | "milk" | "specialty" | "cold" | "tea" | "pantry";
export type ProductKind = "prepared_drink" | "packaged_item";
export type SugarLevel = "none" | "light" | "regular" | "extra";
export type PrepStage = "GRINDING" | "BREWING" | "MIXING" | "DISPENSING";

export interface RecipeStep {
  stage: PrepStage;
  label: string;
  detail: string;
  seconds: number;
}

export type VesselType = "demitasse" | "cup" | "glass" | "mug" | "iced";

export interface DrinkVisual {
  vessel: VesselType;
  /** Liquid layers from bottom to top; ratios are relative fill heights. */
  layers: Array<{ color: string; ratio: number }>;
  foam?: string;
  garnish?: "cocoa" | "leaf" | "lemon" | "spice" | "ice";
  accent: string;
}

export type PackagedIcon = "water";

export interface Faq {
  q: string;
  a: string;
}

interface ProductBase {
  id: string;
  name: string;
  category: MenuCategory;
  /** Price in INR (whole rupees). */
  price: number;
  description: string;
  tagline: string;
  /** Operator-controlled listing flag. Stock availability is computed separately. */
  listed: boolean;
}

export interface PreparedDrink extends ProductBase {
  kind: "prepared_drink";
  /** True for the seven core coffees that lead the menu. */
  primary: boolean;
  temperature: "hot" | "iced";
  /** 1 (gentle) → 5 (intense). */
  strength: 1 | 2 | 3 | 4 | 5;
  caffeineMg: number;
  /** Base recipe per serving, before sugar. Units: g / ml as defined in inventory. */
  recipe: Partial<Record<IngredientId, number>>;
  steps: RecipeStep[];
  /** Sum of step durations, in seconds. */
  prepSeconds: number;
  allowsSugar: boolean;
  defaultSugar: SugarLevel;
  tasteProfile: string;
  sugarRecommendation: string;
  faqs: Faq[];
  visual: DrinkVisual;
}

export interface PackagedItem extends ProductBase {
  kind: "packaged_item";
  icon: PackagedIcon;
  accent: string;
  unitLabel: string;
}

export type Product = PreparedDrink | PackagedItem;

// ── Cart & orders ────────────────────────────────────────────────
export interface CartLine {
  id: string;
  productId: string;
  quantity: number;
  /** Null for packaged items. */
  sugar: SugarLevel | null;
}

export type PaymentMethod = "upi" | "card" | "cash";
export type PaymentOutcome = "approve" | "decline";
export type OrderStatus = "draft" | "awaiting_payment" | "paid" | "preparing" | "completed" | "failed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "declined" | "cancelled";
export type DispenseStatus = "pending" | "in_progress" | "dispensed" | "not_dispensed";

export interface OrderLine {
  productId: string;
  name: string;
  kind: ProductKind;
  unitPrice: number;
  quantity: number;
  sugar: SugarLevel | null;
  lineTotal: number;
}

export interface Order {
  id: string;
  number: number;
  createdAt: number;
  updatedAt: number;
  lines: OrderLine[];
  itemCount: number;
  drinkCount: number;
  subtotal: number;
  total: number;
  paymentMethod: PaymentMethod | null;
  paymentRef: string | null;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  dispenseStatus: DispenseStatus;
  /** Recorded once, at commit time. Null when nothing was consumed. */
  consumption: Consumption | null;
  failureReason: string | null;
  completedAt: number | null;
}

// ── Machine ──────────────────────────────────────────────────────
export type MachineState =
  | "IDLE"
  | "ORDER_RECEIVED"
  | "VALIDATING"
  | "GRINDING"
  | "BREWING"
  | "MIXING"
  | "DISPENSING"
  | "COMPLETED"
  | "CLEANING"
  | "ERROR";

export type DispensePhase = "pour" | "present" | "vend";

export interface PrepUnit {
  index: number;
  productId: string;
  name: string;
  kind: ProductKind;
  sugar: SugarLevel | null;
}

export interface PlanStep {
  id: string;
  state: MachineState;
  label: string;
  detail: string;
  durationMs: number;
  unitIndex: number | null;
  phase?: DispensePhase;
  /** Display-only breakdown of what this step uses (already deducted at commit). */
  consumes: Partial<Record<ResourceId, number>>;
}

export interface PrepRun {
  orderId: string;
  units: PrepUnit[];
  plan: PlanStep[];
  stepIndex: number;
  stepStartedAt: number;
  startedAt: number;
}

export type CleaningStageId = "pre_rinse" | "circulation" | "flush" | "final_rinse" | "drying";

export interface CleaningStage {
  id: CleaningStageId;
  label: string;
  detail: string;
  seconds: number;
}

export interface CleaningRun {
  id: string;
  startedAt: number;
  stageIndex: number;
  stageStartedAt: number;
}

export interface MachineError {
  message: string;
  details: string[];
  at: number;
}

export interface MachineSnapshot {
  state: MachineState;
  prep: PrepRun | null;
  cleaning: CleaningRun | null;
  error: MachineError | null;
  lastCompletedOrderId: string | null;
  lastCleanedAt: number | null;
  /** Number of completed brew orders since the last cleaning cycle. */
  ordersSinceClean: number;
}

// ── Activity log ─────────────────────────────────────────────────
export type EventLevel = "info" | "success" | "warning" | "error";
export type EventKind = "order" | "payment" | "inventory" | "cleaning" | "machine" | "system";

export interface MachineEvent {
  id: string;
  at: number;
  level: EventLevel;
  kind: EventKind;
  message: string;
}

export interface Rejection {
  at: number;
  orderId: string | null;
  reasons: string[];
}

export type AppView = "pos" | "machine" | "operator";

export interface Settings {
  soundEnabled: boolean;
  /** Spoken voice guide (Web Speech API). */
  voiceEnabled: boolean;
  speed: 1 | 2 | 4;
}
