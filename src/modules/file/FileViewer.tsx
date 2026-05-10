import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { native } from "@/lib/native";

interface FileViewerProps {
  path: string;
}

/**
 * Read-only file viewer. Phase 1.5 stub for terax's CodeMirror editor —
 * loads the file via `fs_read_file` and renders it as a scrollable `<pre>`
 * with line numbers. Editing lands when the editor module ships in Phase 3.
 */
export function FileViewer({ path }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    native.fs
      .readFile(path)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="vy-file-viewer">
      <div className="vy-file-bar">
        <Icon name="file" size={12} style={{ color: "var(--text-muted)" }} />
        <span className="vy-file-path" title={path}>
          {path}
        </span>
        <span className="vy-file-size">
          {content !== null
            ? `${formatBytes(content.length)} · ${countLines(content)} lines`
            : ""}
        </span>
      </div>
      {error && (
        <div className="vy-file-error">
          <Icon name="alert" size={12} /> {error}
        </div>
      )}
      {content === null && !error && (
        <div className="vy-file-loading">loading…</div>
      )}
      {content !== null && (
        <div className="vy-file-body">
          <pre className="vy-file-pre">{content}</pre>
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function countLines(s: string): number {
  if (!s) return 0;
  let n = 1;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}
