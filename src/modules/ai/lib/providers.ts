import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { ProviderId } from "../config";

/**
 * Both Anthropic and OpenAI block direct browser requests by default
 * because client-side use leaks the API key. Tauri's webview is
 * technically a browser, so we have to opt in explicitly. The user's
 * key never leaves the local keychain or this process — Tauri doesn't
 * expose secrets to remote origins — so the security concern that
 * motivated the block doesn't apply here.
 */
const ANTHROPIC_BROWSER_HEADERS = {
  "anthropic-dangerous-direct-browser-access": "true",
};

export function makeLanguageModel(opts: {
  provider: ProviderId;
  apiKey: string;
  model: string;
}) {
  switch (opts.provider) {
    case "openai":
      return createOpenAI({ apiKey: opts.apiKey })(opts.model);
    case "anthropic":
      return createAnthropic({
        apiKey: opts.apiKey,
        headers: ANTHROPIC_BROWSER_HEADERS,
      })(opts.model);
  }
}
