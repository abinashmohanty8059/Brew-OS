import { describe, expect, it } from "vitest";
import { parseVoiceOrder } from "./voice-order";

const add = (text: string) => {
  const r = parseVoiceOrder(text);
  if (r.kind !== "add") throw new Error(`expected add, got ${r.kind}`);
  return r;
};

describe("parseVoiceOrder", () => {
  it("maps a plain 'coffee' to an Americano", () => {
    expect(add("coffee").items).toEqual([{ productId: "americano", quantity: 1, heard: "coffee" }]);
  });

  it("orders the named drink", () => {
    expect(add("Cappuccino").items[0].productId).toBe("cappuccino");
    expect(add("I'd like a capucchino please").items[0].productId).toBe("cappuccino");
    expect(add("flat white").items[0].productId).toBe("flat-white");
  });

  it("prefers the longer drink name over generic coffee", () => {
    expect(add("one cold coffee").items).toEqual([{ productId: "cold-coffee", quantity: 1, heard: "cold coffee" }]);
    expect(add("masala chai").items[0].productId).toBe("masala-chai");
  });

  it("reads quantities and several drinks", () => {
    const r = add("two cappuccinos and a latte");
    expect(r.items).toEqual([
      { productId: "cappuccino", quantity: 2, heard: "cappuccinos" },
      { productId: "latte", quantity: 1, heard: "latte" },
    ]);
    expect(add("3 mochas").items[0].quantity).toBe(3);
  });

  it("detects checkout with or without items", () => {
    expect(add("a latte and checkout").checkout).toBe(true);
    expect(parseVoiceOrder("checkout").kind).toBe("checkout");
    expect(parseVoiceOrder("clear my order").kind).toBe("clear");
  });

  it("understands a drink spelled letter by letter", () => {
    expect(add("l a t t e").items).toEqual([{ productId: "latte", quantity: 1, heard: "latte" }]);
    expect(add("L. A. T. T. E.").items[0].productId).toBe("latte");
    expect(add("a l a t t e").items[0].productId).toBe("latte");
    expect(add("two m o c h a").items[0]).toMatchObject({ productId: "mocha", quantity: 2 });
    expect(add("c a p p u c c i n o").items[0].productId).toBe("cappuccino");
    expect(add("f l a t w h i t e").items[0].productId).toBe("flat-white");
    expect(add("h o t c h o c o l a t e").items[0].productId).toBe("hot-chocolate");
  });

  it("returns unknown for unrelated speech", () => {
    expect(parseVoiceOrder("what's the weather").kind).toBe("unknown");
  });
});
