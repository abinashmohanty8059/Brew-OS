# BREW.OS — Intelligence in Every Pour

A cinematic simulator of a premium autonomous coffee vending machine: a POS-first ordering screen, a real inventory engine, an animated machine that grinds, brews and dispenses, auto-cleaning, an offline assistant (BREW AI) and an inspectable **mock** RAG pipeline.

Everything runs locally. There is no database, payment gateway, auth provider or AI API.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 (or: npm run dev -- --port 3100)
```

| Command | What it does |
| --- | --- |
| `npm run build` | Production build |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Unit tests for the inventory, order, machine and assistant engines |
| `npm run lint` | ESLint |

## A two-minute demo

1. Add **2 × Latte** and **1 × Mocha** on the POS, then press **Pay & dispense**.
2. Choose UPI, card or cash (all simulated), keep **Approve** and pay.
3. Watch the machine prepare the three drinks in sequence. Milk, coffee, water, chocolate and cups drop the moment payment succeeds.
4. Open **Operator** to see revenue, drinks served, the transaction and the event log.
5. Ask BREW AI *“How much milk is left?”*, then click **Inspect trace** to open the RAG Explorer on that exact query.
6. Start a cleaning cycle and try to order: checkout stays disabled until it completes.

To test failure paths, choose **Decline** at checkout, or lower stock from the Operator dashboard.

## What's inside

- **POS:** menu categories, seven signature coffees plus cold drinks, teas and packaged items. Quantity and sugar controls (0/5/10/15 g). A live "will use" preview. Prices formatted with `Intl.NumberFormat('en-IN')` in ₹.
- **Inventory engine:** coffee, milk, water, sugar, chocolate, tea, masala, ice, cups and cleaning agent, each with a capacity, low/critical thresholds and a status (Normal / Low / Critical / Empty). Packaged items track unit stock and never use cups.
- **Transactional commit:** `processOrder()` validates the whole order (machine readiness, every ingredient, cups, packaged units), then deducts everything at once, or nothing.
- **Machine:** a CSS/SVG machine with a display, brewing chamber, live ingredient meters, cup stack, nozzle stream, filling cup, collection slot and status LEDs. A typed state machine runs `IDLE → ORDER_RECEIVED → VALIDATING → GRINDING → BREWING → MIXING → DISPENSING → COMPLETED`, plus `CLEANING` and `ERROR`.
- **Auto-clean:** five stages, with agent and water deducted once at start. Cancel stops the cycle without a refund (demo policy). Duplicate starts are refused.
- **Operator dashboard:** KPIs, low-stock warnings, cup dispenser, restock dialog (quantity and alert threshold), revenue chart and table, transactions with receipts, event log, demo speed (1×/2×/4×), and a confirmed reset.
- **BREW AI:** offline intent matching (normalize → synonyms → entities → intent), deterministic retrieval over a 33-document local corpus, and template-based answers filled with live state. Replies stream token by token.
- **RAG Explorer:** the actual trace of each chat query. It shows normalization, intent scores, the top-3 documents with keyword/tag/intent/entity score breakdowns, highlighted passages, the assembled context, the template and its slots (knowledge vs live), and the final answer. A searchable corpus viewer is included.
- **Sound:** optional synthesized Web Audio cues, off by default.
- **State:** a single Zustand store persisted to `localStorage`, hydrated on the client only.

## Demo policies

- **Stock:** nothing is reserved while you browse or while payment is pending. Stock is re-validated and consumed atomically when the simulated payment is approved. Declined or cancelled payments never touch inventory. Animations never change stock.
- **Rejected at commit:** if stock changed since checkout opened, the order fails, the authorisation is voided, and the machine shows a fault naming the missing resource.
- **Cleaning:** cancelling a cycle does not refund cleaning agent.

## About the "RAG"

It is a **simulated pipeline**: a local mock corpus, deterministic keyword scoring and template-based generation. No embedding model, vector database or LLM is involved. The retrieval weights (keyword 50%, tag 20%, intent 20%, entity 10%) are configurable illustrative values in `src/lib/assistant/knowledge-base.ts`, not measured accuracy.

## Project structure

```
src/
  app/                 layout, page, design tokens (globals.css)
  components/
    app/               shell: top bar, status strip, boot gate, notifier
    pos/               POS screen, product cards, order panel, payment, receipt
    machine/           vending machine visual, display, preparation, cleaning, driver
    inventory/         gauges, inventory sidebar, restock dialog
    dashboard/         operator dashboard, cup dispenser, chart, history, event log
    assistant/         BREW AI panel, messages, drawer
    rag/               RAG Explorer, pipeline stages, retrieved docs, corpus viewer
    product/           SVG drink art generated from recipe layers
    ui/                button, dialog, toaster, tooltip, status, rich text
  data/                config, coffee recipes, products, initial inventory, RAG corpus
  lib/                 inventory / order / machine engines, currency, sound
    assistant/         intent matcher, knowledge base, retrieval, responses, pipeline
  store/               shared Zustand store, UI store, selectors
  types/               domain types
```

Recipe quantities are simulation values, not manufacturer specifications. Edit them in `src/data/coffee-recipes.ts` and `src/data/products.ts`; inventory deductions, the assistant and the corpus all derive from those files.
