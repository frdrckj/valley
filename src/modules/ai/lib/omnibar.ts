import { hydrateSessions, createSession } from "./sessions";
import { getOrCreateChat } from "../store/chatStore";

/**
 * Sends a one-shot query to a transient AI session and returns the assistant's
 * first text response.
 *
 * Implementation path: `chat.sendMessage({ text })` exists directly on
 * `AbstractChat` and returns `Promise<void>` that resolves when the full
 * response stream is consumed. After it resolves, `chat.messages` holds the
 * final message list from which we extract the last assistant text part.
 */
export async function askValley(text: string): Promise<string> {
  await hydrateSessions();
  const meta = await createSession({ title: `omnibar:${Date.now()}` });
  const chat = await getOrCreateChat(meta.id);
  await chat.sendMessage({ text });

  // After sendMessage resolves, chat.messages contains the final state.
  const messages = chat.messages;
  const last = messages[messages.length - 1];
  const textPart = last?.parts?.find((p) => p.type === "text");
  return textPart && "text" in textPart ? textPart.text : "";
}
