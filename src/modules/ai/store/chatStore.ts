import { Chat } from "@ai-sdk/react";
import { keyring, type Provider } from "../lib/keyring";
import { makeDirectTransport, type AppMessage } from "../lib/transport";
import { buildAgent } from "../lib/agent";
import { loadMessages, saveMessages, clearMessages } from "../lib/sessions";
import { getSettingsSnapshot } from "@/lib/settings";
import { getLive } from "@/lib/workspace";

const chats = new Map<string, Chat<AppMessage>>();

export async function getOrCreateChat(
  sessionId: string,
): Promise<Chat<AppMessage>> {
  if (chats.has(sessionId)) return chats.get(sessionId)!;

  const settings = getSettingsSnapshot();
  const apiKey = await keyring.get(settings.defaultProvider as Provider);
  if (!apiKey) throw new Error("no API key — set one in Settings → AI");

  const transport = makeDirectTransport(() =>
    buildAgent({
      provider: settings.defaultProvider,
      apiKey,
      model: settings.defaultModel,
      systemExtra: getLive().valleyMd() ?? undefined,
    }),
  );

  const initial = await loadMessages<AppMessage>(sessionId);
  const chat = new Chat<AppMessage>({
    transport,
    messages: initial,
    onFinish: ({ messages }) => {
      void saveMessages(sessionId, messages);
    },
  });

  chats.set(sessionId, chat);
  return chat;
}

export function disposeAllChats() {
  chats.clear();
}

/** Drop the cached Chat instance for a session AND wipe its persisted
 *  messages. The next `getOrCreateChat` call re-instantiates a fresh
 *  Chat with no history. Caller is responsible for re-rendering the
 *  panel (usually by forcing a key bump on AiPanel). */
export async function clearChat(sessionId: string): Promise<void> {
  chats.delete(sessionId);
  await clearMessages(sessionId);
}
