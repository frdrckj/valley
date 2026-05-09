import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useTabs } from "@/modules/tabs/useTabs";

interface PreviewPaneProps {
  tabId: string;
  url: string;
}

/**
 * Minimal preview pane — embeds an iframe at the requested URL with a
 * tiny URL bar above it. This is the Phase 1 stub for terax-style
 * "preview tab"; auto-detection of dev-server URLs from terminal output
 * lands in Phase 3.
 */
export function PreviewPane({ tabId, url }: PreviewPaneProps) {
  const [draft, setDraft] = useState(url);
  const [committed, setCommitted] = useState(url);
  const { setUrl, rename } = useTabs.getState();

  function commit() {
    const next = normaliseUrl(draft);
    setCommitted(next);
    setUrl(tabId, next);
    rename(tabId, hostname(next));
  }

  return (
    <div className="vy-preview-pane">
      <form
        className="vy-preview-bar"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <Icon name="folder" size={12} style={{ color: "var(--text-muted)" }} />
        <input
          className="vy-preview-url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="http://localhost:3000"
          spellCheck={false}
        />
        <button className="vy-preview-go" type="submit" title="Load (↩)">
          <Icon name="refresh" size={12} />
        </button>
      </form>
      <iframe
        key={committed}
        className="vy-preview-frame"
        src={committed}
        title="preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

function normaliseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "about:blank";
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(:\d+)?(\/|$)/i.test(trimmed) || /^\d{1,3}(\.\d{1,3}){3}/.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

function hostname(url: string): string {
  try {
    const u = new URL(url);
    return u.host || u.pathname || url;
  } catch {
    return url;
  }
}
