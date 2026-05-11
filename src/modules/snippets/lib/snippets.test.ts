import { describe, it, expect } from "vitest";
import { SNIPPETS } from "./snippets";

describe("SNIPPETS catalog", () => {
  it("has at least 30 entries", () => {
    expect(SNIPPETS.length).toBeGreaterThanOrEqual(30);
  });

  it("every snippet has a non-empty id", () => {
    for (const s of SNIPPETS) {
      expect(s.id, `id missing on "${s.title}"`).toBeTruthy();
    }
  });

  it("no duplicate ids", () => {
    const ids = SNIPPETS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
