import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalSession } from "./lib/useTerminalSession";
import { useOmnibar } from "@/modules/omnibar/lib/useOmnibar";
import { useTabs } from "@/modules/tabs/useTabs";
import { Icon } from "@/components/Icon";

interface TerminalProps {
  sessionId: string;
  cwd?: string;
  focused?: boolean;
  /** True when the owning tab is the active tab. Combined with `focused`
   *  so the xterm only steals focus when its tab is in front; otherwise
   *  switching tabs would re-focus a hidden xterm and steal keyboard
   *  focus from the new tab's editor. */
  tabActive?: boolean;
}

export function Terminal({
  sessionId,
  cwd,
  focused = true,
  tabActive = true,
}: TerminalProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  // Most-recent localhost URL the shell printed. The banner offers to
  // open it as a preview tab. `null` after dismiss or after the user
  // accepts; another URL can replace it.
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);

  const handleDetectedLocalUrl = useCallback((url: string) => {
    setDetectedUrl(url);
  }, []);

  // The session's `visible` drives focus + fit. Toggle it on tab switches
  // so the active pane in the newly-visible tab claims keyboard focus.
  const session = useTerminalSession({
    sessionId,
    container: ref,
    visible: focused && tabActive,
    initialCwd: cwd,
    onDetectedLocalUrl: handleDetectedLocalUrl,
    gutter: gutterRef,
  });

  const openPreview = useCallback(() => {
    if (!detectedUrl) return;
    const s = useTabs.getState();
    // If a preview tab for this URL is already open, just activate it.
    const existing = s.tabs.find(
      (t) => t.kind === "preview" && t.url === detectedUrl,
    );
    if (existing) {
      s.activate(existing.id);
    } else {
      const label = labelForUrl(detectedUrl);
      s.open({ kind: "preview", label, url: detectedUrl });
    }
    setDetectedUrl(null);
  }, [detectedUrl]);

  // Reclaim focus when the omnibar closes (Esc / Cmd+P). Without this,
  // closing the modal leaves focus on document.body and the user has to
  // click into the pane to type. Detect a true→false transition rather
  // than firing on every render so we don't steal focus mid-typing.
  const omnibarOpen = useOmnibar((s) => s.isOpen);
  const prevOmnibarRef = useRef(omnibarOpen);
  useEffect(() => {
    const wasOpen = prevOmnibarRef.current;
    prevOmnibarRef.current = omnibarOpen;
    if (wasOpen && !omnibarOpen && focused && tabActive) {
      session.focus();
    }
  }, [omnibarOpen, focused, tabActive, session]);

  return (
    <div
      className="vy-term-pane"
      style={{ borderLeftColor: focused ? "var(--accent-primary)" : "transparent" }}
    >
      <div ref={gutterRef} className="vy-block-gutter" />
      <div ref={ref} className="vy-xterm-host" />
      {detectedUrl && (
        <div className="vy-url-banner" role="status">
          <Icon name="search" size={12} />
          <span className="vy-url-banner-text">Detected {detectedUrl}</span>
          <button
            type="button"
            className="vy-url-banner-btn"
            onClick={openPreview}
          >
            Open preview
          </button>
          <button
            type="button"
            className="vy-url-banner-x"
            onClick={() => setDetectedUrl(null)}
            aria-label="Dismiss"
          >
            <Icon name="x" size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Pretty label for a preview tab — "localhost:3000" rather than the
 *  raw URL. Falls back to the original string if parsing fails. */
function labelForUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return url;
  }
}
