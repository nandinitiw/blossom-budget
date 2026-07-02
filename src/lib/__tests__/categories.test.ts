import { describe, it, expect } from "vitest";
import { resolveCategoryName } from "@/lib/categories";

describe("resolveCategoryName (Plaid → app category mapping)", () => {
  it("maps grocery transactions", () => {
    expect(resolveCategoryName("GROCERIES")).toBe("Groceries");
  });

  it("maps food & drink to Dining", () => {
    expect(resolveCategoryName("FOOD_AND_DRINK")).toBe("Dining");
  });

  it("maps rent/utilities to Rent & Housing", () => {
    expect(resolveCategoryName("RENT_AND_UTILITIES")).toBe("Rent & Housing");
  });

  it("maps income", () => {
    expect(resolveCategoryName("INCOME")).toBe("Income");
  });

  it("falls back to Other for unknown categories", () => {
    expect(resolveCategoryName("SOMETHING_NEW")).toBe("Other");
    expect(resolveCategoryName(null)).toBe("Other");
    expect(resolveCategoryName(undefined)).toBe("Other");
  });
});
