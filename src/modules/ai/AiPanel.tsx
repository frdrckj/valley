import { useChat } from "@ai-sdk/react";
import type { Chat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Side } from "@/lib/layout";
import type { AppMessage } from "./lib/transport";
import { getActiveSession, createSession, hydrateSessions } from "./lib/sessions";
import { getOrCreateChat } from "./store/chatStore";
import { useAiContext } from "./store/contextStore";
import { MessageList } from "./components/MessageList";

interface AiPanelProps {
  width?: number;
  side?: Side;
  /** @deprecated — kept for backwards compat; no longer drives static content */
  withToolCall?: boolean;
  /** @deprecated — kept for backwards compat */
  pinned?: boolean;
  /** @deprecated — kept for backwards compat */
  onPin?: () => void;
}

export function AiPanel({ width = 360, side = "right" }: AiPanelProps) {
  const [chat, setChat] = useState<Chat<AppMessage> | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await hydrateSessions();
        let session = await getActiveSession();
        if (!session) session = await createSession({ title: "untitled" });
        setChat(await getOrCreateChat(session.id));
      } catch (e) {
        setInitError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (initError) {
    return (
      <div className="vy-aipanel" data-side={side} style={{ width }}>
        <div className="vy-aipanel-head">
          <Icon name="sparkle" size={13} style={{ color: "var(--accent-ai)" }} />
          <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>valley</span>
        </div>
        <div className="vy-aipanel-body">
          <div className="msg ai">
            <div className="bubble" style={{ color: "var(--accent-danger)" }}>
              {initError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!chat) return <div className="vy-aipanel" data-side={side} style={{ width }} />;

  return <AiPanelInner chat={chat} side={side} width={width} />;
}

function AiPanelInner({
  chat,
  side,
  width,
}: {
  chat: Chat<AppMessage>;
  side: Side;
  width: number;
}) {
  const { messages, sendMessage, status, addToolApprovalResponse } = useChat<AppMessage>({ chat });
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";

  // Drain pending terminal-context (set by ⌘L). Runs on mount AND
  // subscribes to later updates so a second ⌘L while the panel is
  // already open also attaches the new selection.
  useEffect(() => {
    function drain() {
      const ctx = useAiContext.getState().consume();
      if (!ctx) return;
      // Prepend a fenced code block so the model sees "this is the
      // context you're being asked about", and put the cursor after it.
      const block = `\`\`\`\n${ctx}\n\`\`\`\n\n`;
      setText((prev) => block + prev);
      // Defer focus so React commits the value first.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    drain();
    const unsub = useAiContext.subscribe((s) => {
      if (s.pending !== null) drain();
    });
    return unsub;
  }, []);

  function handleApprove(approvalId: string, approved: boolean) {
    void addToolApprovalResponse({ id: approvalId, approved });
  }

  return (
    <div className="vy-aipanel" data-side={side} style={{ width }}>
      <div className="vy-aipanel-head">
        <Icon name="sparkle" size={13} style={{ color: "var(--accent-ai)" }} />
        <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>valley</span>
      </div>
      <div className="vy-aipanel-body">
        <MessageList messages={messages} onApprove={handleApprove} />
      </div>
      <div className="vy-aipanel-composer">
        <Icon name="clip" size={13} style={{ color: "var(--text-muted)" }} />
        <input
          ref={inputRef}
          className="input"
          placeholder="ask valley · ⌘L to attach selection"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim() && !isStreaming) {
              void sendMessage({ text });
              setText("");
            }
          }}
          style={{ flex: 1 }}
        />
        <Icon name="send" size={13} style={{ color: "var(--accent-primary)" }} />
      </div>
    </div>
  );
}
