import { describe, it, expect } from "vitest";
import { decodeAll } from "./decoders";

describe("decodeAll", () => {
  it("returns empty array for empty input", () => {
    expect(decodeAll("")).toEqual([]);
    expect(decodeAll("   ")).toEqual([]);
  });

  it("base64: SGVsbG8gd29ybGQ= → Hello world", () => {
    const results = decodeAll("SGVsbG8gd29ybGQ=");
    const b64 = results.find((r) => r.id === "base64");
    expect(b64?.value).toBe("Hello world");
  });

  it("base64-url (no padding): SGVsbG8 → Hello", () => {
    const results = decodeAll("SGVsbG8");
    const b64 = results.find((r) => r.id === "base64" || r.id === "base64-url");
    expect(b64?.value).toBe("Hello");
  });

  it("url decode: Hello%20%E4%B8%96 → Hello 世", () => {
    const results = decodeAll("Hello%20%E4%B8%96");
    const url = results.find((r) => r.id === "url");
    expect(url?.value).toBe("Hello 世");
  });

  it("hex: 48656c6c6f → Hello", () => {
    const results = decodeAll("48656c6c6f");
    const hex = results.find((r) => r.id === "hex");
    expect(hex?.value).toBe("Hello");
  });

  it("hex with \\x prefix: \\x48\\x65 → He", () => {
    const results = decodeAll("\\x48\\x65");
    const hex = results.find((r) => r.id === "hex");
    expect(hex?.value).toBe("He");
  });

  it("html entities: &lt;script&gt; → <script>", () => {
    const results = decodeAll("&lt;script&gt;");
    const html = results.find((r) => r.id === "html-entities");
    expect(html?.value).toBe("<script>");
  });

  it("unicode-escape: \\u0041\\u0042 → AB", () => {
    const results = decodeAll("\\u0041\\u0042");
    const ue = results.find((r) => r.id === "unicode-escape");
    expect(ue?.value).toBe("AB");
  });

  it("JWT: emits both jwt-header and jwt-payload with pretty-printed JSON", () => {
    // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 = {"alg":"HS256","typ":"JWT"}
    // eyJzdWIiOiIxMjMiLCJuYW1lIjoieCJ9 = {"sub":"123","name":"x"}
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoieCJ9.SIGNATURE";
    const results = decodeAll(token);
    const header = results.find((r) => r.id === "jwt-header");
    const payload = results.find((r) => r.id === "jwt-payload");
    expect(header).toBeDefined();
    expect(payload).toBeDefined();
    const headerObj = JSON.parse(header!.value);
    expect(headerObj.alg).toBe("HS256");
    expect(headerObj.typ).toBe("JWT");
    const payloadObj = JSON.parse(payload!.value);
    expect(payloadObj.sub).toBe("123");
    expect(payloadObj.name).toBe("x");
    // Should be multi-line (pretty printed)
    expect(header!.value).toContain("\n");
    expect(payload!.value).toContain("\n");
  });

  it("json-pretty: {\"a\":1,\"b\":[1,2]} → multi-line indented", () => {
    const results = decodeAll('{"a":1,"b":[1,2]}');
    const jp = results.find((r) => r.id === "json-pretty");
    expect(jp?.value).toContain("\n");
    expect(jp?.value).toContain("  ");
    expect(JSON.parse(jp!.value)).toEqual({ a: 1, b: [1, 2] });
  });

  it("hash-fingerprint: 32 hex chars → meta contains MD5", () => {
    const md5 = "d41d8cd98f00b204e9800998ecf8427e";
    const results = decodeAll(md5);
    const fp = results.find((r) => r.id === "hash-fingerprint");
    expect(fp).toBeDefined();
    expect(fp!.meta).toContain("MD5");
  });

  it("hash-fingerprint: 40 hex chars → meta contains SHA-1", () => {
    const sha1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
    const results = decodeAll(sha1);
    const fp = results.find((r) => r.id === "hash-fingerprint");
    expect(fp).toBeDefined();
    expect(fp!.meta).toContain("SHA-1");
  });

  it("rot13: Hello → Uryyb", () => {
    const results = decodeAll("Hello");
    const r13 = results.find((r) => r.id === "rot13");
    expect(r13?.value).toBe("Uryyb");
  });
});
