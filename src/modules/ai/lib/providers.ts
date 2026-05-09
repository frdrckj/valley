import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { ProviderId } from "../config";

export function makeLanguageModel(opts: {
  provider: ProviderId;
  apiKey: string;
  model: string;
}) {
  switch (opts.provider) {
    case "openai":
      return createOpenAI({ apiKey: opts.apiKey })(opts.model);
    case "anthropic":
      return createAnthropic({ apiKey: opts.apiKey })(opts.model);
  }
}
