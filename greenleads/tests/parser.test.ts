import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { parseRawEmail, extractNextdoorUrl } from "../src/lib/parser/emailParser";

const loadFixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("email parsing", () => {
  it("extracts title, snippet, and url", async () => {
    const raw = loadFixture("nextdoor_landscaping.eml");
    const parsed = await parseRawEmail(raw);

    expect(parsed.subject).toContain("landscaping");
    const url = extractNextdoorUrl(`${parsed.subject}\n${parsed.text}`);
    expect(url).toContain("nextdoor.com");
  });
});
