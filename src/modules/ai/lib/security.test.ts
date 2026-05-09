import { describe, it, expect } from "vitest";
import { deny } from "./security";

describe("security deny-list", () => {
  it.each([
    [".env"],
    [".env.local"],
    ["~/.ssh/id_rsa"],
    ["/Users/me/credentials.json"],
    ["/var/credentials"],
    ["/Users/me/.ssh/known_hosts"],
    ["/x/private.pem"],
    ["/x/id_rsa.pub"],
  ])("denies %s", (p) => {
    expect(deny(p)).toBe(true);
  });

  it.each([
    ["/Users/me/notes.txt"],
    ["src/main.tsx"],
    ["readme.md"],
  ])("allows %s", (p) => {
    expect(deny(p)).toBe(false);
  });
});
