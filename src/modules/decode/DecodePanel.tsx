import { useEffect, useRef, useState, useCallback } from "react";
import { useDecodePanel } from "./useDecodePanel";
import { decodeAll, type DecodeResult } from "./lib/decoders";

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function ResultItem({ result }: { result: DecodeResult }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(result.value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="vy-decode-result">
      <div className="vy-decode-result-header">
        <span className="vy-decode-result-label">{result.label}</span>
        {result.meta && <span className="vy-decode-result-meta">{result.meta}</span>}
        <button type="button" className="vy-decode-copy-btn" onClick={handleCopy}>
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="vy-decode-result-pre">{result.value}</pre>
    </div>
  );
}

export function DecodePanel() {
  const { isOpen, close } = useDecodePanel();
  const [input, setInput] = useState("");
  const debouncedInput = useDebounce(input, 80);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const results = decodeAll(debouncedInput);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    } else {
      setInput("");
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") close();
    },
    [close],
  );

  if (!isOpen) return null;

  return (
    <div className="vy-decode-backdrop" onMouseDown={close}>
      <div
        className="vy-decode-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="vy-decode-header">
          <span className="vy-decode-title">decode</span>
          <button type="button" className="vy-decode-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        <div className="vy-decode-input-wrap">
          <textarea
            ref={textareaRef}
            className="vy-decode-textarea"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a JWT, base64, hex, URL-encoded string, JSON, hash, anything…"
          />
        </div>

        {results.length > 0 && (
          <div className="vy-decode-results">
            {results.map((r) => (
              <ResultItem key={r.id} result={r} />
            ))}
          </div>
        )}

        {input.trim().length > 0 && results.length === 0 && (
          <div className="vy-decode-empty">no decodings found</div>
        )}
      </div>
    </div>
  );
}
