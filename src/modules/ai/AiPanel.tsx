import { useChat } from "@ai-sdk/react";
import type { Chat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "@/components/Icon";
import type { Side } from "@/lib/layout";
import { useSettings } from "@/lib/settings";
import type { AppMessage } from "./lib/transport";
import { getActiveSession, createSession, hydrateSessions } from "./lib/sessions";
import { getOrCreateChat, clearChat } from "./store/chatStore";
import { useAiContext } from "./store/contextStore";
import { keyring, type Provider } from "./lib/keyring";
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

type InitState =
  | { kind: "loading" }
  | { kind: "needs-key"; provider: Provider }
  | { kind: "ready"; chat: Chat<AppMessage> }
  | { kind: "error"; message: string };

export function AiPanel({ width = 360, side = "right" }: AiPanelProps) {
  const provider = useSettings().defaultProvider as Provider;
  const [state, setState] = useState<InitState>({ kind: "loading" });
  // Bump on "clear chat" to force the init effect to re-run with a
  // fresh Chat instance instead of the cached one in chatStore.
  const [resetTick, setResetTick] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  async function handleClearChat() {
    const sid = sessionIdRef.current;
    if (!sid) return;
    if (
      !window.confirm(
        "clear all messages in this conversation? this can't be undone.",
      )
    )
      return;
    await clearChat(sid);
    setResetTick((t) => t + 1);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Gate on key presence FIRST — friendlier than throwing through chat
      // init and rendering a red error bubble. If the user pastes a key in
      // settings then re-opens the panel via ⌘I, this re-runs and recovers.
      try {
        const key = await keyring.get(provider);
        if (cancelled) return;
        if (!key) {
          setState({ kind: "needs-key", provider });
          return;
        }
        await hydrateSessions();
        if (cancelled) return;
        let session = await getActiveSession();
        if (!session) session = await createSession({ title: "untitled" });
        if (cancelled) return;
        sessionIdRef.current = session.id;
        const chat = await getOrCreateChat(session.id);
        if (cancelled) return;
        setState({ kind: "ready", chat });
      } catch (e) {
        if (!cancelled)
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, resetTick]);

  if (state.kind === "loading") {
    return <div className="vy-aipanel" data-side={side} style={{ width }} />;
  }

  if (state.kind === "needs-key") {
    return (
      <div className="vy-aipanel" data-side={side} style={{ width }}>
        <div className="vy-aipanel-head">
          <Icon name="sparkle" size={13} style={{ color: "var(--accent-ai)" }} />
          <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>valley</span>
        </div>
        <div className="vy-aipanel-empty">
          <Icon
            name="lock"
            size={22}
            style={{ color: "var(--text-muted)", marginBottom: 12 }}
          />
          <div className="vy-aipanel-empty-title">no {state.provider} api key</div>
          <div className="vy-aipanel-empty-sub">
            stored in macOS keychain · paste once, never again.
          </div>
          <button
            type="button"
            className="vy-aipanel-empty-btn"
            onClick={() => void invoke("open_settings_window")}
          >
            open settings →
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="vy-aipanel" data-side={side} style={{ width }}>
        <div className="vy-aipanel-head">
          <Icon name="sparkle" size={13} style={{ color: "var(--accent-ai)" }} />
          <span style={{ color: "var(--text-strong)", fontWeight: 500 }}>valley</span>
        </div>
        <div className="vy-aipanel-body">
          <div className="msg ai">
            <div className="bubble" style={{ color: "var(--accent-danger)" }}>
              {state.message}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AiPanelInner
      // key bumps on "clear" so React unmounts the inner panel (and
      // its useChat subscription) and mounts fresh against the new
      // Chat instance. Without this, useChat sometimes clings to the
      // old chat's snapshot even after the prop reference changed.
      key={resetTick}
      chat={state.chat}
      side={side}
      width={width}
      onClear={() => void handleClearChat()}
    />
  );
}

function AiPanelInner({
  chat,
  side,
  width,
  onClear,
}: {
  chat: Chat<AppMessage>;
  side: Side;
  width: number;
  onClear: () => void;
}) {
  const {
    messages,
    sendMessage,
    status,
    stop,
    addToolApprovalResponse,
    error,
    clearError,
    regenerate,
  } = useChat<AppMessage>({ chat });
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isStreaming = status === "submitted" || status === "streaming";

  // Surface SDK errors so the user actually sees "auth failed" /
  // "model not found" / etc. instead of a silent dead chat. Without
  // this, a 401 from Anthropic just looks like the AI froze.
  useEffect(() => {
    if (error) console.error("[valley.ai]", error);
  }, [error]);

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
        <button
          type="button"
          className="vy-aipanel-clear"
          onClick={onClear}
          title="Clear conversation"
          disabled={messages.length === 0}
        >
          <Icon name="x" size={11} />
          <span>clear</span>
        </button>
      </div>
      <div className="vy-aipanel-body">
        <MessageList messages={messages} onApprove={handleApprove} />
        {error && (
          <div className="vy-aipanel-error">
            <div className="vy-aipanel-error-head">
              <Icon name="alert" size={12} />
              <span>request failed</span>
            </div>
            <div className="vy-aipanel-error-msg">{error.message}</div>
            <div className="vy-aipanel-error-actions">
              <button
                type="button"
                className="vy-aipanel-error-btn"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
              >
                retry
              </button>
              <button
                type="button"
                className="vy-aipanel-error-btn vy-aipanel-error-btn--ghost"
                onClick={() => clearError()}
              >
                dismiss
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="vy-aipanel-composer">
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
              return;
            }
            // Esc while a turn is in flight cancels it without losing
            // the composer text — handy when a long stream is running
            // away and you want to refine the question.
            if (e.key === "Escape" && isStreaming) {
              e.preventDefault();
              stop();
            }
          }}
          style={{ flex: 1 }}
        />
        {isStreaming ? (
          <button
            type="button"
            className="vy-aipanel-stop"
            onClick={() => stop()}
            title="Stop generating (esc)"
          >
            <Icon name="stop" size={11} />
          </button>
        ) : (
          <Icon name="send" size={13} style={{ color: "var(--accent-primary)" }} />
        )}
      </div>
    </div>
  );
}
