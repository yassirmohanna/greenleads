import { describe, it, expect } from "vitest";
import { addUrl, isDuplicateUrl } from "../src/lib/dedupe";

describe("dedupe", () => {
  it("detects duplicate urls", () => {
    const set = new Set<string>();
    addUrl("https://nextdoor.com/p/abc", set);

    expect(isDuplicateUrl("https://nextdoor.com/p/abc", set)).toBe(true);
    expect(isDuplicateUrl("https://nextdoor.com/p/def", set)).toBe(false);
  });
});
