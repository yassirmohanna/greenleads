import { describe, it, expect } from "vitest";
import { scoreContent } from "../src/lib/scoring/scorer";

const config = {
  landscaping: { strong: ["landscaping"], weak: ["lawn"] },
  install: { strong: ["mini split"], weak: ["ac"] },
  negative: ["lost pet", "for sale"]
};

describe("scoring", () => {
  it("scores landscaping higher when keywords match", () => {
    const result = scoreContent("Need landscaping and lawn mowing", config);
    expect(result.score).toBeGreaterThan(0);
    expect(result.category).toBe("LANDSCAPING");
  });

  it("applies negative scoring", () => {
    const result = scoreContent("Lost pet for sale", config);
    expect(result.score).toBeLessThan(0);
  });
});
