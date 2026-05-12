import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminalSession } from "./lib/useTerminalSession";
import { useOmnibar } from "@/modules/omnibar/lib/useOmnibar";
import { useSnippetPalette } from "@/modules/snippets/lib/useSnippetPalette";
import { useDecodePanel } from "@/modules/decode/useDecodePanel";
import { useEngagementDialog } from "@/modules/engagement/useEngagementDialog";
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

  // Reclaim focus whenever any blocking overlay closes (omnibar, snippet
  // palette, decode panel, engagement dialog). Without this, closing the
  // modal leaves focus on document.body and the user has to click into
  // the pane to type. We collapse all four sources into a single bool so
  // the effect fires once on any transition true→false, regardless of
  // which overlay actually closed. Each subscription is its own hook
  // call (don't short-circuit hooks behind `||` — rules of hooks).
  const omnibarOpen = useOmnibar((s) => s.isOpen);
  const snippetOpen = useSnippetPalette((s) => s.isOpen);
  const decodeOpen = useDecodePanel((s) => s.isOpen);
  const engDialogMode = useEngagementDialog((s) => s.mode);
  const overlayOpen = omnibarOpen || snippetOpen || decodeOpen || engDialogMode !== "closed";
  const prevOverlayRef = useRef(overlayOpen);
  useEffect(() => {
    const wasOpen = prevOverlayRef.current;
    prevOverlayRef.current = overlayOpen;
    if (wasOpen && !overlayOpen && focused && tabActive) {
      session.focus();
    }
  }, [overlayOpen, focused, tabActive, session]);

  return (
    <div
      className="vy-term-pane"
      style={{
        borderLeftColor: focused
          ? "var(--accent-primary)"
          : "var(--border-subtle)",
      }}
    >
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
