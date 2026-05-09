export const KEYRING_SERVICE = "valley";
export const MAX_AGENT_STEPS = 12;

export const PROVIDERS = ["openai", "anthropic"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const DEFAULT_PROVIDER: ProviderId = "anthropic";
export const DEFAULT_MODEL_ID: Record<ProviderId, string> = {
  openai: "gpt-5",
  anthropic: "claude-haiku-4-5-20251001",
};

export const SYSTEM_PROMPT_BASE = `You are valley — a calm, terminal-fluent AI built into the user's terminal.
Conventions: lowercase labels, monospace tone, never apologize, never "we", never emojis.
Cite file paths and line numbers when you reference code. When in doubt, ask before acting.`;
