/**
 * Pure-function decoders for the Decode Panel.
 * Zero external dependencies. Each decoder returns ok:true/false.
 */

export interface DecodeResult {
  id: string;
  label: string;
  value: string;
  meta?: string;
}

type MaybeOk = { ok: true; value: string } | { ok: false };

// ---- helpers ----------------------------------------------------------------

function isPrintable(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x09 || (c > 0x0d && c < 0x20) || c === 0x7f) return false;
  }
  return true;
}

function base64Decode(input: string): MaybeOk {
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    const rem = padded.length % 4;
    const normalized = rem === 0 ? padded : padded + "=".repeat(4 - rem);
    const decoded = atob(normalized);
    if (!isPrintable(decoded)) return { ok: false };
    return { ok: true, value: decoded };
  } catch {
    return { ok: false };
  }
}

function decodeHex(input: string): MaybeOk {
  // Accept 0x... / \x... / raw hex pairs
  let cleaned = input.trim();
  if (/^0x/i.test(cleaned)) cleaned = cleaned.slice(2);
  // \x41\x42 style
  cleaned = cleaned.replace(/\\x/gi, "");
  // strip spaces and dashes
  cleaned = cleaned.replace(/[\s\-:]/g, "");
  if (!/^[0-9a-fA-F]+$/.test(cleaned) || cleaned.length % 2 !== 0) {
    return { ok: false };
  }
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(Number.parseInt(cleaned.slice(i, i + 2), 16));
  }
  const allPrintable = bytes.every((b) => (b >= 0x20 && b < 0x7f) || b === 0x09 || b === 0x0a || b === 0x0d);
  if (allPrintable) {
    return { ok: true, value: String.fromCharCode(...bytes) };
  }
  const hex = `0x${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")} · ${bytes.length} byte${bytes.length !== 1 ? "s" : ""}`;
  return { ok: true, value: hex };
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", copy: "©", reg: "®", trade: "™",
  mdash: "—", ndash: "–", hellip: "…", laquo: "«", raquo: "»",
};

function decodeHtmlEntities(input: string): MaybeOk {
  const decoded = input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => HTML_ENTITIES[name.toLowerCase()] ?? m);
  if (decoded === input) return { ok: false };
  return { ok: true, value: decoded };
}

function decodeUnicodeEscape(input: string): MaybeOk {
  try {
    const decoded = input
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
    if (decoded === input) return { ok: false };
    return { ok: true, value: decoded };
  } catch {
    return { ok: false };
  }
}

function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

interface HashGuess { label: string; meta: string }

function guessHash(input: string): HashGuess | null {
  const s = input.trim();
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  const len = s.length;
  const map: Record<number, string> = {
    32: "MD5 / NTLM",
    40: "SHA-1 / RIPEMD-160",
    56: "SHA-224",
    64: "SHA-256 / BLAKE2-256",
    96: "SHA-384",
    128: "SHA-512 / BLAKE2-512",
  };
  const match = map[len];
  if (!match) return null;
  return {
    label: `Likely ${match.split(" / ")[0]}`,
    meta: `${len} hex chars · possible: ${match}`,
  };
}

// ---- JWT --------------------------------------------------------------------

function tryJwtSegment(b64: string): string | null {
  const r = base64Decode(b64);
  if (!r.ok) return null;
  try {
    return JSON.stringify(JSON.parse(r.value), null, 2);
  } catch {
    return r.value;
  }
}

// ---- main -------------------------------------------------------------------

export function decodeAll(input: string): DecodeResult[] {
  if (!input.trim()) return [];

  const results: DecodeResult[] = [];

  // JWT (highest priority)
  const parts = input.trim().split(".");
  if (parts.length === 3) {
    const header = tryJwtSegment(parts[0]!);
    const payload = tryJwtSegment(parts[1]!);
    if (header && payload) {
      results.push({ id: "jwt-header", label: "JWT header", value: header });
      results.push({ id: "jwt-payload", label: "JWT payload", value: payload });
    }
  }

  // JSON pretty
  try {
    const parsed = JSON.parse(input.trim());
    const pretty = JSON.stringify(parsed, null, 2);
    if (pretty !== input.trim()) {
      results.push({ id: "json-pretty", label: "JSON (pretty)", value: pretty });
    }
  } catch { /* skip */ }

  // base64 (standard + url-safe)
  const b64std = base64Decode(input.trim());
  const b64url = base64Decode(input.trim().replace(/\+/g, "-").replace(/\//g, "_"));

  if (b64std.ok) {
    results.push({ id: "base64", label: "Base64", value: b64std.value });
  }
  if (b64url.ok && (!b64std.ok || b64url.value !== b64std.value)) {
    results.push({ id: "base64-url", label: "Base64 URL-safe", value: b64url.value });
  }

  // URL decode
  try {
    const decoded = decodeURIComponent(input.trim());
    if (decoded !== input.trim()) {
      results.push({ id: "url", label: "URL decoded", value: decoded });
    }
  } catch { /* skip */ }

  // Hex
  const hexResult = decodeHex(input.trim());
  if (hexResult.ok) {
    results.push({ id: "hex", label: "Hex", value: hexResult.value });
  }

  // HTML entities
  const htmlResult = decodeHtmlEntities(input);
  if (htmlResult.ok) {
    results.push({ id: "html-entities", label: "HTML entities", value: htmlResult.value });
  }

  // Unicode escape
  const unicodeResult = decodeUnicodeEscape(input);
  if (unicodeResult.ok) {
    results.push({ id: "unicode-escape", label: "Unicode escape", value: unicodeResult.value });
  }

  // Hash fingerprint
  const hash = guessHash(input.trim());
  if (hash) {
    results.push({ id: "hash-fingerprint", label: hash.label, value: hash.label, meta: hash.meta });
  }

  // ROT13
  const r13 = rot13(input);
  if (r13 !== input) {
    results.push({ id: "rot13", label: "ROT13", value: r13 });
  }

  return results;
}
