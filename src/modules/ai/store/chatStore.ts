import { Chat } from "@ai-sdk/react";
import { keyring, type Provider } from "../lib/keyring";
import { makeDirectTransport, type AppMessage } from "../lib/transport";
import { buildAgent } from "../lib/agent";
import { loadMessages, saveMessages } from "../lib/sessions";
import { getSettingsSnapshot } from "@/lib/settings";

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
