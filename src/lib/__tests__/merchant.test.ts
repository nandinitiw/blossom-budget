import { describe, it, expect } from "vitest";
import { cleanMerchantName, normalizeMerchantKey } from "@/lib/merchant";

describe("cleanMerchantName", () => {
  it("strips Square prefix and store number", () => {
    expect(cleanMerchantName("SQ *BLUE BOTTLE COFFEE #4471")).toBe(
      "Blue Bottle Coffee"
    );
  });

  it("strips Toast prefix", () => {
    expect(cleanMerchantName("TST* PIZZERIA DELFINA")).toBe("Pizzeria Delfina");
  });

  it("strips PayPal prefix", () => {
    expect(cleanMerchantName("PAYPAL *SPOTIFY")).toBe("Spotify");
  });

  it("keeps already-clean names as-is", () => {
    expect(cleanMerchantName("Trader Joe's")).toBe("Trader Joe's");
  });

  it("title-cases shouting descriptors", () => {
    expect(cleanMerchantName("WHOLE FOODS MARKET")).toBe("Whole Foods Market");
  });

  it("removes long reference digit runs", () => {
    expect(cleanMerchantName("NETFLIX.COM 8884357669")).toBe("Netflix");
  });

  it("returns raw input if cleaning empties the string", () => {
    expect(cleanMerchantName("#123456789")).toBe("#123456789");
  });
});

describe("normalizeMerchantKey", () => {
  it("produces identical keys for descriptor variants", () => {
    expect(normalizeMerchantKey("SQ *BLUE BOTTLE COFFEE #4471")).toBe(
      normalizeMerchantKey("Blue Bottle Coffee")
    );
  });

  it("lowercases and strips non-alphanumerics", () => {
    expect(normalizeMerchantKey("Trader Joe's")).toBe("traderjoes");
  });
});
