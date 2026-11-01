import type { PackagedItem, PreparedDrink, Product } from "@/types";
import { COFFEE_RECIPES, defineDrink } from "./coffee-recipes";

/* Additional prepared drinks. Same recipe model as the core coffees. */
export const EXTRA_DRINKS: PreparedDrink[] = [
  defineDrink({
    id: "cold-coffee",
    name: "Cold Coffee",
    category: "cold",
    primary: false,
    price: 179,
    tagline: "Frothy, sweet, ice-shaken",
    description: "Espresso blended with chilled milk, sugar and ice into a frothy Indian café classic.",
    temperature: "iced",
    strength: 2,
    caffeineMg: 128,
    recipe: { coffee: 18, water: 36, milk: 160, ice: 120 },
    steps: [
      { stage: "GRINDING", label: "Grinding beans", detail: "18 g ground for espresso", seconds: 2.2 },
      { stage: "BREWING", label: "Extracting shot", detail: "36 ml shot flash-chilled on contact", seconds: 3 },
      { stage: "MIXING", label: "Blending", detail: "160 ml chilled milk and sugar blended until frothy", seconds: 3 },
      { stage: "DISPENSING", label: "Dispensing over ice", detail: "Poured over 120 g of ice", seconds: 2.4 },
    ],
    allowsSugar: true,
    defaultSugar: "regular",
    tasteProfile: "Creamy, sweet and refreshing with a frothy head and mellow coffee flavour.",
    sugarRecommendation: "Regular sugar is the classic; Extra for a milkshake-style treat.",
    faqs: [
      { q: "What is the recipe for cold coffee?", a: "18 g coffee as a 36 ml shot, 160 ml chilled milk, 120 g ice and sugar to taste, blended until frothy." },
      { q: "Is cold coffee the same as iced latte?", a: "No — cold coffee is blended and usually sweetened; an iced latte is layered and unsweetened." },
    ],
    visual: {
      vessel: "iced",
      layers: [
        { color: "#8a5a3b", ratio: 0.55 },
        { color: "#c9a27c", ratio: 0.2 },
      ],
      foam: "#e9d8c0",
      garnish: "ice",
      accent: "#c59466",
    },
  }),
  defineDrink({
    id: "iced-latte",
    name: "Iced Latte",
    category: "cold",
    primary: false,
    price: 189,
    tagline: "Layered espresso over cold milk",
    description: "Cold milk and ice crowned with a double shot that cascades through the glass.",
    temperature: "iced",
    strength: 2,
    caffeineMg: 128,
    recipe: { coffee: 18, water: 36, milk: 160, ice: 120 },
    steps: [
      { stage: "GRINDING", label: "Grinding beans", detail: "18 g ground for espresso", seconds: 2.2 },
      { stage: "BREWING", label: "Extracting shot", detail: "36 ml double shot", seconds: 3.2 },
      { stage: "MIXING", label: "Chilling milk", detail: "160 ml cold milk poured over 120 g ice", seconds: 2 },
      { stage: "DISPENSING", label: "Layering", detail: "Shot floated over the milk", seconds: 2.4 },
    ],
    allowsSugar: true,
    defaultSugar: "none",
    tasteProfile: "Clean and milky with a bold espresso top note; unsweetened by default.",
    sugarRecommendation: "Light sugar dissolves well before the milk is chilled.",
    faqs: [{ q: "How is an iced latte made?", a: "Ice and 160 ml cold milk in a glass, then a 36 ml double shot poured over the top." }],
    visual: {
      vessel: "iced",
      layers: [
        { color: "#e8dcc8", ratio: 0.5 },
        { color: "#a77750", ratio: 0.15 },
        { color: "#3b2216", ratio: 0.12 },
      ],
      garnish: "ice",
      accent: "#d8b48c",
    },
  }),
  defineDrink({
    id: "hot-chocolate",
    name: "Hot Chocolate",
    category: "tea",
    primary: false,
    price: 169,
    tagline: "Thick 54% dark cocoa",
    description: "35 g of dark chocolate melted into 200 ml of steamed milk. Caffeine-light and indulgent.",
    temperature: "hot",
    strength: 1,
    caffeineMg: 20,
    recipe: { chocolate: 35, milk: 200 },
    steps: [
      { stage: "BREWING", label: "Melting chocolate", detail: "35 g dark chocolate melted with a splash of milk", seconds: 2.6 },
      { stage: "MIXING", label: "Whisking milk", detail: "200 ml steamed milk whisked into the ganache", seconds: 3 },
      { stage: "DISPENSING", label: "Dispensing", detail: "Poured into a mug with cocoa dusting", seconds: 2.4 },
    ],
    allowsSugar: true,
    defaultSugar: "light",
    tasteProfile: "Rich, velvety and bittersweet with a long cocoa finish.",
    sugarRecommendation: "Light sugar balances the 54% chocolate; Extra for a children's-style cocoa.",
    faqs: [
      { q: "What is in hot chocolate?", a: "35 g dark chocolate and 200 ml steamed milk, with Light sugar by default." },
      { q: "Does hot chocolate have caffeine?", a: "A little — about 20 mg from the cocoa, far less than coffee." },
    ],
    visual: { vessel: "mug", layers: [{ color: "#4a2616", ratio: 0.78 }], foam: "#8a5434", garnish: "cocoa", accent: "#9b5a35" },
  }),
  defineDrink({
    id: "tea",
    name: "Tea",
    category: "tea",
    primary: false,
    price: 79,
    tagline: "Assam CTC, milky and brisk",
    description: "Strong Assam CTC leaves brewed in hot water and finished with milk.",
    temperature: "hot",
    strength: 2,
    caffeineMg: 45,
    recipe: { tea: 4, water: 150, milk: 50 },
    steps: [
      { stage: "BREWING", label: "Steeping leaves", detail: "4 g Assam CTC steeped in 150 ml water at 98 °C", seconds: 3.4 },
      { stage: "MIXING", label: "Adding milk", detail: "50 ml milk and sugar stirred through", seconds: 2 },
      { stage: "DISPENSING", label: "Dispensing", detail: "Strained into a cup", seconds: 2.2 },
    ],
    allowsSugar: true,
    defaultSugar: "regular",
    tasteProfile: "Malty and brisk with a smooth milky body.",
    sugarRecommendation: "Regular sugar is customary.",
    faqs: [{ q: "How is the tea made?", a: "4 g Assam CTC steeped in 150 ml hot water, then 50 ml milk and sugar added." }],
    visual: { vessel: "cup", layers: [{ color: "#a86f3f", ratio: 0.8 }], accent: "#c48b55" },
  }),
  defineDrink({
    id: "masala-chai",
    name: "Masala Chai",
    category: "tea",
    primary: false,
    price: 99,
    tagline: "Cardamom, ginger, clove, cinnamon",
    description: "Assam tea simmered with a house masala blend, milk and sugar — the street-side classic.",
    temperature: "hot",
    strength: 2,
    caffeineMg: 50,
    recipe: { tea: 5, spice: 2, water: 100, milk: 100 },
    steps: [
      { stage: "BREWING", label: "Simmering masala", detail: "5 g tea and 2 g masala simmered in 100 ml water", seconds: 3.6 },
      { stage: "MIXING", label: "Boiling with milk", detail: "100 ml milk added and brought to a rolling boil", seconds: 2.8 },
      { stage: "DISPENSING", label: "Straining", detail: "Strained into a cup", seconds: 2.2 },
    ],
    allowsSugar: true,
    defaultSugar: "regular",
    tasteProfile: "Warming and aromatic — cardamom and ginger up front, clove and cinnamon finish.",
    sugarRecommendation: "Regular or Extra sugar, the way chai is traditionally served.",
    faqs: [
      { q: "What is the recipe for masala chai?", a: "5 g Assam tea and 2 g masala (cardamom, ginger, clove, cinnamon) simmered in 100 ml water, then boiled with 100 ml milk and sugar." },
      { q: "Is masala chai spicy?", a: "It is aromatic and warming rather than hot; ginger gives a gentle bite." },
    ],
    visual: { vessel: "cup", layers: [{ color: "#b07a48", ratio: 0.82 }], garnish: "spice", accent: "#d39a5e" },
  }),
  defineDrink({
    id: "green-tea",
    name: "Green Tea",
    category: "tea",
    primary: false,
    price: 89,
    tagline: "Light, grassy, clean",
    description: "Whole-leaf Darjeeling green tea steeped at a gentle 80 °C.",
    temperature: "hot",
    strength: 1,
    caffeineMg: 30,
    recipe: { tea: 3, water: 200 },
    steps: [
      { stage: "BREWING", label: "Steeping leaves", detail: "3 g green tea steeped in 200 ml water at 80 °C", seconds: 3.4 },
      { stage: "DISPENSING", label: "Dispensing", detail: "Strained into a cup", seconds: 2 },
    ],
    allowsSugar: true,
    defaultSugar: "none",
    tasteProfile: "Fresh, vegetal and lightly sweet with no bitterness.",
    sugarRecommendation: "Best plain.",
    faqs: [{ q: "Why is green tea brewed cooler?", a: "80 °C water avoids extracting bitter tannins from green leaves." }],
    visual: { vessel: "cup", layers: [{ color: "#b8b45a", ratio: 0.8 }], garnish: "leaf", accent: "#a6b24c" },
  }),
  defineDrink({
    id: "lemon-tea",
    name: "Lemon Tea",
    category: "tea",
    primary: false,
    price: 89,
    tagline: "Bright black tea, citrus lift",
    description: "Light black tea brewed clear and finished with a lemon infusion.",
    temperature: "hot",
    strength: 1,
    caffeineMg: 35,
    recipe: { tea: 3, water: 200 },
    steps: [
      { stage: "BREWING", label: "Steeping leaves", detail: "3 g black tea steeped in 200 ml water", seconds: 3 },
      { stage: "MIXING", label: "Lemon infusion", detail: "Citrus infusion and sugar stirred through", seconds: 1.6 },
      { stage: "DISPENSING", label: "Dispensing", detail: "Served in a clear cup", seconds: 2 },
    ],
    allowsSugar: true,
    defaultSugar: "light",
    tasteProfile: "Bright, clean and tangy with a soft tea backbone.",
    sugarRecommendation: "Light sugar balances the citrus.",
    faqs: [{ q: "Does lemon tea have milk?", a: "No — it is black tea with a lemon infusion and optional sugar." }],
    visual: { vessel: "glass", layers: [{ color: "#d8962f", ratio: 0.78 }], garnish: "lemon", accent: "#e5b24a" },
  }),
];

/* Packaged drinks consume their own unit stock, never machine ingredients or cups.
   The menu is drinks-only, so this is limited to bottled water. */
function definePackaged(item: Omit<PackagedItem, "kind" | "listed">): PackagedItem {
  return { ...item, kind: "packaged_item", listed: true };
}

export const PACKAGED_ITEMS: PackagedItem[] = [
  definePackaged({
    id: "bottled-water",
    name: "Bottled Water",
    category: "pantry",
    price: 40,
    tagline: "500 ml mineral water",
    description: "Chilled 500 ml packaged mineral water.",
    icon: "water",
    accent: "#84d4e6",
    unitLabel: "bottle",
  }),
];

export const PREPARED_DRINKS: PreparedDrink[] = [...COFFEE_RECIPES, ...EXTRA_DRINKS];

/** The complete catalogue, primary coffees first. */
export const PRODUCTS: Product[] = [...PREPARED_DRINKS, ...PACKAGED_ITEMS];

export const PRODUCT_MAP: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export function getProduct(id: string): Product | undefined {
  return PRODUCT_MAP[id];
}

export function isDrink(product: Product): product is PreparedDrink {
  return product.kind === "prepared_drink";
}
