import { DirectChatTransport, type InferAgentUIMessage } from "ai";
import type { ToolLoopAgent } from "ai";
import type { tools } from "../tools/tools";

type AppTools = typeof tools;

export type AppAgent = ToolLoopAgent<never, AppTools>;
export type AppMessage = InferAgentUIMessage<AppAgent>;

/**
 * Creates a DirectChatTransport that routes messages through the given agent
 * in-process — no HTTP round-trip required.
 */
export function makeDirectTransport(
  agentFactory: () => AppAgent,
): DirectChatTransport<never, AppTools, never, AppMessage> {
  return new DirectChatTransport({ agent: agentFactory() });
}
