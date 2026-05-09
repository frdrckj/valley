import { ToolLoopAgent, stepCountIs } from "ai";
import { tools } from "../tools/tools";
import { makeLanguageModel } from "./providers";
import {
  MAX_AGENT_STEPS,
  SYSTEM_PROMPT_BASE,
  type ProviderId,
} from "../config";

export interface AgentOpts {
  provider: ProviderId;
  apiKey: string;
  model: string;
  systemExtra?: string;
}

export function buildAgent(opts: AgentOpts) {
  const model = makeLanguageModel(opts);
  const system = opts.systemExtra
    ? `${SYSTEM_PROMPT_BASE}\n\n--- VALLEY.md ---\n${opts.systemExtra}`
    : SYSTEM_PROMPT_BASE;

  return new ToolLoopAgent({
    model,
    instructions: system,
    tools,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });
}
